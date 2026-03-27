import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { useSequentFlow } from "../hooks/useSequentFlow";
import { useSequentStep } from "../hooks/useSequentStep";

// ── Fixture step components ──────────────────────────────────────────
function SimpleStep() {
  return <div>Step Content</div>;
}

function ContextStep() {
  const { context } = useSequentStep();
  const ctx = context as { title: string };
  return <div>{ctx.title}</div>;
}

type InitFn = ReturnType<typeof useSequentFlow>["init"];

function Host({
  children,
  onCapture,
}: {
  children?: ReactNode;
  onCapture: (init: InitFn) => void;
}) {
  const { init, SequentOutlet } = useSequentFlow();
  onCapture(init);
  return <SequentOutlet>{children}</SequentOutlet>;
}

const feature = await loadFeature("src/features/flow-init.feature");

describeFeature(feature, ({ Scenario }) => {
  Scenario("Initialize a basic flow", ({ Given, When, Then }) => {
    let capturedInit!: InitFn;

    Given("a host component with useSequentFlow and SequentOutlet", () => {
      cleanup();

      render(
        <Host
          onCapture={(init) => {
            capturedInit = init;
          }}
        />,
      );

      expect(capturedInit).toBeDefined();
    });

    When("init is called with a sync step loader", () => {
      act(() => {
        capturedInit(() => SimpleStep);
      });
    });

    Then("the step renders inside the outlet", () => {
      expect(screen.getByText("Step Content")).toBeInTheDocument();
    });
  });

  Scenario("Initialize a flow with initial context", ({ Given, When, Then }) => {
    let capturedInit!: InitFn;

    Given("a host component with useSequentFlow and SequentOutlet", () => {
      cleanup();

      render(
        <Host
          onCapture={(init) => {
            capturedInit = init;
          }}
        />,
      );

      expect(capturedInit).toBeDefined();
    });

    When("init is called with a step loader and initial context", () => {
      act(() => {
        capturedInit(() => ContextStep, { title: "hello" });
      });
    });

    Then("the step can read the context via useSequentStep", () => {
      expect(screen.getByText("hello")).toBeInTheDocument();
    });
  });
});
