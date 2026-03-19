import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { act, cleanup, render, screen } from "@testing-library/react";
import type React from "react";
import { useRef } from "react";
import { expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { FlowOutlet, type FlowOutletHandle } from "../components/FlowOutlet";
import { useFlowInit } from "../hooks/useFlowInit";

// ── Fixture step components ──────────────────────────────────────────

function ThrowingStep(): React.ReactElement {
  throw new Error("Step exploded!");
}

const feature = await loadFeature("src/features/error-boundary.feature");

describeFeature(feature, ({ Scenario }) => {
  // ── Scenario 1 ─────────────────────────────────────────────────────
  Scenario("A step that throws renders the errorFallback", ({ Given, When, Then, And }) => {
    let capturedInitFlow: ReturnType<typeof useFlowInit>["initFlow"];
    let capturedRef: React.RefObject<FlowOutletHandle | null>;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    Given("a host with FlowOutlet configured with an errorFallback", () => {
      cleanup();
      consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      function TestHost() {
        const ref = useRef<FlowOutletHandle>(null);
        const { initFlow } = useFlowInit();
        capturedInitFlow = initFlow;
        capturedRef = ref;
        return <FlowOutlet ref={ref} errorFallback={<div>Something went wrong</div>} />;
      }

      render(<TestHost />);
      expect(capturedInitFlow).toBeDefined();
    });

    When("initFlow is called with a step that throws during render", () => {
      act(() => {
        capturedInitFlow(ThrowingStep, capturedRef);
      });
    });

    Then("the errorFallback is rendered", () => {
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    And("the throwing step is not visible", () => {
      expect(screen.queryByText("Step exploded!")).not.toBeInTheDocument();
      consoleSpy.mockRestore();
    });
  });

  // ── Scenario 2 ─────────────────────────────────────────────────────
  Scenario("The outlet remains mounted after an error", ({ Given, When, Then }) => {
    let capturedInitFlow: ReturnType<typeof useFlowInit>["initFlow"];
    let capturedRef: React.RefObject<FlowOutletHandle | null>;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    Given("a host with FlowOutlet configured with an errorFallback", () => {
      cleanup();
      consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      function TestHost() {
        const ref = useRef<FlowOutletHandle>(null);
        const { initFlow } = useFlowInit();
        capturedInitFlow = initFlow;
        capturedRef = ref;
        return (
          <div data-testid="outlet-wrapper">
            <FlowOutlet ref={ref} errorFallback={<div>Something went wrong</div>} />
          </div>
        );
      }

      render(<TestHost />);
      expect(capturedInitFlow).toBeDefined();
    });

    When("initFlow is called with a step that throws during render", () => {
      act(() => {
        capturedInitFlow(ThrowingStep, capturedRef);
      });
    });

    Then("the outlet element is still in the document", () => {
      expect(screen.getByTestId("outlet-wrapper")).toBeInTheDocument();
      consoleSpy.mockRestore();
    });
  });
});
