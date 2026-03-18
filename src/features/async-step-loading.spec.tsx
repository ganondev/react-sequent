import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { useRef } from "react";
import { expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { FlowOutlet, type FlowOutletHandle } from "../components/FlowOutlet";
import { useFlowInit } from "../hooks/useFlowInit";

// ── Fixture step components ──────────────────────────────────────────

function AsyncStep() {
  return <div>Async Step Content</div>;
}

function SyncStep() {
  return <div>Sync Step Content</div>;
}

const feature = await loadFeature("src/features/async-step-loading.feature");

describeFeature(feature, ({ Scenario }) => {
  // ── Scenario 1 ─────────────────────────────────────────────────────
  Scenario("Async loader shows fallback then renders the step", ({ Given, When, Then, And }) => {
    let capturedInitFlow: ReturnType<typeof useFlowInit>["initFlow"];
    let capturedRef: React.RefObject<FlowOutletHandle | null>;
    let resolveStep: () => void;
    let asyncLoader: () => Promise<{ default: React.ComponentType }>;

    Given("a host with FlowOutlet configured with a fallback", () => {
      cleanup();

      // Build the controllable async loader before rendering
      const stepPromise = new Promise<{ default: React.ComponentType }>((resolve) => {
        resolveStep = () => resolve({ default: AsyncStep });
      });
      asyncLoader = () => stepPromise;

      function TestHost() {
        const ref = useRef<FlowOutletHandle>(null);
        const { initFlow } = useFlowInit();
        capturedInitFlow = initFlow;
        capturedRef = ref;
        return <FlowOutlet ref={ref} fallback={<div>Loading…</div>} />;
      }

      render(<TestHost />);
      expect(capturedInitFlow).toBeDefined();
    });

    When("initFlow is called with an async step loader", () => {
      act(() => {
        capturedInitFlow(asyncLoader, capturedRef);
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

  // ── Scenario 2 ─────────────────────────────────────────────────────
  Scenario("Sync loader renders immediately with no fallback", ({ Given, When, Then, And }) => {
    let capturedInitFlow: ReturnType<typeof useFlowInit>["initFlow"];
    let capturedRef: React.RefObject<FlowOutletHandle | null>;

    Given("a host with FlowOutlet configured with a fallback", () => {
      cleanup();

      function TestHost() {
        const ref = useRef<FlowOutletHandle>(null);
        const { initFlow } = useFlowInit();
        capturedInitFlow = initFlow;
        capturedRef = ref;
        return <FlowOutlet ref={ref} fallback={<div>Loading…</div>} />;
      }

      render(<TestHost />);
      expect(capturedInitFlow).toBeDefined();
    });

    When("initFlow is called with a sync step loader", () => {
      act(() => {
        capturedInitFlow(SyncStep, capturedRef);
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
