/**
 * FlowOutlet — renders wherever the consumer places it.
 *
 * Owns the internal React context provider, wraps children in a
 * `FlowErrorBoundary` for step-level error handling, acts as the
 * Suspense boundary for async step loading, and accepts `fallback`
 * and `errorStep` props.
 */
import {
  type ComponentType,
  forwardRef,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlowContext,
  type FlowContextValue,
  StepContext,
  type StepContextValue,
} from "../internal/context";
import {
  type ErrorStepContext,
  type ErrorStepPhase,
  FlowErrorBoundary,
} from "../internal/FlowErrorBoundary";
import type { StepLoader } from "../internal/normalizer";
import { normalizeStepLoader } from "../internal/normalizer";

export interface FlowOutletProps {
  children?: ReactNode;
  fallback?: ReactNode;
  errorStep?: (context: ErrorStepContext) => ReactNode;
  chrome?: (children: ReactNode) => ReactNode;
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

function reportLoaderError(phase: "activate" | "advance", error: unknown) {
  console.error(
    `FlowOutlet.${phase}() failed while normalizing a step loader. The flow was left idle.`,
    error,
  );
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
    const errorPhaseRef = useRef<ErrorStepPhase>("render");
    /** Retains the last consumer context value after a flow resolves, so idle children can read it via `useSequentContext`. */
    const lastConsumerContextRef = useRef<unknown>(undefined);

    useEffect(() => {
      errorPhaseRef.current = "render";
    }, [flowState?.activeStep]);

    const handleResolve = useCallback((value?: unknown) => {
      const cb = resolveRef.current;
      resolveRef.current = null;
      abortRef.current = null;
      flowIdRef.current += 1;
      setFlowState((prev) => {
        if (prev !== null) {
          lastConsumerContextRef.current = prev.consumerContext;
        }
        return null;
      });
      cb?.(value);
    }, []);

    const handleAbort = useCallback((reason?: unknown) => {
      const cb = abortRef.current;
      resolveRef.current = null;
      abortRef.current = null;
      flowIdRef.current += 1;
      setFlowState(null);
      cb?.(reason);
    }, []);

    const activeFlowId = flowIdRef.current;

    const advance = useCallback(
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
        errorPhaseRef.current = "transition";
        errorBoundaryRef.current?.resetError();
        setFlowState((prev) => {
          if (prev === null) return prev;
          const newContext =
            contextPatch !== undefined
              ? typeof prev.consumerContext === "object" &&
                prev.consumerContext !== null &&
                typeof contextPatch === "object" &&
                contextPatch !== null
                ? {
                    ...(prev.consumerContext as Record<string, unknown>),
                    ...(contextPatch as Record<string, unknown>),
                  }
                : contextPatch
              : prev.consumerContext;
          return {
            history: [...prev.history, prev.activeStep],
            activeStep: nextActiveStep,
            consumerContext: newContext,
          };
        });
      },
      [activeFlowId],
    );

    const retreat = useCallback(() => {
      errorPhaseRef.current = "transition";
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
          const activeFlowId = flowIdRef.current;
          let activeStep: ComponentType;
          try {
            activeStep = normalizeStepLoader(stepLoader);
          } catch (error) {
            reportLoaderError("activate", error);
            throw error;
          }
          if (flowIdRef.current !== activeFlowId) return;
          errorPhaseRef.current = "render";
          errorBoundaryRef.current?.resetError();
          flowIdRef.current += 1;
          resolveRef.current = onResolve ?? null;
          abortRef.current = onAbort ?? null;
          setFlowState({
            history: [],
            activeStep,
            consumerContext: initialContext,
          });
          onActivated?.();
        },
      }),
      [],
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

    // Outer context — available to chrome components and idle children.
    const flowContextValue: FlowContextValue = {
      consumerContext: flowState.consumerContext,
      resolve: guardedResolve,
      abort: guardedAbort,
    };

    // Inner context — only injected inside the step slot subtree.
    const stepContextValue: StepContextValue = {
      advance,
      retreat,
      resolve: guardedResolve,
      abort: guardedAbort,
      consumerContext: flowState.consumerContext,
    };

    const stepSlot = (
      <StepContext.Provider value={stepContextValue}>
        <FlowErrorBoundary
          ref={errorBoundaryRef}
          failedStep={ActiveStep}
          phase={errorPhaseRef.current}
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
