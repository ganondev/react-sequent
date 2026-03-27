import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { useSequentFlow } from "../hooks/useSequentFlow";

function AsyncStep() {
  return <div>Async Step Content</div>;
}

function SyncStep() {
  return <div>Sync Step Content</div>;
}

const feature = await loadFeature("src/features/async-step-loading.feature");

describeFeature(feature, ({ Scenario }) => {
  Scenario("Async loader shows fallback then renders the step", ({ Given, When, Then, And }) => {
    let capturedInit: ReturnType<typeof useSequentFlow>["init"];
    let resolveStep!: () => void;
    let asyncLoader!: () => Promise<{ default: ComponentType }>;

    Given("a host with SequentOutlet configured with a fallback", () => {
      cleanup();

      const stepPromise = new Promise<{ default: ComponentType }>((resolve) => {
        resolveStep = () => resolve({ default: AsyncStep });
      });
      asyncLoader = () => stepPromise;

      function TestHost() {
        const { init, SequentOutlet } = useSequentFlow();
        capturedInit = init;
        return <SequentOutlet fallback={<div>Loading…</div>} />;
      }

      render(<TestHost />);
      expect(capturedInit).toBeDefined();
    });

    When("init is called with an async step loader", () => {
      act(() => {
        capturedInit(asyncLoader);
      });
    });

    Then("the fallback is shown during loading", () => {
      expect(screen.getByText("Loading…")).toBeInTheDocument();
      expect(screen.queryByText("Async Step Content")).not.toBeInTheDocument();
    });

    And("the step renders after loading completes", async () => {
      await act(async () => {
        resolveStep();
      });

      await waitFor(() => {
        expect(screen.getByText("Async Step Content")).toBeInTheDocument();
      });
      expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    });
  });

  Scenario("Sync loader renders immediately with no fallback", ({ Given, When, Then, And }) => {
    let capturedInit: ReturnType<typeof useSequentFlow>["init"];

    Given("a host with SequentOutlet configured with a fallback", () => {
      cleanup();

      function TestHost() {
        const { init, SequentOutlet } = useSequentFlow();
        capturedInit = init;
        return <SequentOutlet fallback={<div>Loading…</div>} />;
      }

      render(<TestHost />);
      expect(capturedInit).toBeDefined();
    });

    When("init is called with a sync step loader", () => {
      act(() => {
        capturedInit(() => SyncStep);
      });
    });

    Then("the step renders immediately", () => {
      expect(screen.getByText("Sync Step Content")).toBeInTheDocument();
    });

    And("the fallback is never shown", () => {
      expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    });
  });
});
