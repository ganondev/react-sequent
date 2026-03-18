/**
 * useFlowInit — hook for flow entry points only.
 *
 * Returns `initFlow` (starts a flow with a step loader + initial context).
 * The consumer creates a ref and passes it to both `initFlow` and
 * `<FlowOutlet ref={...} />` to associate the flow with an outlet.
 *
 * Has no knowledge of step internals.
 */
import { type RefObject, useCallback } from "react";
import type { FlowOutletHandle } from "../components/FlowOutlet";
import { normalizeStepLoader, type StepLoader } from "../internal/normalizer";

export function useFlowInit() {
  const initFlow = useCallback(
    (
      stepLoader: StepLoader,
      ref: RefObject<FlowOutletHandle | null>,
      initialContext?: unknown,
    ): void => {
      if (!ref.current) {
        throw new Error(
          "FlowOutlet ref is not attached. Ensure <FlowOutlet ref={...} /> is mounted before calling initFlow.",
        );
      }
      ref.current.activate(normalizeStepLoader(stepLoader), initialContext);
    },
    [],
  );

  return { initFlow };
}
