import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { act, cleanup, render, screen } from "@testing-library/react";
import type React from "react";
import { useRef } from "react";
import { expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { FlowOutlet, type FlowOutletHandle } from "../components/FlowOutlet";
import { useFlowContext } from "../hooks/useFlowContext";
import { useFlowInit } from "../hooks/useFlowInit";
import { useStep } from "../hooks/useStep";

// ── Fixture components ───────────────────────────────────────────────

function ChromeHeader(): React.ReactElement {
  return <div>Chrome Header</div>;
}

function ContextChrome(): React.ReactElement {
  const { context: ctx } = useFlowContext<{ title: string }>();
  return <div>Title: {ctx.title}</div>;
}

function SyncStep(): React.ReactElement {
  return <div>Step Content</div>;
}

let capturedAdvance: ReturnType<typeof useStep>["advance"];

function Step1(): React.ReactElement {
  const { advance } = useStep();
  capturedAdvance = advance;
  return <div>Step 1 Content</div>;
}

function Step2(): React.ReactElement {
  return <div>Step 2 Content</div>;
}

function ContextStep1(): React.ReactElement {
  const { advance } = useStep();
  capturedAdvance = advance;
  return <div>Context Step 1</div>;
}

function ContextStep2(): React.ReactElement {
  return <div>Context Step 2</div>;
}

let capturedAbortFromChrome: (() => void) | null = null;
let capturedResolveFromChrome: ((value?: unknown) => void) | null = null;

function ChromeWithAbort(): React.ReactElement {
  const { abort } = useFlowContext();
  capturedAbortFromChrome = () => abort("chrome-cancelled");
  return <div>Chrome Abort</div>;
}

function ChromeWithResolve(): React.ReactElement {
  const { resolve } = useFlowContext();
  capturedResolveFromChrome = (value?: unknown) => resolve(value);
  return <div>Chrome Resolve</div>;
}

function ChromeWithStep(): React.ReactElement {
  // Deliberate misuse — useStep() must not be callable from chrome
  useStep();
  return <div>Chrome Step</div>;
}

// ── Feature ──────────────────────────────────────────────────────────

const feature = await loadFeature("src/features/chrome-and-flow-context.feature");

describeFeature(feature, ({ Scenario }) => {
  // ── Scenario 1 ─────────────────────────────────────────────────────
  Scenario("Chrome receives step slot and renders it", ({ Given, When, Then }) => {
    let capturedInitFlow: ReturnType<typeof useFlowInit>["initFlow"];
    let capturedRef: React.RefObject<FlowOutletHandle | null>;

    Given("a host with FlowOutlet configured with a chrome render prop", () => {
      cleanup();

      function TestHost() {
        const ref = useRef<FlowOutletHandle>(null);
        const { initFlow } = useFlowInit();
        capturedInitFlow = initFlow;
        capturedRef = ref;
        return (
          <FlowOutlet
            ref={ref}
            fallback={<div>Loading…</div>}
            chrome={(slot) => (
              <>
                <ChromeHeader />
                {slot}
              </>
            )}
          />
        );
      }

      render(<TestHost />);
      expect(capturedInitFlow).toBeDefined();
    });

    When("initFlow is called with a sync step", () => {
      act(() => {
        capturedInitFlow(() => SyncStep, capturedRef);
      });
    });

    Then("both the chrome and the step are visible", () => {
      expect(screen.getByText("Chrome Header")).toBeInTheDocument();
      expect(screen.getByText("Step Content")).toBeInTheDocument();
    });
  });

  // ── Scenario 2 ─────────────────────────────────────────────────────
  Scenario("Chrome persists across step advancement", ({ Given, When, Then, And }) => {
    let capturedInitFlow: ReturnType<typeof useFlowInit>["initFlow"];
    let capturedRef: React.RefObject<FlowOutletHandle | null>;

    Given("a host with FlowOutlet configured with a chrome render prop", () => {
      cleanup();

      function TestHost() {
        const ref = useRef<FlowOutletHandle>(null);
        const { initFlow } = useFlowInit();
        capturedInitFlow = initFlow;
        capturedRef = ref;
        return (
          <FlowOutlet
            ref={ref}
            fallback={<div>Loading…</div>}
            chrome={(slot) => (
              <>
                <ChromeHeader />
                {slot}
              </>
            )}
          />
        );
      }

      render(<TestHost />);
      expect(capturedInitFlow).toBeDefined();
    });

    And("the flow has been activated with a sync step", () => {
      act(() => {
        capturedInitFlow(() => Step1, capturedRef);
      });
      expect(screen.getByText("Step 1 Content")).toBeInTheDocument();
      expect(screen.getByText("Chrome Header")).toBeInTheDocument();
    });

    When("the step advances to a new step", () => {
      act(() => {
        capturedAdvance(() => Step2);
      });
    });

    Then("the chrome component is still visible", () => {
      expect(screen.getByText("Chrome Header")).toBeInTheDocument();
    });

    And("the new step is rendered", () => {
      expect(screen.getByText("Step 2 Content")).toBeInTheDocument();
      expect(screen.queryByText("Step 1 Content")).not.toBeInTheDocument();
    });
  });

  // ── Scenario 3 ─────────────────────────────────────────────────────
  Scenario("Chrome reads patched consumer context", ({ Given, When, Then, And }) => {
    let capturedInitFlow: ReturnType<typeof useFlowInit>["initFlow"];
    let capturedRef: React.RefObject<FlowOutletHandle | null>;

    Given(
      "a host with FlowOutlet configured with a chrome render prop that displays context",
      () => {
        cleanup();

        function TestHost() {
          const ref = useRef<FlowOutletHandle>(null);
          const { initFlow } = useFlowInit();
          capturedInitFlow = initFlow;
          capturedRef = ref;
          return (
            <FlowOutlet
              ref={ref}
              fallback={<div>Loading…</div>}
              chrome={(slot) => (
                <>
                  <ContextChrome />
                  {slot}
                </>
              )}
            />
          );
        }

        render(<TestHost />);
        expect(capturedInitFlow).toBeDefined();
      },
    );

    And("the flow has been activated with initial context", () => {
      act(() => {
        capturedInitFlow(() => ContextStep1, capturedRef, { title: "Initial" });
      });
      expect(screen.getByText("Title: Initial")).toBeInTheDocument();
    });

    When("the step advances with a contextPatch", () => {
      act(() => {
        capturedAdvance(() => ContextStep2, { title: "Updated" });
      });
    });

    Then("the chrome component displays the updated context value", () => {
      expect(screen.getByText("Title: Updated")).toBeInTheDocument();
    });
  });

  // ── Scenario 4 ─────────────────────────────────────────────────────
  Scenario("Outlet renders without chrome", ({ Given, When, Then }) => {
    let capturedInitFlow: ReturnType<typeof useFlowInit>["initFlow"];
    let capturedRef: React.RefObject<FlowOutletHandle | null>;

    Given("a host with FlowOutlet configured without chrome", () => {
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
    });

    When("initFlow is called with a sync step", () => {
      act(() => {
        capturedInitFlow(() => SyncStep, capturedRef);
      });
    });

    Then("only the step content is rendered", () => {
      expect(screen.getByText("Step Content")).toBeInTheDocument();
      expect(screen.queryByText("Chrome Header")).not.toBeInTheDocument();
    });
  });

  // ── Scenario 5 ─────────────────────────────────────────────────────
  Scenario("Chrome aborts flow via useFlowContext", ({ Given, When, Then, And }) => {
    let capturedInitFlow: ReturnType<typeof useFlowInit>["initFlow"];
    let capturedRef: React.RefObject<FlowOutletHandle | null>;

    Given("a host with FlowOutlet configured with a chrome render prop that can abort", () => {
      cleanup();
      capturedAbortFromChrome = null;

      function TestHost() {
        const ref = useRef<FlowOutletHandle>(null);
        const { initFlow } = useFlowInit();
        capturedInitFlow = initFlow;
        capturedRef = ref;
        return (
          <FlowOutlet
            ref={ref}
            chrome={(slot) => (
              <>
                <ChromeWithAbort />
                {slot}
              </>
            )}
          />
        );
      }

      render(<TestHost />);
      expect(capturedInitFlow).toBeDefined();
    });

    And("the flow has been activated with a sync step", () => {
      act(() => {
        capturedInitFlow(() => SyncStep, capturedRef);
      });
      expect(screen.getByText("Chrome Abort")).toBeInTheDocument();
      expect(screen.getByText("Step Content")).toBeInTheDocument();
    });

    When("the chrome component calls abort via useFlowContext", () => {
      expect(capturedAbortFromChrome).not.toBeNull();
      act(() => {
        capturedAbortFromChrome?.();
      });
    });

    Then("the outlet returns to idle", () => {
      expect(screen.queryByText("Chrome Abort")).not.toBeInTheDocument();
      expect(screen.queryByText("Step Content")).not.toBeInTheDocument();
    });
  });

  // ── Scenario 6 ─────────────────────────────────────────────────────
  Scenario("Chrome resolves flow via useFlowContext", ({ Given, When, Then, And }) => {
    let capturedInitFlow: ReturnType<typeof useFlowInit>["initFlow"];
    let capturedRef: React.RefObject<FlowOutletHandle | null>;

    Given("a host with FlowOutlet configured with a chrome render prop that can resolve", () => {
      cleanup();
      capturedResolveFromChrome = null;

      function TestHost() {
        const ref = useRef<FlowOutletHandle>(null);
        const { initFlow } = useFlowInit();
        capturedInitFlow = initFlow;
        capturedRef = ref;
        return (
          <FlowOutlet
            ref={ref}
            chrome={(slot) => (
              <>
                <ChromeWithResolve />
                {slot}
              </>
            )}
          />
        );
      }

      render(<TestHost />);
      expect(capturedInitFlow).toBeDefined();
    });

    And("the flow has been activated with a sync step", () => {
      act(() => {
        capturedInitFlow(() => SyncStep, capturedRef);
      });
      expect(screen.getByText("Chrome Resolve")).toBeInTheDocument();
      expect(screen.getByText("Step Content")).toBeInTheDocument();
    });

    When("the chrome component calls resolve via useFlowContext", () => {
      expect(capturedResolveFromChrome).not.toBeNull();
      act(() => {
        capturedResolveFromChrome?.("chrome-resolved");
      });
    });

    Then("the outlet returns to idle", () => {
      expect(screen.queryByText("Chrome Resolve")).not.toBeInTheDocument();
      expect(screen.queryByText("Step Content")).not.toBeInTheDocument();
    });
  });

  // ── Scenario 7 ─────────────────────────────────────────────────────
  Scenario("Chrome calling useStep throws immediately", ({ Given, When, Then }) => {
    let capturedInitFlow: ReturnType<typeof useFlowInit>["initFlow"];
    let capturedRef: React.RefObject<FlowOutletHandle | null>;
    let caughtError: unknown = null;

    Given("a host with a FlowOutlet configured with a chrome component that calls useStep", () => {
      cleanup();
      caughtError = null;

      function TestHost() {
        const ref = useRef<FlowOutletHandle>(null);
        const { initFlow } = useFlowInit();
        capturedInitFlow = initFlow;
        capturedRef = ref;
        return (
          <FlowOutlet
            ref={ref}
            chrome={(slot) => (
              <>
                <ChromeWithStep />
                {slot}
              </>
            )}
          />
        );
      }

      render(<TestHost />);
      expect(capturedInitFlow).toBeDefined();
    });

    When("initFlow is called with a sync step", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        act(() => {
          capturedInitFlow(() => SyncStep, capturedRef);
        });
      } catch (err) {
        caughtError = err;
      }
      consoleSpy.mockRestore();
    });

    Then("an error is thrown immediately when the chrome component renders", () => {
      expect(caughtError).toBeInstanceOf(Error);
      expect((caughtError as Error).message).toContain("useStep()");
      expect((caughtError as Error).message).toContain("rendered step component");
    });
  });
});
