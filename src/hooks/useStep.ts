/**
 * useStep — hook for step components only.
 *
 * Returns advance, retreat, resolve, abort, and context.
 * Has no access to initializer-level capabilities.
 */
import { useFlowInternalContext } from "../internal/context";
import { normalizeStepLoader, type StepLoader } from "../internal/normalizer";

function assertActiveStep(fnName: string, activeStep: unknown): void {
  if (activeStep === null) {
    throw new Error(
      `useStep(): "${fnName}" was called outside of an active flow step. ` +
        "The FlowOutlet is currently idle. " +
        "Only call useStep() transition functions from within a rendered step component.",
    );
  }
}

// #region doc:full
export function useStep<TResult = unknown>() {
  const {
    advance: rawAdvance,
    retreat: rawRetreat,
    resolve: rawResolve,
    abort: rawAbort,
    consumerContext,
    activeStep,
  } = useFlowInternalContext<TResult>();

  const advance = (nextStep: StepLoader, contextPatch?: unknown) => {
    assertActiveStep("advance", activeStep);
    rawAdvance(normalizeStepLoader(nextStep), contextPatch);
  };

  const retreat = () => {
    assertActiveStep("retreat", activeStep);
    rawRetreat();
  };

  const resolve = (value?: TResult) => {
    assertActiveStep("resolve", activeStep);
    rawResolve(value);
  };

  const abort = (reason?: unknown) => {
    assertActiveStep("abort", activeStep);
    rawAbort(reason);
  };

  return {
    advance,
    retreat,
    resolve,
    abort,
    context: consumerContext,
  };
}
// #endregion doc:full
