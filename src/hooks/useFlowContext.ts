import { useContext } from "react";
import { FlowContext } from "../internal/context";

export interface FlowContextReturn<TContext = unknown> {
  /** The current consumer-owned flow context value. */
  context: TContext;
  /** End the flow successfully. Only callable during an active flow. */
  resolve: (value?: unknown) => void;
  /** End the flow without completing. Only callable during an active flow. */
  abort: (reason?: unknown) => void;
}

// #region doc:full
export function useFlowContext<TContext = unknown>(): FlowContextReturn<TContext> {
  const ctx = useContext(FlowContext);
  if (ctx === null) {
    throw new Error("useFlowContext must be used within a <FlowOutlet /> provider boundary");
  }
  return {
    context: ctx.consumerContext as TContext,
    resolve: ctx.resolve,
    abort: ctx.abort,
  };
}
// #endregion doc:full
