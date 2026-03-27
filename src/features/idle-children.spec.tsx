import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { useSequentFlow } from "../hooks/useSequentFlow";
import { useSequentStep } from "../hooks/useSequentStep";

// ── Fixture step components ──────────────────────────────────────────

function SimpleStep() {
  return <div>Step Content</div>;
}

function ResolvingStep() {
  const { resolve } = useSequentStep();
  useEffect(() => {
    resolve("done");
  }, [resolve]);
  return null;
}

const feature = await loadFeature("src/features/idle-children.feature");

describeFeature(feature, ({ Scenario }) => {
  // ── Scenario 1 ─────────────────────────────────────────────────────
  Scenario("Outlet renders children when idle", ({ Given, Then }) => {
    Given("a host with SequentOutlet containing children", () => {
      cleanup();

      function TestHost() {
        const { SequentOutlet } = useSequentFlow();
        return (
          <SequentOutlet>
            <button type="button">Start Flow</button>
          </SequentOutlet>
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
      let capturedInit: ReturnType<typeof useSequentFlow>["init"];

      Given("a host with SequentOutlet containing children", () => {
        cleanup();

        function TestHost() {
          const { init, SequentOutlet } = useSequentFlow();
          capturedInit = init;
          return (
            <SequentOutlet>
              <button type="button">Start Flow</button>
            </SequentOutlet>
          );
        }

        render(<TestHost />);
        expect(screen.getByText("Start Flow")).toBeInTheDocument();
      });

      When("init is called with a sync step", () => {
        act(() => {
          capturedInit(() => SimpleStep);
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
    let capturedInit: ReturnType<typeof useSequentFlow>["init"];

    Given("a host with SequentOutlet containing children", () => {
      cleanup();

      function TestHost() {
        const { init, SequentOutlet } = useSequentFlow();
        capturedInit = init;
        return (
          <SequentOutlet>
            <button type="button">Start Flow</button>
          </SequentOutlet>
        );
      }

      render(<TestHost />);
      expect(screen.getByText("Start Flow")).toBeInTheDocument();
    });

    And("a flow has been activated", () => {
      act(() => {
        capturedInit(() => SimpleStep);
      });
      expect(screen.queryByText("Start Flow")).not.toBeInTheDocument();
      expect(screen.getByText("Step Content")).toBeInTheDocument();
    });

    When("the flow resolves", () => {
      act(() => {
        capturedInit(() => ResolvingStep);
      });
    });

    Then("the children are visible again", () => {
      expect(screen.getByText("Start Flow")).toBeInTheDocument();
    });
  });

  // ── Scenario 4 ─────────────────────────────────────────────────────
  Scenario("Outlet with no children renders nothing when idle", ({ Given, Then }) => {
    Given("a host with SequentOutlet and no children", () => {
      cleanup();

      function TestHost() {
        const { SequentOutlet } = useSequentFlow();
        return (
          <div data-testid="outlet-wrapper">
            <SequentOutlet />
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
    "useSequentStep throws immediately when rendered outside the step boundary",
    ({ Given, Then }) => {
      let caughtError: unknown = null;

      Given("an idle SequentOutlet child that calls useSequentStep", () => {
        cleanup();
        caughtError = null;

        function UseStepChild() {
          useSequentStep();
          return null;
        }

        function TestHost() {
          const { SequentOutlet } = useSequentFlow();
          return (
            <SequentOutlet>
              <UseStepChild />
            </SequentOutlet>
          );
        }

        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
          render(<TestHost />);
        } catch (err) {
          caughtError = err;
        }
        consoleSpy.mockRestore();
      });

      Then("an error is thrown immediately when the component renders", () => {
        expect(caughtError).toBeInstanceOf(Error);
        expect((caughtError as Error).message).toContain("useSequentStep()");
        expect((caughtError as Error).message).toContain("rendered step component");
      });
    },
  );
});
