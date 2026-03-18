import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { act, cleanup, render, screen } from "@testing-library/react";
import React, { useRef } from "react";
import { expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { FlowOutlet, type FlowOutletHandle } from "../components/FlowOutlet";
import { useFlowInit } from "../hooks/useFlowInit";
import { useStep } from "../hooks/useStep";

// ── Fixture step components ──────────────────────────────────────────
function SimpleStep() {
  return <div>Step Content</div>;
}

function ContextStep() {
  const { context } = useStep();
  const ctx = context as { title: string };
  return <div>{ctx.title}</div>;
}

const feature = await loadFeature("src/features/flow-init.feature");

describeFeature(feature, ({ Scenario }) => {
  // ── Scenario 1 ─────────────────────────────────────────────────────
  Scenario("Initialize a basic flow", ({ Given, When, Then }) => {
    let capturedInitFlow: ReturnType<typeof useFlowInit>["initFlow"];
    let capturedRef: React.RefObject<FlowOutletHandle | null>;

    Given("a host component with useFlowInit and FlowOutlet", () => {
      cleanup();

      function TestHost() {
        const ref = useRef<FlowOutletHandle>(null);
        const { initFlow } = useFlowInit();
        capturedInitFlow = initFlow;
        capturedRef = ref;
        return <FlowOutlet ref={ref} />;
      }

      render(<TestHost />);
      expect(capturedInitFlow).toBeDefined();
      expect(capturedRef).toBeDefined();
    });

    When("initFlow is called with a sync step loader", () => {
      act(() => {
        capturedInitFlow(SimpleStep, capturedRef);
      });
    });

    Then("the step renders inside the outlet", () => {
      expect(screen.getByText("Step Content")).toBeInTheDocument();
    });
  });

  // ── Scenario 2 ─────────────────────────────────────────────────────
  Scenario("Initialize a flow with initial context", ({ Given, When, Then }) => {
    let capturedInitFlow: ReturnType<typeof useFlowInit>["initFlow"];
    let capturedRef: React.RefObject<FlowOutletHandle | null>;

    Given("a host component with useFlowInit and FlowOutlet", () => {
      cleanup();

      function TestHost() {
        const ref = useRef<FlowOutletHandle>(null);
        const { initFlow } = useFlowInit();
        capturedInitFlow = initFlow;
        capturedRef = ref;
        return <FlowOutlet ref={ref} />;
      }

      render(<TestHost />);
      expect(capturedInitFlow).toBeDefined();
      expect(capturedRef).toBeDefined();
    });

    When("initFlow is called with a step loader and initial context", () => {
      act(() => {
        capturedInitFlow(ContextStep, capturedRef, { title: "hello" });
      });
    });

    Then("the step can read the context via useStep", () => {
      expect(screen.getByText("hello")).toBeInTheDocument();
    });
  });
});
