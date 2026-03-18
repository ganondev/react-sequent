import { useRef } from "react";
import { FlowOutlet, type FlowOutletHandle } from "../components/FlowOutlet";
import { useFlowInit } from "../hooks/useFlowInit";
import { useStep } from "../hooks/useStep";

export default {
  title: "Flow/BasicFlow",
};

function Step2() {
  const { retreat, resolve } = useStep();
  return (
    <div style={{ padding: 16, display: "flex", gap: 8 }}>
      <p>Step 2</p>
      <button type="button" onClick={() => retreat()}>
        Back
      </button>
      <button type="button" onClick={() => resolve()}>
        Finish
      </button>
    </div>
  );
}

function Step1() {
  const { advance } = useStep();
  return (
    <div style={{ padding: 16 }}>
      <p>Step 1</p>
      <button type="button" onClick={() => advance(Step2)}>
        Next
      </button>
    </div>
  );
}

function Host() {
  const ref = useRef<FlowOutletHandle>(null);
  const { initFlow } = useFlowInit();

  return (
    <div style={{ padding: 16 }}>
      <button type="button" onClick={() => initFlow(Step1, ref)}>
        Start Flow
      </button>
      <FlowOutlet ref={ref} />
    </div>
  );
}

export const Default = {
  render: () => <Host />,
};
