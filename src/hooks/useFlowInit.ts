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
import type { StepLoader } from "../internal/normalizer";

// #region doc:signature
export function useFlowInit<TResult = unknown>() {
  const initFlow = useCallback(
    (
      stepLoader: StepLoader,
      ref: RefObject<FlowOutletHandle | null>,
      initialContext?: unknown,
    ): Promise<TResult> => {
      // #endregion doc:signature
      const outlet = ref.current;
      if (!outlet) {
        throw new Error(
          "FlowOutlet ref is not attached. Ensure <FlowOutlet ref={...} /> is mounted before calling initFlow.",
        );
      }
      const promise = new Promise<TResult>((resolve, reject) => {
        outlet.activate(
          stepLoader,
          initialContext,
          (value) => resolve(value as TResult),
          (reason) => reject(reason),
        );
      });
      // Prevent unhandled rejection when the consumer ignores the returned
      // promise (e.g. fire-and-forget usage). The consumer can still
      // await/catch the returned promise normally.
      promise.catch(() => {});
      return promise;
    },
    [],
  );

  return { initFlow };
}
