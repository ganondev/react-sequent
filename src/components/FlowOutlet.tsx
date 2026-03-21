/**
 * FlowOutlet — renders wherever the consumer places it.
 *
 * Owns the internal React context provider, wraps children in a
 * `FlowErrorBoundary` for step-level error handling, acts as the
 * Suspense boundary for async step loading, and accepts `fallback`
 * and `errorFallback` props.
 */
import {
  type ComponentType,
  forwardRef,
  type ReactNode,
  Suspense,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { FlowContext, type FlowContextValue } from "../internal/context";
import { FlowErrorBoundary } from "../internal/FlowErrorBoundary";
import type { StepLoader } from "../internal/normalizer";
import { normalizeStepLoader } from "../internal/normalizer";

/** Imperative handle exposed by FlowOutlet via its forwarded ref. */
export interface FlowOutletHandle {
  /** Activate a flow, rendering the given step component in this outlet. */
  activate: (
    stepLoader: StepLoader,
    initialContext?: unknown,
    onResolve?: (value?: unknown) => void,
    onAbort?: (reason?: unknown) => void,
  ) => void;
}

interface FlowState {
  history: ComponentType[];
  activeStep: ComponentType;
  consumerContext: unknown;
}

export const FlowOutlet = forwardRef<
  FlowOutletHandle,
  { fallback?: ReactNode; errorFallback?: ReactNode; children?: ReactNode }
>(function FlowOutlet(props, ref) {
  const [flowState, setFlowState] = useState<FlowState | null>(null);
  const errorBoundaryRef = useRef<FlowErrorBoundary>(null);
  const resolveRef = useRef<((value?: unknown) => void) | null>(null);
  const abortRef = useRef<((reason?: unknown) => void) | null>(null);
  /** Monotonically increasing token — invalidates stale resolve/abort closures. */
  const flowIdRef = useRef(0);

  const handleResolve = useCallback((value?: unknown) => {
    const cb = resolveRef.current;
    resolveRef.current = null;
    abortRef.current = null;
    setFlowState(null);
    cb?.(value);
  }, []);

  const handleAbort = useCallback((reason?: unknown) => {
    const cb = abortRef.current;
    resolveRef.current = null;
    abortRef.current = null;
    setFlowState(null);
    cb?.(reason);
  }, []);

  const advance = useCallback((nextStep: StepLoader, contextPatch?: unknown) => {
    errorBoundaryRef.current?.resetError();
    setFlowState((prev) => {
      if (prev === null) return null;
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
        activeStep: normalizeStepLoader(nextStep),
        consumerContext: newContext,
      };
    });
  }, []);

  const retreat = useCallback(() => {
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
      ) {
        errorBoundaryRef.current?.resetError();
        flowIdRef.current += 1;
        resolveRef.current = onResolve ?? null;
        abortRef.current = onAbort ?? null;
        setFlowState({
          history: [],
          activeStep: normalizeStepLoader(stepLoader),
          consumerContext: initialContext,
        });
      },
    }),
    [],
  );

  if (flowState === null) {
    return null;
  }

  const ActiveStep = flowState.activeStep;

  // Capture the current flow ID so that stale closures (e.g. async
  // callbacks from a previous flow's step) no-op instead of resolving
  // or aborting the wrong flow.
  const capturedFlowId = flowIdRef.current;

  const contextValue: FlowContextValue = {
    history: flowState.history,
    activeStep: flowState.activeStep,
    consumerContext: flowState.consumerContext,
    resolve: (value?: unknown) => {
      if (flowIdRef.current !== capturedFlowId) return;
      handleResolve(value);
    },
    abort: (reason?: unknown) => {
      if (flowIdRef.current !== capturedFlowId) return;
      handleAbort(reason);
    },
    advance,
    retreat,
  };

  return (
    <FlowContext.Provider value={contextValue}>
      {props.children}
      <FlowErrorBoundary ref={errorBoundaryRef} errorFallback={props.errorFallback}>
        <Suspense fallback={props.fallback ?? null}>
          <ActiveStep />
        </Suspense>
      </FlowErrorBoundary>
    </FlowContext.Provider>
  );
});
