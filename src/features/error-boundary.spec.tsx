import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { act, cleanup, render, screen } from "@testing-library/react";
import type React from "react";
import { type ReactNode, useEffect } from "react";
import { expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import type { TransitionSlotProps } from "../components/FlowOutlet";
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

  Scenario(
    "An advance queued from the error UI during an exit transition renders the destination step",
    ({ Given, And, When, Then }) => {
      let capturedInit: ReturnType<typeof useSequentFlow>["init"];
      let consoleSpy: ReturnType<typeof vi.spyOn>;

      function DestinationStep(): React.ReactElement {
        return <div>Destination step rendered</div>;
      }

      /**
       * Throws while `shouldFail` is set. React 19 retries a failed concurrent
       * render synchronously, so a mount-counted fixture would skip the throw
       * on the retry and never reach the error boundary. Keep the flag set
       * until the error UI is confirmed visible, then clear it so the step
       * renders normally when it remounts as the previous step of the drained
       * transition.
       */
      let shouldFail = true;
      function FailingOnceStep(): React.ReactElement {
        if (shouldFail) {
          throw new Error("Failing step exploded!");
        }
        return <div>Recovered previous step</div>;
      }

      function StepWithAdvanceBtn(): React.ReactElement {
        const { advance } = useSequentStep();
        return (
          <button type="button" onClick={() => advance(() => FailingOnceStep)}>
            Advance
          </button>
        );
      }

      /**
       * Rendered by the boundary inside the entering step's StepContext, so
       * `useSequentStep` navigation queues during the "exiting" phase.
       */
      function QueueNextErrorUi(): React.ReactElement {
        const { advance } = useSequentStep();
        return (
          <button type="button" onClick={() => advance(() => DestinationStep)}>
            Queue Next
          </button>
        );
      }

      interface ErrorTransitionHostProps {
        errorStep: (context: ErrorStepContext) => ReactNode;
        onCaptureInit: (init: ReturnType<typeof useSequentFlow>["init"]) => void;
      }

      function ErrorTransitionHost({ errorStep, onCaptureInit }: ErrorTransitionHostProps) {
        const { init, SequentOutlet } = useSequentFlow();

        if (onCaptureInit) {
          onCaptureInit(init);
        }

        const transition = (p: TransitionSlotProps): ReactNode => {
          if (p.phase === "exited" || !p.previousStep) {
            return p.nextStep;
          }
          return (
            <div>
              <div data-testid="previous-step">{p.previousStep}</div>
              <div data-testid="next-step">{p.nextStep}</div>
              <button type="button" data-testid="call-on-exited" onClick={() => p.onExited()}>
                Done
              </button>
            </div>
          );
        };

        return <SequentOutlet transition={transition} errorStep={errorStep} />;
      }

      Given(
        "a host with a transition render prop and an errorStep whose UI queues an advance",
        () => {
          cleanup();
          shouldFail = true;
          consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

          render(
            <ErrorTransitionHost
              errorStep={() => <QueueNextErrorUi />}
              onCaptureInit={(init) => {
                capturedInit = init;
              }}
            />,
          );

          expect(capturedInit).toBeDefined();
        },
      );

      And("a flow has advanced to a step that throws during render", async () => {
        await act(async () => {
          capturedInit(() => StepWithAdvanceBtn);
        });
        await act(async () => {
          screen.getByText("Advance").click();
        });
        // Exiting phase: the error UI is mounted in the entering slot.
        expect(screen.getByTestId("call-on-exited")).toBeInTheDocument();
        expect(screen.getByText("Queue Next")).toBeInTheDocument();
        // The failing step remounts as the previous step of the drained
        // transition — from here on it must render normally.
        shouldFail = false;
      });

      When('the user clicks "Queue Next" in the error UI', async () => {
        await act(async () => {
          screen.getByText("Queue Next").click();
        });
      });

      And("the consumer calls onExited", async () => {
        await act(async () => {
          screen.getByTestId("call-on-exited").click();
        });
      });

      Then("the destination step is rendered", () => {
        expect(screen.getByText("Destination step rendered")).toBeInTheDocument();
      });

      And("the error UI is no longer visible", () => {
        expect(screen.queryByText("Queue Next")).not.toBeInTheDocument();
        consoleSpy.mockRestore();
      });
    },
  );

  Scenario(
    "A retreat queued from the error UI during an exit transition renders the restored history step",
    ({ Given, And, When, Then }) => {
      let capturedInit: ReturnType<typeof useSequentFlow>["init"];
      let consoleSpy: ReturnType<typeof vi.spyOn>;

      /**
       * Throws while `shouldFail` is set. React 19 retries a failed concurrent
       * render synchronously, so a mount-counted fixture would skip the throw
       * on the retry and never reach the error boundary. Keep the flag set
       * until the error UI is confirmed visible, then clear it so the step
       * renders normally when it remounts as the previous step of the drained
       * retreat.
       */
      let shouldFail = true;
      function FailingOnceStep(): React.ReactElement {
        if (shouldFail) {
          throw new Error("Failing step exploded!");
        }
        return <div>Recovered previous step</div>;
      }

      function StepWithAdvanceBtn(): React.ReactElement {
        const { advance } = useSequentStep();
        return (
          <button type="button" onClick={() => advance(() => FailingOnceStep)}>
            Advance
          </button>
        );
      }

      /**
       * Rendered by the boundary inside the entering step's StepContext, so
       * `useSequentStep` navigation queues during the "exiting" phase.
       */
      function QueueRetreatErrorUi(): React.ReactElement {
        const { retreat } = useSequentStep();
        return (
          <button type="button" onClick={() => retreat()}>
            Queue Retreat
          </button>
        );
      }

      interface ErrorTransitionHostProps {
        errorStep: (context: ErrorStepContext) => ReactNode;
        onCaptureInit: (init: ReturnType<typeof useSequentFlow>["init"]) => void;
      }

      function ErrorTransitionHost({ errorStep, onCaptureInit }: ErrorTransitionHostProps) {
        const { init, SequentOutlet } = useSequentFlow();

        if (onCaptureInit) {
          onCaptureInit(init);
        }

        const transition = (p: TransitionSlotProps): ReactNode => {
          if (p.phase === "exited" || !p.previousStep) {
            return p.nextStep;
          }
          return (
            <div>
              <div data-testid="previous-step">{p.previousStep}</div>
              <div data-testid="next-step">{p.nextStep}</div>
              <button type="button" data-testid="call-on-exited" onClick={() => p.onExited()}>
                Done
              </button>
            </div>
          );
        };

        return <SequentOutlet transition={transition} errorStep={errorStep} />;
      }

      Given(
        "a host with a transition render prop and an errorStep whose UI queues a retreat",
        () => {
          cleanup();
          shouldFail = true;
          consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

          render(
            <ErrorTransitionHost
              errorStep={() => <QueueRetreatErrorUi />}
              onCaptureInit={(init) => {
                capturedInit = init;
              }}
            />,
          );

          expect(capturedInit).toBeDefined();
        },
      );

      And("a flow has advanced to a step that throws during render", async () => {
        await act(async () => {
          capturedInit(() => StepWithAdvanceBtn);
        });
        await act(async () => {
          screen.getByText("Advance").click();
        });
        // Exiting phase: the error UI is mounted in the entering slot.
        expect(screen.getByTestId("call-on-exited")).toBeInTheDocument();
        expect(screen.getByText("Queue Retreat")).toBeInTheDocument();
        // The failing step remounts as the previous step of the drained
        // retreat — from here on it must render normally.
        shouldFail = false;
      });

      When('the user clicks "Queue Retreat" in the error UI', async () => {
        await act(async () => {
          screen.getByText("Queue Retreat").click();
        });
      });

      And("the consumer calls onExited", async () => {
        await act(async () => {
          screen.getByTestId("call-on-exited").click();
        });
      });

      Then("the restored history step is rendered", () => {
        expect(screen.getByText("Advance")).toBeInTheDocument();
      });

      And("the error UI is no longer visible", () => {
        expect(screen.queryByText("Queue Retreat")).not.toBeInTheDocument();
        consoleSpy.mockRestore();
      });
    },
  );
});
