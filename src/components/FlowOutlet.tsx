/**
 * FlowOutlet — renders wherever the consumer places it.
 *
 * Owns the internal React context provider, wraps children in a
 * `FlowErrorBoundary` for step-level error handling, acts as the
 * Suspense boundary for async step loading, and accepts `fallback`
 * and `errorStep` props.
 *
 * When the `transition` prop is provided, step changes enter a three-phase
 * transition: "exiting" (both steps available), "entering" (the previous
 * step is unmounted), then "exited" (the next step is current).
 */
import {
  type ComponentType,
  forwardRef,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  FlowContext,
  type FlowContextValue,
  StepContext,
  type StepContextValue,
} from "../internal/context";
import { type ErrorStepContext, FlowErrorBoundary } from "../internal/FlowErrorBoundary";
import type { StepLoader } from "../internal/normalizer";
import { normalizeStepLoader } from "../internal/normalizer";

// #region doc:transition-slot-props
/** Props passed to the `transition` render prop on FlowOutlet. */
export interface TransitionSlotProps {
  /** The outgoing step element. `null` when no transition is in flight. */
  previousStep: ReactNode | null;
  /** The incoming/current step element. Always present when a flow is active. */
  nextStep: ReactNode;
  /** Current transition phase. */
  phase: "exiting" | "entering" | "exited";
  /** Call to signal the exit animation has completed. Only meaningful during
   *  the `"exiting"` phase; calling it in other phases is a no-op. */
  onExited: () => void;
  /** Monotonically increasing identity of the current transition. Increments
   *  every time a new exit transition starts — including back-to-back queued
   *  transitions where `previousStep` swaps without ever becoming `null`.
   *  Attach it as a React `key` on your animation wrapper elements so each
   *  transition remounts them and restarts their animations. Without it,
   *  React reuses the wrapper DOM node across queued transitions, CSS
   *  animations never restart, and `onExited` is never re-triggered. */
  transitionKey: number;
}
// #endregion doc:transition-slot-props

export interface FlowOutletProps {
  children?: ReactNode;
  fallback?: ReactNode;
  errorStep?: (context: ErrorStepContext) => ReactNode;
  chrome?: (children: ReactNode) => ReactNode;
  /** When provided, the outlet enters transition mode. The render prop is invoked
   *  whenever a flow is active. When absent, the outlet performs immediate step
   *  swaps with no dual-mounting. */
  transition?: (props: TransitionSlotProps) => ReactNode;
}

// #region doc:handle
/** Imperative handle exposed by FlowOutlet via its forwarded ref. */
export interface FlowOutletHandle {
  /** Activate a flow, rendering the given step component in this outlet. */
  activate: (
    stepLoader: StepLoader,
    initialContext?: unknown,
    onResolve?: (value?: unknown) => void,
    onAbort?: (reason?: unknown) => void,
    onActivated?: () => void,
  ) => void;
}
// #endregion doc:handle

interface FlowState {
  history: ComponentType[];
  activeStep: ComponentType;
  consumerContext: unknown;
}

// #region doc:step-record
/**
 * A persistent rendered step instance in transition mode. The step subtree
 * (context provider, error boundary, Suspense, step component) is rendered
 * through a portal into `host`, which never changes for the life of the
 * record — so the React instance survives no matter where the consumer's
 * transition render prop places the slot, and local state/effects are
 * retained when a step moves from the `nextStep` slot to `previousStep`.
 */
interface StepRecord {
  /** Unique per mounted step instance; used as the portal key. */
  id: number;
  Component: ComponentType;
  /** Stable portal container. Layout-transparent via `display: contents`. */
  host: HTMLElement;
}

/**
 * Placeholder rendered where the consumer places a step slot. A real layout
 * box so consumer container styling (padding, background, borders) applies
 * to the slot position. Adopts the record's host DOM on mount so the
 * portal-rendered subtree appears in place.
 */
