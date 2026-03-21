import { useContext } from "react";
import { FlowContext } from "../internal/context";

export function useFlowContext<TContext = unknown>(): TContext {
  const ctx = useContext(FlowContext);
  if (ctx === null) {
    throw new Error("useFlowContext must be used within a <FlowOutlet /> provider boundary");
  }
  return ctx.consumerContext as TContext;
}
