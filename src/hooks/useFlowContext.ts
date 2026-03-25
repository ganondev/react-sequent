import {
  type SequentContextReturn,
  useSequentContext,
} from "./useSequentContext";

export type FlowContextReturn<TContext = unknown> = SequentContextReturn<TContext>;

export function useFlowContext<TContext = unknown>(): FlowContextReturn<TContext> {
  return useSequentContext<TContext>();
}
