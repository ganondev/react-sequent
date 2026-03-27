import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { act, cleanup, render, screen } from "@testing-library/react";
import type React from "react";
import { expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { useSequentContext } from "../hooks/useSequentContext";
import { useSequentFlow } from "../hooks/useSequentFlow";
import { useSequentStep } from "../hooks/useSequentStep";

function ChromeHeader(): React.ReactElement {
  return <div>Chrome Header</div>;
}

function ContextChrome(): React.ReactElement {
  const { context: ctx } = useSequentContext<{ title: string }>();
  return <div>Title: {ctx.title}</div>;
}

function SyncStep(): React.ReactElement {
  return <div>Step Content</div>;
}

let capturedAdvance: ReturnType<typeof useSequentStep>["advance"];

function Step1(): React.ReactElement {
  const { advance } = useSequentStep();
  capturedAdvance = advance;
  return <div>Step 1 Content</div>;
}

function Step2(): React.ReactElement {
  return <div>Step 2 Content</div>;
}

function ContextStep1(): React.ReactElement {
  const { advance } = useSequentStep();
  capturedAdvance = advance;
  return <div>Context Step 1</div>;
}

function ContextStep2(): React.ReactElement {
  return <div>Context Step 2</div>;
}

let capturedAbortFromChrome: (() => void) | null = null;
let capturedResolveFromChrome: ((value?: unknown) => void) | null = null;

function ChromeWithAbort(): React.ReactElement {
  const { abort } = useSequentContext();
  capturedAbortFromChrome = () => abort("chrome-cancelled");
  return <div>Chrome Abort</div>;
}

function ChromeWithResolve(): React.ReactElement {
  const { resolve } = useSequentContext();
  capturedResolveFromChrome = (value?: unknown) => resolve(value);
  return <div>Chrome Resolve</div>;
}

function ChromeWithStep(): React.ReactElement {
  useSequentStep();
  return <div>Chrome Step</div>;
}

const feature = await loadFeature("src/features/chrome-and-flow-context.feature");

describeFeature(feature, ({ Scenario }) => {
  Scenario("Chrome receives step slot and renders it", ({ Given, When, Then }) => {
    let capturedInit: ReturnType<typeof useSequentFlow>["init"];

    Given("a host with SequentOutlet configured with a chrome render prop", () => {
      cleanup();

      function TestHost() {
        const { init, SequentOutlet } = useSequentFlow();
        capturedInit = init;
        return (
          <SequentOutlet
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
      expect(capturedInit).toBeDefined();
    });

    When("init is called with a sync step", () => {
      act(() => {
        capturedInit(() => SyncStep);
      });
    });

    Then("both the chrome and the step are visible", () => {
      expect(screen.getByText("Chrome Header")).toBeInTheDocument();
      expect(screen.getByText("Step Content")).toBeInTheDocument();
    });
  });

  Scenario("Chrome persists across step advancement", ({ Given, When, Then, And }) => {
    let capturedInit: ReturnType<typeof useSequentFlow>["init"];

    Given("a host with SequentOutlet configured with a chrome render prop", () => {
      cleanup();

      function TestHost() {
        const { init, SequentOutlet } = useSequentFlow();
        capturedInit = init;
        return (
          <SequentOutlet
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
      expect(capturedInit).toBeDefined();
    });

    And("the flow has been activated with a sync step", () => {
      act(() => {
        capturedInit(() => Step1);
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

  Scenario("Chrome reads patched consumer context", ({ Given, When, Then, And }) => {
    let capturedInit: ReturnType<typeof useSequentFlow>["init"];

    Given(
      "a host with SequentOutlet configured with a chrome render prop that displays context",
      () => {
        cleanup();

        function TestHost() {
          const { init, SequentOutlet } = useSequentFlow();
          capturedInit = init;
          return (
            <SequentOutlet
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
        expect(capturedInit).toBeDefined();
      },
    );

    And("the flow has been activated with initial context", () => {
      act(() => {
        capturedInit(() => ContextStep1, { title: "Initial" });
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

  Scenario("Outlet renders without chrome", ({ Given, When, Then }) => {
    let capturedInit: ReturnType<typeof useSequentFlow>["init"];

    Given("a host with SequentOutlet configured without chrome", () => {
      cleanup();

      function TestHost() {
        const { init, SequentOutlet } = useSequentFlow();
        capturedInit = init;
        return <SequentOutlet />;
      }

      render(<TestHost />);
      expect(capturedInit).toBeDefined();
    });

    When("init is called with a sync step", () => {
      act(() => {
        capturedInit(() => SyncStep);
      });
    });

    Then("only the step content is rendered", () => {
      expect(screen.getByText("Step Content")).toBeInTheDocument();
      expect(screen.queryByText("Chrome Header")).not.toBeInTheDocument();
    });
  });

  Scenario("Chrome aborts flow via useSequentContext", ({ Given, When, Then, And }) => {
    let capturedInit: ReturnType<typeof useSequentFlow>["init"];

    Given("a host with SequentOutlet configured with a chrome render prop that can abort", () => {
      cleanup();
      capturedAbortFromChrome = null;

      function TestHost() {
        const { init, SequentOutlet } = useSequentFlow();
        capturedInit = init;
        return (
          <SequentOutlet
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
      expect(capturedInit).toBeDefined();
    });

    And("the flow has been activated with a sync step", () => {
      act(() => {
        capturedInit(() => SyncStep);
      });
      expect(screen.getByText("Chrome Abort")).toBeInTheDocument();
      expect(screen.getByText("Step Content")).toBeInTheDocument();
    });

    When("the chrome component calls abort via useSequentContext", () => {
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

  Scenario("Chrome resolves flow via useSequentContext", ({ Given, When, Then, And }) => {
    let capturedInit: ReturnType<typeof useSequentFlow>["init"];

    Given("a host with SequentOutlet configured with a chrome render prop that can resolve", () => {
      cleanup();
      capturedResolveFromChrome = null;

      function TestHost() {
        const { init, SequentOutlet } = useSequentFlow();
        capturedInit = init;
        return (
          <SequentOutlet
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
      expect(capturedInit).toBeDefined();
    });

    And("the flow has been activated with a sync step", () => {
      act(() => {
        capturedInit(() => SyncStep);
      });
      expect(screen.getByText("Chrome Resolve")).toBeInTheDocument();
      expect(screen.getByText("Step Content")).toBeInTheDocument();
    });

    When("the chrome component calls resolve via useSequentContext", () => {
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

  Scenario("Chrome calling useSequentStep throws immediately", ({ Given, When, Then }) => {
    let capturedInit: ReturnType<typeof useSequentFlow>["init"];
    let caughtError: unknown = null;

    Given("a host with a SequentOutlet configured with a chrome component that calls useSequentStep", () => {
      cleanup();
      caughtError = null;

      function TestHost() {
        const { init, SequentOutlet } = useSequentFlow();
        capturedInit = init;
        return (
          <SequentOutlet
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
      expect(capturedInit).toBeDefined();
    });

    When("init is called with a sync step", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        act(() => {
          capturedInit(() => SyncStep);
        });
      } catch (err) {
        caughtError = err;
      }
      consoleSpy.mockRestore();
    });

    Then("an error is thrown immediately when the chrome component renders", () => {
      expect(caughtError).toBeInstanceOf(Error);
      expect((caughtError as Error).message).toContain("useSequentStep()");
      expect((caughtError as Error).message).toContain("rendered step component");
    });
  });
});
