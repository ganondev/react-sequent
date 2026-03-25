import {
  type ComponentPropsWithoutRef,
  type FunctionComponent,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { FlowOutlet, type FlowOutletHandle } from "../components/FlowOutlet";
import type { StepLoader } from "../internal/normalizer";

export type SequentOutletProps = ComponentPropsWithoutRef<typeof FlowOutlet>;

export interface UseSequentFlowReturn<TResult = unknown> {
  init: (stepLoader: StepLoader, initialContext?: unknown) => Promise<TResult>;
  SequentOutlet: FunctionComponent<SequentOutletProps>;
}

export function useSequentFlow<TResult = unknown>(): UseSequentFlowReturn<TResult> {
  const outletRef = useRef<FlowOutletHandle>(null);

  const init = useCallback(
    (stepLoader: StepLoader, initialContext?: unknown): Promise<TResult> => {
      const outlet = outletRef.current;
      if (!outlet) {
        throw new Error(
          "SequentOutlet is not mounted. Ensure <SequentOutlet /> is rendered before calling init().",
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

      promise.catch(() => {});
      return promise;
    },
    [],
  );

  const SequentOutlet = useMemo<FunctionComponent<SequentOutletProps>>(() => {
    function BoundSequentOutlet(props: SequentOutletProps) {
      return <FlowOutlet ref={outletRef} {...props} />;
    }

    BoundSequentOutlet.displayName = "SequentOutlet";
    return BoundSequentOutlet;
  }, []);

  return {
    init,
    SequentOutlet,
  };
}