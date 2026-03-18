/**
 * Internal flow context — implementation detail.
 * Consumers never interact with this directly.
 */
import { type ComponentType, createContext, useContext } from "react";

/** Internal type alias for a React component that renders a single step. */
type StepLoader = ComponentType;

export interface FlowContextValue<TResult = unknown> {
  /** Stack of step components that have been loaded (most recent last). */
  history: StepLoader[];
  /** The step currently being rendered, or null when idle. */
  activeStep: StepLoader | null;
  /** Opaque consumer-owned context value carried through the flow. */
  consumerContext: unknown;
  /** Call when the flow completes successfully. */
  resolve: (value?: TResult) => void;
  /** Call when the flow exits without completing. */
  abort: (reason?: unknown) => void;
  /** Push the current step to history and render the next step. */
  advance: (nextStep: StepLoader, contextPatch?: unknown) => void;
  /** Pop the last step from history and render it. */
  retreat: () => void;
}

export const FlowContext = createContext<FlowContextValue | null>(null);

export function useFlowInternalContext(): FlowContextValue {
  const ctx = useContext(FlowContext);
  if (ctx === null) {
    throw new Error("useFlowInternalContext must be used within a FlowOutlet");
  }
  return ctx;
}
