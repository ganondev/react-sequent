import { useContext } from "react";
import { FlowContext } from "../internal/context";

export interface SequentContextReturn<TContext = unknown> {
  context: TContext;
  resolve: (value?: unknown) => void;
  abort: (reason?: unknown) => void;
}

export function useSequentContext<TContext = unknown>(): SequentContextReturn<TContext> {
  const ctx = useContext(FlowContext);
  if (ctx === null) {
    throw new Error(
      "useSequentContext must be used within a <SequentOutlet /> provider boundary",
    );
  }

  return {
    context: ctx.consumerContext as TContext,
    resolve: ctx.resolve,
    abort: ctx.abort,
  };
}