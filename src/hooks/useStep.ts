/**
 * useStep — hook for step components only.
 *
 * Returns advance, retreat, resolve, abort, and context.
 * Has no access to initializer-level capabilities.
 */
import { useFlowInternalContext } from "../internal/context";

export function useStep() {
  const { advance, retreat, resolve, abort, consumerContext } = useFlowInternalContext();

  return {
    advance,
    retreat,
    resolve,
    abort,
    context: consumerContext,
  };
}
