/**
 * useStep — hook for step components only.
 *
 * Returns advance, retreat, resolve, abort, and context.
 * Has no access to initializer-level capabilities.
 *
 * Throws immediately if called outside the active step's subtree (e.g. from
 * a chrome component or an idle child). Use useFlowContext() for flow-level
 * access in those contexts.
 */
import { useContext } from "react";
import { StepContext } from "../internal/context";

// #region doc:full
export function useStep<TResult = unknown>() {
  const ctx = useContext(StepContext);

  if (ctx === null) {
    throw new Error(
      "useStep() must be called from within a rendered step component. " +
        "It is not available to chrome components or idle children — " +
        "use useFlowContext() for flow-level access instead.",
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
// #endregion doc:full
