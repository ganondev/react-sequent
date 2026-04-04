import {
  type ComponentPropsWithoutRef,
  type FunctionComponent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { FlowOutlet, type FlowOutletHandle } from "../components/FlowOutlet";
import type { StepLoader } from "../internal/normalizer";

export type SequentOutletProps = ComponentPropsWithoutRef<typeof FlowOutlet>;

export type SequentResult<TResult = unknown> =
  | { status: "resolved"; value: TResult }
  | { status: "aborted"; reason: unknown };

export interface UseSequentFlowReturn<TResult = unknown> {
  init: (stepLoader: StepLoader, initialContext?: unknown) => void;
  status: "idle" | "active";
  result: SequentResult<TResult> | null;
  SequentOutlet: FunctionComponent<SequentOutletProps>;
}

export function useSequentFlow<TResult = unknown>(): UseSequentFlowReturn<TResult> {
  const outletRef = useRef<FlowOutletHandle>(null);
  const [status, setStatus] = useState<"idle" | "active">("idle");
  const [result, setResult] = useState<SequentResult<TResult> | null>(null);

  const init = useCallback((stepLoader: StepLoader, initialContext?: unknown): void => {
    const outlet = outletRef.current;
    // TODO instead of throwing, we could queue the init call and execute it once the outlet mounts.
    // This would allow init() to be called before the outlet is rendered.
    // This reduces edge cases and dev friction.
    if (!outlet) {
      throw new Error(
        "SequentOutlet is not mounted. Ensure <SequentOutlet /> is rendered before calling init().",
      );
    }

    outlet.activate(
      stepLoader,
      initialContext,
      (value) => {
        setResult({ status: "resolved", value: value as TResult });
        setStatus("idle");
      },
      (reason) => {
        setResult({ status: "aborted", reason });
        setStatus("idle");
      },
      () => {
        setStatus("active");
      },
    );
  }, []);

  const SequentOutlet = useMemo<FunctionComponent<SequentOutletProps>>(() => {
    function BoundSequentOutlet(props: SequentOutletProps) {
      return <FlowOutlet ref={outletRef} {...props} />;
    }

    BoundSequentOutlet.displayName = "SequentOutlet";
    return BoundSequentOutlet;
  }, []);

  return {
    init,
    status,
    result,
    SequentOutlet,
  };
}
