/**
 * useStep — hook for step components only.
 *
 * Returns advance, retreat, resolve, abort, and context.
 * Has no access to initializer-level capabilities.
 */
import { useFlowInternalContext } from "../internal/context";
import { normalizeStepLoader, type StepLoader } from "../internal/normalizer";

export function useStep() {
  const {
    advance: rawAdvance,
    retreat,
    resolve,
    abort,
    consumerContext,
  } = useFlowInternalContext();

  const advance = (nextStep: StepLoader, contextPatch?: unknown) =>
    rawAdvance(normalizeStepLoader(nextStep), contextPatch);

  return {
    advance,
    retreat,
    resolve,
    abort,
    context: consumerContext,
  };
}
