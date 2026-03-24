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

function SimpleStep() {
  return <div>Step Content</div>;
}

function ResolvingStep() {
  const { resolve } = useStep();
  useEffect(() => {
    resolve("done");
  }, [resolve]);
  return null;
}

const feature = await loadFeature("src/features/idle-children.feature");

describeFeature(feature, ({ Scenario }) => {
  // ── Scenario 1 ─────────────────────────────────────────────────────
  Scenario("Outlet renders children when idle", ({ Given, Then }) => {
    Given("a host with FlowOutlet containing children", () => {
      cleanup();

      function TestHost() {
        const ref = useRef<FlowOutletHandle>(null);
        return (
          <FlowOutlet ref={ref}>
            <button type="button">Start Flow</button>
          </FlowOutlet>
        );
      }

      render(<TestHost />);
    });

    Then("the children are visible", () => {
      expect(screen.getByText("Start Flow")).toBeInTheDocument();
    });
  });

  // ── Scenario 2 ─────────────────────────────────────────────────────
  Scenario(
    "Children are replaced by the active step when a flow starts",
    ({ Given, When, Then, And }) => {
      let capturedInitFlow: ReturnType<typeof useFlowInit>["initFlow"];
      let capturedRef: React.RefObject<FlowOutletHandle | null>;

      Given("a host with FlowOutlet containing children", () => {
        cleanup();

        function TestHost() {
          const ref = useRef<FlowOutletHandle>(null);
          const { initFlow } = useFlowInit();
          capturedInitFlow = initFlow;
          capturedRef = ref;
          return (
            <FlowOutlet ref={ref}>
              <button type="button">Start Flow</button>
            </FlowOutlet>
          );
        }

        render(<TestHost />);
        expect(screen.getByText("Start Flow")).toBeInTheDocument();
      });

      When("initFlow is called with a sync step", () => {
        act(() => {
          capturedInitFlow(() => SimpleStep, capturedRef);
        });
      });

      Then("the children are not visible", () => {
        expect(screen.queryByText("Start Flow")).not.toBeInTheDocument();
      });

      And("the step is rendered", () => {
        expect(screen.getByText("Step Content")).toBeInTheDocument();
      });
    },
  );

  // ── Scenario 3 ─────────────────────────────────────────────────────
  Scenario("Children reappear after the flow resolves", ({ Given, And, When, Then }) => {
    let capturedInitFlow: ReturnType<typeof useFlowInit>["initFlow"];
    let capturedRef: React.RefObject<FlowOutletHandle | null>;

    Given("a host with FlowOutlet containing children", () => {
      cleanup();

      function TestHost() {
        const ref = useRef<FlowOutletHandle>(null);
        const { initFlow } = useFlowInit();
        capturedInitFlow = initFlow;
        capturedRef = ref;
        return (
          <FlowOutlet ref={ref}>
            <button type="button">Start Flow</button>
          </FlowOutlet>
        );
      }

      render(<TestHost />);
      expect(screen.getByText("Start Flow")).toBeInTheDocument();
    });

    And("a flow has been activated", () => {
      act(() => {
        capturedInitFlow(() => SimpleStep, capturedRef);
      });
      expect(screen.queryByText("Start Flow")).not.toBeInTheDocument();
      expect(screen.getByText("Step Content")).toBeInTheDocument();
    });

    When("the flow resolves", () => {
      act(() => {
        capturedRef.current?.activate(() => ResolvingStep);
      });
    });

    Then("the children are visible again", () => {
      expect(screen.getByText("Start Flow")).toBeInTheDocument();
    });
  });

  // ── Scenario 4 ─────────────────────────────────────────────────────
  Scenario("Outlet with no children renders nothing when idle", ({ Given, Then }) => {
    Given("a host with FlowOutlet and no children", () => {
      cleanup();

      function TestHost() {
        const ref = useRef<FlowOutletHandle>(null);
        return (
          <div data-testid="outlet-wrapper">
            <FlowOutlet ref={ref} />
          </div>
        );
      }

      render(<TestHost />);
    });

    Then("the outlet renders nothing", () => {
      const wrapper = screen.getByTestId("outlet-wrapper");
      expect(wrapper.innerHTML).toBe("");
    });
  });

  // ── Scenario 5 ─────────────────────────────────────────────────────
  Scenario(
    "useStep throws immediately when rendered outside the step boundary",
    ({ Given, Then }) => {
      let caughtError: unknown = null;

      Given("an idle FlowOutlet child that calls useStep", () => {
        cleanup();
        caughtError = null;

        function UseStepChild() {
          useStep();
          return null;
        }

        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
          render(
            <FlowOutlet>
              <UseStepChild />
            </FlowOutlet>,
          );
        } catch (err) {
          caughtError = err;
        }
        consoleSpy.mockRestore();
      });

      Then("an error is thrown immediately when the component renders", () => {
        expect(caughtError).toBeInstanceOf(Error);
        expect((caughtError as Error).message).toContain("useStep()");
        expect((caughtError as Error).message).toContain("rendered step component");
      });
    },
  );
});