function StepSlot({ host }: { host: HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const parent = ref.current;
    if (parent === null) return;
    parent.appendChild(host);
    return () => {
      if (host.parentNode === parent) {
        host.remove();
      }
    };
  }, [host]);
  return <div ref={ref} />;
}
// #endregion doc:step-record

type TransitionQueueEntry =
  | { type: "advance"; stepLoader: StepLoader; contextPatch?: unknown }
  | { type: "retreat" };

function reportLoaderError(phase: "activate" | "advance", error: unknown) {
  console.error(
    `FlowOutlet.${phase}() failed while normalizing a step loader. The flow was left idle.`,
    error,
  );
}

function mergeContext(current: unknown, patch: unknown): unknown {
  if (
    typeof current === "object" &&
    current !== null &&
    typeof patch === "object" &&
    patch !== null
  ) {
    return {
      ...(current as Record<string, unknown>),
      ...(patch as Record<string, unknown>),
    };
  }
  return patch;
}

// #region doc:props
export const FlowOutlet = forwardRef<FlowOutletHandle, FlowOutletProps>(
  function FlowOutlet(props, ref) {
    // #endregion doc:props
    const [flowState, setFlowState] = useState<FlowState | null>(null);
    const errorBoundaryRef = useRef<FlowErrorBoundary>(null);
    const resolveRef = useRef<((value?: unknown) => void) | null>(null);
    const abortRef = useRef<((reason?: unknown) => void) | null>(null);
    /** Monotonically increasing token — invalidates stale resolve/abort closures. */
    const flowIdRef = useRef(0);
    /** Retains the last consumer context value after a flow resolves, so idle children can read it via `useSequentContext`. */
    const lastConsumerContextRef = useRef<unknown>(undefined);

    // #region doc:transition-state
    /** Current transition phase. Only meaningful when `props.transition` is provided. */
    const [phase, setPhase] = useState<"exiting" | "entering" | "exited">("exited");
    /** Synchronous mirror of phase — used inside callbacks to avoid React batching races. */
    const phaseRef = useRef<"exiting" | "entering" | "exited">("exited");
    /** Update both the state and the synchronous ref atomically. */
    const setPhaseValue = useCallback((value: "exiting" | "entering" | "exited") => {
      phaseRef.current = value;
      setPhase(value);
    }, []);
    /** Queue of pending navigations accumulated during an active exit transition. */
    const transitionQueueRef = useRef<TransitionQueueEntry[]>([]);
    /** Monotonic transition identity — bumps on every new exit transition. */
    const transitionKeyRef = useRef(0);
    /** Persistent rendered instance of the current/entering step. */
    const currentRecordRef = useRef<StepRecord | null>(null);
    /** Persistent rendered instance of the exiting step, retained (not recreated)
     *  so its local state and effects survive the exit animation. */
    const previousRecordRef = useRef<StepRecord | null>(null);
    /** Mints unique step-record ids. */
    const stepRecordIdRef = useRef(0);
    /** The consumer context at the moment the previous step began exiting. */
    const previousStepContextRef = useRef<unknown>(undefined);

    const createStepRecord = useCallback((Component: ComponentType): StepRecord => {
      stepRecordIdRef.current += 1;
      const host = document.createElement("div");
      host.style.display = "contents";
      return { id: stepRecordIdRef.current, Component, host };
    }, []);
    /** Monotonic counter — increments each time a transition is accepted. */
    const transitionEpochRef = useRef(0);
    /** Epoch of the entering/active step. Checked by transitionAdvance/transitionRetreat. */
    const currentStepEpochRef = useRef(0);
    /** Epoch of the exiting step. Checked by queueAdvance/queueRetreat. */
    const previousStepEpochRef = useRef(0);
    // #endregion doc:transition-state

    const handleResolve = useCallback(
      (value?: unknown) => {
        const cb = resolveRef.current;
        resolveRef.current = null;
        abortRef.current = null;
        flowIdRef.current += 1;
        // Clear transition state when the flow terminates.
        currentRecordRef.current = null;
        previousRecordRef.current = null;
        transitionQueueRef.current = [];
        transitionEpochRef.current = 0;
        currentStepEpochRef.current = 0;
        previousStepEpochRef.current = 0;
        setPhaseValue("exited");
        setFlowState((prev) => {
          if (prev !== null) {
            lastConsumerContextRef.current = prev.consumerContext;
          }
          return null;
        });
        cb?.(value);
      },
      [setPhaseValue],
    );

    const handleAbort = useCallback(
      (reason?: unknown) => {
        const cb = abortRef.current;
        resolveRef.current = null;
        abortRef.current = null;
        flowIdRef.current += 1;
        // Clear transition state when the flow terminates.
        currentRecordRef.current = null;
        previousRecordRef.current = null;
        transitionQueueRef.current = [];
        transitionEpochRef.current = 0;
        currentStepEpochRef.current = 0;
        previousStepEpochRef.current = 0;
        setPhaseValue("exited");
        setFlowState(null);
        cb?.(reason);
      },
      [setPhaseValue],
    );

    const activeFlowId = flowIdRef.current;

    // #region doc:transition-drain
    /** Process a single queued navigation entry and start its transition. */
    const drainQueueEntry = useCallback(
      (entry: TransitionQueueEntry) => {
        const currentFlowId = flowIdRef.current;
        if (entry.type === "advance") {
          let nextActiveStep: ComponentType;
          try {
            nextActiveStep = normalizeStepLoader(entry.stepLoader);
          } catch (error) {
            reportLoaderError("advance", error);
            setPhaseValue("exited");
            return;
          }
          if (flowIdRef.current !== currentFlowId) return;
          errorBoundaryRef.current?.resetError();
          previousStepEpochRef.current = currentStepEpochRef.current;
          transitionEpochRef.current += 1;
          previousRecordRef.current = currentRecordRef.current;
          currentRecordRef.current = createStepRecord(nextActiveStep);
          setFlowState((prev) => {
            if (prev === null) return prev;
            previousStepContextRef.current = prev.consumerContext;
            return {
              history: [...prev.history, prev.activeStep],
              activeStep: nextActiveStep,
              consumerContext:
                entry.contextPatch !== undefined
                  ? mergeContext(prev.consumerContext, entry.contextPatch)
                  : prev.consumerContext,
            };
          });
          transitionKeyRef.current += 1;
          setPhaseValue("exiting");
        } else {
          if (flowState === null || flowState.history.length === 0) {
            // Retreat with no history to pop is a no-op. Settle instead of
            // starting an exit transition that has no previous step to render.
            setPhaseValue("exited");
            return;
          }
          errorBoundaryRef.current?.resetError();
          previousStepEpochRef.current = currentStepEpochRef.current;
          transitionEpochRef.current += 1;
          previousRecordRef.current = currentRecordRef.current;
          currentRecordRef.current = createStepRecord(
            flowState.history[flowState.history.length - 1],
          );
          setFlowState((prev) => {
            if (prev === null || prev.history.length === 0) return prev;
            previousStepContextRef.current = prev.consumerContext;
            const historyPrev = prev.history[prev.history.length - 1];
            return {
              history: prev.history.slice(0, -1),
              activeStep: historyPrev,
              consumerContext: prev.consumerContext,
            };
          });
          transitionKeyRef.current += 1;
          setPhaseValue("exiting");
        }
      },
      [createStepRecord, flowState, setPhaseValue],
    );

    /** Call when the exit animation has completed. Only meaningful in "exiting" phase. */
    const handleExited = useCallback(() => {
      if (phaseRef.current !== "exiting") return;
      previousRecordRef.current = null;
      const queue = transitionQueueRef.current;
      if (queue.length > 0) {
        const entry = queue.shift();
        if (!entry) {
          throw new Error("Transition queue was unexpectedly empty when draining.");
        }
        drainQueueEntry(entry);
      } else {
        setPhaseValue("entering");
      }
    }, [drainQueueEntry, setPhaseValue]);

    /** Auto-advance from "entering" to "exited" after one tick, so the consumer
     *  sees one render with phase "entering" (enter-animation window) before the
     *  flow settles. */
    useEffect(() => {
      if (
        phase === "entering" &&
        phaseRef.current === "entering" &&
        transitionQueueRef.current.length === 0
      ) {
        setPhaseValue("exited");
      }
    }, [phase, setPhaseValue]);
    // #endregion doc:transition-drain

    // #region doc:direct-navigate
    /** Direct advance — updates flowState immediately with no transition. */
    const directAdvance = useCallback(
      (nextStep: StepLoader, contextPatch?: unknown) => {
        if (flowIdRef.current !== activeFlowId) return;
        let nextActiveStep: ComponentType;
        try {
          nextActiveStep = normalizeStepLoader(nextStep);
        } catch (error) {
          reportLoaderError("advance", error);
          throw error;
        }
        if (flowIdRef.current !== activeFlowId) return;
        errorBoundaryRef.current?.resetError();
        setFlowState((prev) => {
          if (prev === null) return prev;
          return {
            history: [...prev.history, prev.activeStep],
            activeStep: nextActiveStep,
            consumerContext:
              contextPatch !== undefined
                ? mergeContext(prev.consumerContext, contextPatch)
                : prev.consumerContext,
          };
        });
      },
      [activeFlowId],
    );

    /** Direct retreat — pops history and updates flowState immediately. */
    const directRetreat = useCallback(() => {
      errorBoundaryRef.current?.resetError();
      setFlowState((prev) => {
        if (prev === null || prev.history.length === 0) return prev;
        const previousStep = prev.history[prev.history.length - 1];
        return {
          history: prev.history.slice(0, -1),
          activeStep: previousStep,
          consumerContext: prev.consumerContext,
        };
      });
    }, []);
    // #endregion doc:direct-navigate

    // #region doc:transition-navigate
    /** Replace any pending transition with the latest advance — used while phase is
     *  "exiting". Rapid successive navigations collapse into the most recent one. */
    const queueAdvance = useCallback(
      (nextStep: StepLoader, contextPatch?: unknown) => {
        if (flowIdRef.current !== activeFlowId) return;
        if (transitionEpochRef.current !== previousStepEpochRef.current) return;
        transitionQueueRef.current = [
          {
            type: "advance",
            stepLoader: nextStep,
            contextPatch,
          },
        ];
      },
      [activeFlowId],
    );

    /** Replace any pending transition with the latest retreat — used while phase is
     *  "exiting". Rapid successive navigations collapse into the most recent one. */
    const queueRetreat = useCallback(() => {
      if (flowIdRef.current !== activeFlowId) return;
      if (transitionEpochRef.current !== previousStepEpochRef.current) return;
      transitionQueueRef.current = [{ type: "retreat" }];
    }, [activeFlowId]);

    /** Transition-aware advance: queues if exiting, else starts a transition. */
    const transitionAdvance = useCallback(
      (nextStep: StepLoader, contextPatch?: unknown) => {
        if (flowIdRef.current !== activeFlowId) return;
        if (transitionEpochRef.current !== currentStepEpochRef.current) return;
        if (phaseRef.current === "exiting") {
          transitionQueueRef.current = [
            {
              type: "advance",
              stepLoader: nextStep,
              contextPatch,
            },
          ];
          return;
        }
        if (flowIdRef.current !== activeFlowId) return;
        let nextActiveStep: ComponentType;
        try {
          nextActiveStep = normalizeStepLoader(nextStep);
        } catch (error) {
          reportLoaderError("advance", error);
          throw error;
        }
        if (flowIdRef.current !== activeFlowId) return;
        errorBoundaryRef.current?.resetError();
        previousStepEpochRef.current = currentStepEpochRef.current;
        transitionEpochRef.current += 1;
        previousRecordRef.current = currentRecordRef.current;
        currentRecordRef.current = createStepRecord(nextActiveStep);
        setFlowState((prev) => {
          if (prev === null) return prev;
          previousStepContextRef.current = prev.consumerContext;
          return {
            history: [...prev.history, prev.activeStep],
            activeStep: nextActiveStep,
            consumerContext:
              contextPatch !== undefined
                ? mergeContext(prev.consumerContext, contextPatch)
                : prev.consumerContext,
          };
        });
        transitionKeyRef.current += 1;
        setPhaseValue("exiting");
      },
      [activeFlowId, createStepRecord, setPhaseValue],
    );

    /** Transition-aware retreat: queues if exiting, else starts a transition.
     *  A retreat from the first step (empty history) is a no-op. */
    const transitionRetreat = useCallback(() => {
      if (flowIdRef.current !== activeFlowId) return;
      if (transitionEpochRef.current !== currentStepEpochRef.current) return;
      if (flowState === null || flowState.history.length === 0) return;
      if (phaseRef.current === "exiting") {
        transitionQueueRef.current = [{ type: "retreat" }];
        return;
      }
      errorBoundaryRef.current?.resetError();
      previousStepEpochRef.current = currentStepEpochRef.current;
      transitionEpochRef.current += 1;
      previousRecordRef.current = currentRecordRef.current;
      currentRecordRef.current = createStepRecord(flowState.history[flowState.history.length - 1]);
      setFlowState((prev) => {
        if (prev === null || prev.history.length === 0) return prev;
        previousStepContextRef.current = prev.consumerContext;
        const historyPrev = prev.history[prev.history.length - 1];
        return {
          history: prev.history.slice(0, -1),
          activeStep: historyPrev,
          consumerContext: prev.consumerContext,
        };
      });
      transitionKeyRef.current += 1;
      setPhaseValue("exiting");
    }, [activeFlowId, createStepRecord, flowState, setPhaseValue]);
    // #endregion doc:transition-navigate

    useImperativeHandle(
      ref,
      () => ({
        activate(
          stepLoader: StepLoader,
          initialContext?: unknown,
          onResolve?: (value?: unknown) => void,
          onAbort?: (reason?: unknown) => void,
          onActivated?: () => void,
        ) {
          const currentFlowId = flowIdRef.current;
          let activeStep: ComponentType;
          try {
            activeStep = normalizeStepLoader(stepLoader);
          } catch (error) {
            reportLoaderError("activate", error);
            throw error;
          }
          if (flowIdRef.current !== currentFlowId) return;
          errorBoundaryRef.current?.resetError();
          flowIdRef.current += 1;
          resolveRef.current = onResolve ?? null;
          abortRef.current = onAbort ?? null;
          // Reset transition state for the new flow.
          currentRecordRef.current = null;
          previousRecordRef.current = null;
          transitionQueueRef.current = [];
          transitionEpochRef.current = 0;
          currentStepEpochRef.current = 0;
          previousStepEpochRef.current = 0;
          setPhaseValue("exited");
          setFlowState({
            history: [],
            activeStep,
            consumerContext: initialContext,
          });
          onActivated?.();
        },
      }),
      [setPhaseValue],
    );

    // biome-ignore lint/correctness/useExhaustiveDependencies: idle callbacks are stable
    const idleContextValue: FlowContextValue = useMemo(
      () => ({
        consumerContext: lastConsumerContextRef.current,
        resolve: () => {
          throw new Error(
            "FlowOutlet resolve() called while no flow is active. These callbacks are only valid during an active flow.",
          );
        },
        abort: () => {
          throw new Error(
            "FlowOutlet abort() called while no flow is active. These callbacks are only valid during an active flow.",
          );
        },
      }),
      [flowState],
    );

    if (flowState === null) {
      return (
        <FlowContext.Provider value={idleContextValue}>
          {props.children ?? null}
        </FlowContext.Provider>
      );
    }

    const ActiveStep = flowState.activeStep;

    // Capture the current flow ID so that stale closures (e.g. async
    // callbacks from a previous flow's step) no-op instead of resolving
    // or aborting the wrong flow.
    const capturedFlowId = flowIdRef.current;

    const guardedResolve = (value?: unknown) => {
      if (flowIdRef.current !== capturedFlowId) return;
      handleResolve(value);
    };

    const guardedAbort = (reason?: unknown) => {
      if (flowIdRef.current !== capturedFlowId) return;
      handleAbort(reason);
    };

    // Outer context — available to chrome and idle children.
    const flowContextValue: FlowContextValue = {
      consumerContext: flowState.consumerContext,
      resolve: guardedResolve,
      abort: guardedAbort,
    };

    // #region doc:transition-render
    if (props.transition) {
      // --- Transition mode ---

      // Sync the entering step's epoch with the current transition epoch.
      // This ensures the newly-mounted step can dispatch its own transition.
      currentStepEpochRef.current = transitionEpochRef.current;

      // Adopt the active step into a record when none exists yet (flow was
      // activated before the transition prop was present).
      if (currentRecordRef.current === null) {
        currentRecordRef.current = createStepRecord(ActiveStep);
      }
      const currentRecord = currentRecordRef.current;
      const previousRecord = previousRecordRef.current;

      // Exiting step context: navigation calls always enqueue.
      const exitingStepContextValue: StepContextValue = {
        advance: queueAdvance,
        retreat: queueRetreat,
        resolve: guardedResolve,
        abort: guardedAbort,
        consumerContext: previousStepContextRef.current,
      };

      // Entering/current step context: navigation is transition-aware.
      const enteringStepContextValue: StepContextValue = {
        advance: transitionAdvance,
        retreat: transitionRetreat,
        resolve: guardedResolve,
        abort: guardedAbort,
        consumerContext: flowState.consumerContext,
      };

      // Each record's subtree renders through a keyed portal into its stable
      // host, so when the current record becomes the previous record its
      // instance (with boundary/context wrappers) is retained — only the
      // context value and slot placement change.
      const renderStepPortal = (
        record: StepRecord,
        contextValue: StepContextValue,
        isCurrent: boolean,
      ) => {
        const StepComponent = record.Component;
        return createPortal(
          <StepContext.Provider value={contextValue}>
            <FlowErrorBoundary
              ref={isCurrent ? errorBoundaryRef : null}
              failedStep={StepComponent}
              errorStep={props.errorStep}
            >
              <Suspense fallback={props.fallback ?? null}>
                <StepComponent />
              </Suspense>
            </FlowErrorBoundary>
          </StepContext.Provider>,
          record.host,
          `step-${record.id}`,
        );
      };

      const transitionOutput = props.transition({
        previousStep: previousRecord ? (
          <StepSlot key={previousRecord.id} host={previousRecord.host} />
        ) : null,
        nextStep: <StepSlot key={currentRecord.id} host={currentRecord.host} />,
        phase,
        onExited: handleExited,
        transitionKey: transitionKeyRef.current,
      });

      return (
        <FlowContext.Provider value={flowContextValue}>
          {previousRecord ? renderStepPortal(previousRecord, exitingStepContextValue, false) : null}
          {renderStepPortal(currentRecord, enteringStepContextValue, true)}
          {props.chrome ? props.chrome(transitionOutput) : transitionOutput}
        </FlowContext.Provider>
      );
    }
    // #endregion doc:transition-render

    // --- Direct mode (no transition prop) ---

    const stepContextValue: StepContextValue = {
      advance: directAdvance,
      retreat: directRetreat,
      resolve: guardedResolve,
      abort: guardedAbort,
      consumerContext: flowState.consumerContext,
    };

    const stepSlot = (
      <StepContext.Provider value={stepContextValue}>
        <FlowErrorBoundary
          ref={errorBoundaryRef}
          failedStep={ActiveStep}
          errorStep={props.errorStep}
        >
          <Suspense fallback={props.fallback ?? null}>
            <ActiveStep />
          </Suspense>
        </FlowErrorBoundary>
      </StepContext.Provider>
    );

    return (
      <FlowContext.Provider value={flowContextValue}>
        {props.chrome ? props.chrome(stepSlot) : stepSlot}
      </FlowContext.Provider>
    );
  },
);
