import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { act, cleanup, render, screen } from "@testing-library/react";
import type React from "react";
import { useEffect, useRef } from "react";
import { expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { FlowOutlet, type FlowOutletHandle } from "../components/FlowOutlet";
import { useFlowInit } from "../hooks/useFlowInit";
import { useStep } from "../hooks/useStep";

// ── Fixture step components ──────────────────────────────────────────

function ThrowingStep(): React.ReactElement {
  throw new Error("Step exploded!");
}

function HealthyStep(): React.ReactElement {
  return <div>Healthy step rendered</div>;
}

function ResolvingStep(): null {
  const { resolve } = useStep();
  useEffect(() => {
    resolve();
  }, [resolve]);
  return null;
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
        capturedInitFlow(() => ThrowingStep, capturedRef);
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
        capturedInitFlow(() => ThrowingStep, capturedRef);
      });
    });

    Then("the outlet element is still in the document", () => {
      expect(screen.getByTestId("outlet-wrapper")).toBeInTheDocument();
      consoleSpy.mockRestore();
    });
  });

  // ── Scenario 3 ─────────────────────────────────────────────────────
  Scenario(
    "Re-activating after an error resets the error boundary",
    ({ Given, And, When, Then }) => {
      let capturedRef: React.RefObject<FlowOutletHandle | null>;
      let capturedInitFlow: ReturnType<typeof useFlowInit>["initFlow"];
      let consoleSpy: ReturnType<typeof vi.spyOn>;

      Given("a host with FlowOutlet configured with an errorFallback", () => {
        cleanup();
        consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        function TestHost() {
          const ref = useRef<FlowOutletHandle>(null);
          const { initFlow } = useFlowInit();
          capturedRef = ref;
          capturedInitFlow = initFlow;
          return <FlowOutlet ref={ref} errorFallback={<div>Something went wrong</div>} />;
        }

        render(<TestHost />);
      });

      And("the flow has been activated with a step that throws during render", () => {
        act(() => {
          capturedInitFlow(() => ThrowingStep, capturedRef);
        });
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      });

      When("the outlet is re-activated with a healthy step", () => {
        act(() => {
          capturedRef.current?.activate(() => HealthyStep);
        });
      });

      Then("the healthy step is rendered", () => {
        expect(screen.getByText("Healthy step rendered")).toBeInTheDocument();
      });

      And("the errorFallback is no longer visible", () => {
        expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
        consoleSpy.mockRestore();
      });
    },
  );

  // ── Scenario 4 ─────────────────────────────────────────────────────
  Scenario(
    "Tearing down after an error and re-activating shows the new step",
    ({ Given, And, When, Then }) => {
      let capturedRef: React.RefObject<FlowOutletHandle | null>;
      let capturedInitFlow: ReturnType<typeof useFlowInit>["initFlow"];
      let consoleSpy: ReturnType<typeof vi.spyOn>;

      Given("a host with FlowOutlet configured with an errorFallback", () => {
        cleanup();
        consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        function TestHost() {
          const ref = useRef<FlowOutletHandle>(null);
          const { initFlow } = useFlowInit();
          capturedRef = ref;
          capturedInitFlow = initFlow;
          return <FlowOutlet ref={ref} errorFallback={<div>Something went wrong</div>} />;
        }

        render(<TestHost />);
      });

      And("the flow has been activated with a step that throws during render", () => {
        act(() => {
          capturedInitFlow(() => ThrowingStep, capturedRef);
        });
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      });

      When("the flow is torn down by resolving", () => {
        // Activate a step that immediately calls resolve(), setting flowState to null
        act(() => {
          capturedRef.current?.activate(() => ResolvingStep);
        });
      });

      And("the outlet is activated with a healthy step", () => {
        act(() => {
          capturedRef.current?.activate(() => HealthyStep);
        });
      });

      Then("the healthy step is rendered", () => {
        expect(screen.getByText("Healthy step rendered")).toBeInTheDocument();
        consoleSpy.mockRestore();
      });
    },
  );
});
