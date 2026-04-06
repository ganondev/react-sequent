import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { useEffect } from "react";
import { expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { useSequentFlow } from "../hooks/useSequentFlow";
import { useSequentStep } from "../hooks/useSequentStep";
import type { ErrorStepContext } from "../internal/FlowErrorBoundary";

const THROWING_ERROR = new Error("Step exploded!");

function ThrowingStep(): React.ReactElement {
  throw THROWING_ERROR;
}

function HealthyStep(): React.ReactElement {
  return <div>Healthy step rendered</div>;
}

function ResolvingStep(): null {
  const { resolve } = useSequentStep();
  useEffect(() => {
    resolve();
  }, [resolve]);
  return null;
}

function AdvancerStep(): React.ReactElement {
  const { advance } = useSequentStep();
  return (
    <button type="button" onClick={() => advance(() => ThrowingStep)}>
      Advance now
    </button>
  );
}

const feature = await loadFeature("src/features/error-boundary.feature");

describeFeature(feature, ({ Scenario }) => {
  Scenario("A step that throws renders the errorStep", ({ Given, When, Then, And }) => {
    let capturedInit: ReturnType<typeof useSequentFlow>["init"];
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    Given("a host with SequentOutlet configured with an errorStep", () => {
      cleanup();
      consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      function TestHost() {
        const { init, SequentOutlet } = useSequentFlow();
        capturedInit = init;
        return <SequentOutlet errorStep={() => <div>Something went wrong</div>} />;
      }

      render(<TestHost />);
      expect(capturedInit).toBeDefined();
    });

    When("init is called with a step that throws during render", () => {
      act(() => {
        capturedInit(() => ThrowingStep);
      });
    });

    Then("the errorStep is rendered", () => {
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    And("the throwing step is not visible", () => {
      expect(screen.queryByText("Step exploded!")).not.toBeInTheDocument();
      consoleSpy.mockRestore();
    });
  });

  Scenario("The outlet remains mounted after an error", ({ Given, When, Then }) => {
    let capturedInit: ReturnType<typeof useSequentFlow>["init"];
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    Given("a host with SequentOutlet configured with an errorStep", () => {
      cleanup();
      consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      function TestHost() {
        const { init, SequentOutlet } = useSequentFlow();
        capturedInit = init;
        return (
          <div data-testid="outlet-wrapper">
            <SequentOutlet errorStep={() => <div>Something went wrong</div>} />
          </div>
        );
      }

      render(<TestHost />);
      expect(capturedInit).toBeDefined();
    });

    When("init is called with a step that throws during render", () => {
      act(() => {
        capturedInit(() => ThrowingStep);
      });
    });

    Then("the outlet element is still in the document", () => {
      expect(screen.getByTestId("outlet-wrapper")).toBeInTheDocument();
      consoleSpy.mockRestore();
    });
  });

  Scenario(
    "Re-activating after an error resets the error boundary",
    ({ Given, And, When, Then }) => {
      let capturedInit: ReturnType<typeof useSequentFlow>["init"];
      let consoleSpy: ReturnType<typeof vi.spyOn>;

      Given("a host with SequentOutlet configured with an errorStep", () => {
        cleanup();
        consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        function TestHost() {
          const { init, SequentOutlet } = useSequentFlow();
          capturedInit = init;
          return <SequentOutlet errorStep={() => <div>Something went wrong</div>} />;
        }

        render(<TestHost />);
      });

      And("the flow has been activated with a step that throws during render", () => {
        act(() => {
          capturedInit(() => ThrowingStep);
        });
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      });

      When("the outlet is re-activated with a healthy step", () => {
        act(() => {
          capturedInit(() => HealthyStep);
        });
      });

      Then("the healthy step is rendered", () => {
        expect(screen.getByText("Healthy step rendered")).toBeInTheDocument();
      });

      And("the errorStep is no longer visible", () => {
        expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
        consoleSpy.mockRestore();
      });
    },
  );

  Scenario(
    "Tearing down after an error and re-activating shows the new step",
    ({ Given, And, When, Then }) => {
      let capturedInit: ReturnType<typeof useSequentFlow>["init"];
      let consoleSpy: ReturnType<typeof vi.spyOn>;

      Given("a host with SequentOutlet configured with an errorStep", () => {
        cleanup();
        consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        function TestHost() {
          const { init, SequentOutlet } = useSequentFlow();
          capturedInit = init;
          return <SequentOutlet errorStep={() => <div>Something went wrong</div>} />;
        }

        render(<TestHost />);
      });

      And("the flow has been activated with a step that throws during render", () => {
        act(() => {
          capturedInit(() => ThrowingStep);
        });
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      });

      When("the flow is torn down by resolving", () => {
        act(() => {
          capturedInit(() => ResolvingStep);
        });
      });

      And("the outlet is activated with a healthy step", () => {
        act(() => {
          capturedInit(() => HealthyStep);
        });
      });

      Then("the healthy step is rendered", () => {
        expect(screen.getByText("Healthy step rendered")).toBeInTheDocument();
        consoleSpy.mockRestore();
      });
    },
  );

  Scenario("Error step receives the thrown error object", ({ Given, When, Then }) => {
    let capturedInit: ReturnType<typeof useSequentFlow>["init"];
    let capturedContext: ErrorStepContext | null = null;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    Given("a host with SequentOutlet configured with an errorStep that captures context", () => {
      cleanup();
      consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      function TestHost() {
        const { init, SequentOutlet } = useSequentFlow();
        capturedInit = init;
        return (
          <SequentOutlet
            errorStep={(context) => {
              capturedContext = context;
              return <div>Something went wrong</div>;
            }}
          />
        );
      }

      render(<TestHost />);
    });

    When("init is called with a step that throws during render", () => {
      act(() => {
        capturedInit(() => ThrowingStep);
      });
    });

    Then("the captured error matches the thrown error", () => {
      expect(capturedContext?.error).toBe(THROWING_ERROR);
      consoleSpy.mockRestore();
    });
  });

  Scenario("Error step receives the failed step component", ({ Given, When, Then }) => {
    let capturedInit: ReturnType<typeof useSequentFlow>["init"];
    let capturedContext: ErrorStepContext | null = null;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    Given("a host with SequentOutlet configured with an errorStep that captures context", () => {
      cleanup();
      consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      function TestHost() {
        const { init, SequentOutlet } = useSequentFlow();
        capturedInit = init;
        return (
          <SequentOutlet
            errorStep={(context) => {
              capturedContext = context;
              return <div>Something went wrong</div>;
            }}
          />
        );
      }

      render(<TestHost />);
    });

    When("init is called with a step that throws during render", () => {
      act(() => {
        capturedInit(() => ThrowingStep);
      });
    });

    Then("the captured failed step matches the throwing step", () => {
      expect(capturedContext?.failedStep).toBe(ThrowingStep);
      consoleSpy.mockRestore();
    });
  });

  Scenario("Error step receives the React component stack", ({ Given, When, Then }) => {
    let capturedInit: ReturnType<typeof useSequentFlow>["init"];
    let capturedContext: ErrorStepContext | null = null;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    Given("a host with SequentOutlet configured with an errorStep that captures context", () => {
      cleanup();
      consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      function TestHost() {
        const { init, SequentOutlet } = useSequentFlow();
        capturedInit = init;
        return (
          <SequentOutlet
            errorStep={(context) => {
              capturedContext = context;
              return <div>Something went wrong</div>;
            }}
          />
        );
      }

      render(<TestHost />);
    });

    When("init is called with a step that throws during render", () => {
      act(() => {
        capturedInit(() => ThrowingStep);
      });
    });

    Then("the captured component stack is present", () => {
      expect(capturedContext?.componentStack).toEqual(expect.any(String));
      expect(capturedContext?.componentStack?.length).toBeGreaterThan(0);
      consoleSpy.mockRestore();
    });
  });

  Scenario("Error step phase is render for activation failures", ({ Given, When, Then }) => {
    let capturedInit: ReturnType<typeof useSequentFlow>["init"];
    let capturedContext: ErrorStepContext | null = null;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    Given("a host with SequentOutlet configured with an errorStep that captures context", () => {
      cleanup();
      consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      function TestHost() {
        const { init, SequentOutlet } = useSequentFlow();
        capturedInit = init;
        return (
          <SequentOutlet
            errorStep={(context) => {
              capturedContext = context;
              return <div>Something went wrong</div>;
            }}
          />
        );
      }

      render(<TestHost />);
    });

    When("init is called with a step that throws during render", () => {
      act(() => {
        capturedInit(() => ThrowingStep);
      });
    });

    Then("the captured phase is render", () => {
      expect(capturedContext?.phase).toBe("render");
      consoleSpy.mockRestore();
    });
  });

  Scenario("Error step phase is transition for advance failures", ({ Given, And, When, Then }) => {
    let capturedInit: ReturnType<typeof useSequentFlow>["init"];
    let capturedContext: ErrorStepContext | null = null;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    Given("a host with SequentOutlet configured with an errorStep that captures context", () => {
      cleanup();
      consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      function TestHost() {
        const { init, SequentOutlet } = useSequentFlow();
        capturedInit = init;
        return (
          <SequentOutlet
            errorStep={(context) => {
              capturedContext = context;
              return <div>Something went wrong</div>;
            }}
          />
        );
      }

      render(<TestHost />);
    });

    And("the flow has been activated with a step that advances to a throwing step", () => {
      act(() => {
        capturedInit(() => AdvancerStep);
      });
      expect(screen.getByText("Advance now")).toBeInTheDocument();
    });

    When("the step advances to the throwing step", () => {
      act(() => {
        fireEvent.click(screen.getByText("Advance now"));
      });
    });

    Then("the captured phase is transition", () => {
      expect(capturedContext?.phase).toBe("transition");
      consoleSpy.mockRestore();
    });
  });
});
