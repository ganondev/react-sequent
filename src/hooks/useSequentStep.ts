import { useContext } from "react";
import { StepContext } from "../internal/context";

export function useSequentStep<TResult = unknown>() {
  const ctx = useContext(StepContext);

  if (ctx === null) {
    throw new Error(
      "useSequentStep() must be called from within a rendered step component. " +
        "It is not available to chrome components or idle children — " +
        "use useSequentContext() for flow-level access instead. " +
        "(Legacy name: useStep())",
    );
  }

  return {
    advance: ctx.advance,
    retreat: ctx.retreat,
    resolve: ctx.resolve as (value?: TResult) => void,
    abort: ctx.abort,
    context: ctx.consumerContext as unknown,
  };
}
