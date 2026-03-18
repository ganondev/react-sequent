/**
 * FlowOutlet — renders wherever the consumer places it.
 *
 * Owns the internal React context provider, acts as the Suspense
 * boundary for async step loading, and accepts a `fallback` prop.
 */
import {
  type ComponentType,
  forwardRef,
  type ReactNode,
  Suspense,
  useCallback,
  useImperativeHandle,
  useState,
} from "react";
import { FlowContext, type FlowContextValue } from "../internal/context";
import type { StepLoader } from "../internal/normalizer";
import { normalizeStepLoader } from "../internal/normalizer";

/** Imperative handle exposed by FlowOutlet via its forwarded ref. */
export interface FlowOutletHandle {
  /** Activate a flow, rendering the given step component in this outlet. */
  activate: (stepLoader: StepLoader, initialContext?: unknown) => void;
}

interface FlowState {
  history: ComponentType[];
  activeStep: ComponentType;
  consumerContext: unknown;
}

export const FlowOutlet = forwardRef<FlowOutletHandle, { fallback?: ReactNode }>(
  function FlowOutlet(props, ref) {
    const [flowState, setFlowState] = useState<FlowState | null>(null);

    const deactivate = useCallback(() => {
      setFlowState(null);
    }, []);

    const advance = useCallback((nextStep: StepLoader, contextPatch?: unknown) => {
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
        activate(stepLoader: StepLoader, initialContext?: unknown) {
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

    const contextValue: FlowContextValue = {
      history: flowState.history,
      activeStep: flowState.activeStep,
      consumerContext: flowState.consumerContext,
      resolve: deactivate,
      abort: deactivate,
      advance,
      retreat,
    };

    return (
      <FlowContext.Provider value={contextValue}>
        <Suspense fallback={props.fallback ?? null}>
          <ActiveStep />
        </Suspense>
      </FlowContext.Provider>
    );
  },
);
