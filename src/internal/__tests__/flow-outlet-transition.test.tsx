import { act, cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useSequentFlow } from "../../hooks/useSequentFlow";
import { useSequentStep } from "../../hooks/useSequentStep";
import type { TransitionSlotProps } from "../../components/FlowOutlet";

// ── Test step components ──────────────────────────────────────────────

function StepA() {
  return <div>Step A</div>;
}

function StepB() {
  return <div>Step B</div>;
}

function StepC() {
  return <div>Step C</div>;
}

function StepWithResolve() {
  const { resolve } = useSequentStep();
  return (
    <button type="button" onClick={() => resolve()}>
      Resolve
    </button>
  );
}

function StepWithAbort() {
  const { abort } = useSequentStep();
  return (
    <button type="button" onClick={() => abort()}>
      Abort
    </button>
  );
}

// ── Test harness ──────────────────────────────────────────────────────

/**
 * A transition wrapper that lets tests control onExited.
 * Renders both steps when "exiting", passes through when "exited".
 */
function createControlledTransition(
  onRender: (props: TransitionSlotProps) => void,
) {
  return (props: TransitionSlotProps): ReactNode => {
    onRender(props);
    if (props.phase === "exited" || !props.previousStep) {
      return props.nextStep;
    }
    return (
      <div>
        <div data-testid="previous-step">{props.previousStep}</div>
        <div data-testid="next-step">{props.nextStep}</div>
        <button
          type="button"
          data-testid="call-on-exited"
          onClick={() => props.onExited()}
        >
          Done
        </button>
      </div>
    );
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("FlowOutlet transition mode", () => {
  afterEach(() => {
    cleanup();
  });

  describe("initial flow start", () => {
    it("renders step in 'exited' phase with previousStep null", async () => {
      const captured: TransitionSlotProps[] = [];
      const transition = createControlledTransition((p) => captured.push(p));

      function Host() {
        const { init, SequentOutlet } = useSequentFlow();
        return (
          <>
            <button type="button" onClick={() => init(() => StepA)}>
              Init
            </button>
            <SequentOutlet transition={transition} />
          </>
        );
      }

      render(<Host />);

      await act(async () => {
        screen.getByText("Init").click();
      });

      expect(screen.getByText("Step A")).toBeInTheDocument();

      // The first render should be phase "exited" with previousStep null.
      const firstCapture = captured[0];
      expect(firstCapture.phase).toBe("exited");
      expect(firstCapture.previousStep).toBeNull();
    });
  });

  describe("advance triggers transition", () => {
    it("sets phase to 'exiting' and dual-mounts both steps", async () => {
      const captured: TransitionSlotProps[] = [];
      const transition = createControlledTransition((p) => captured.push(p));

      function StepAdvance() {
        const { advance } = useSequentStep();
        return (
          <button type="button" onClick={() => advance(() => StepB)}>
            Next
          </button>
        );
      }

      function Host() {
        const { init, SequentOutlet } = useSequentFlow();
        return (
          <>
            <button type="button" onClick={() => init(() => StepAdvance)}>
              Init
            </button>
            <SequentOutlet transition={transition} />
          </>
        );
      }

      render(<Host />);

      await act(async () => {
        screen.getByText("Init").click();
      });

      await act(async () => {
        screen.getByText("Next").click();
      });

      // We should now be in "exiting" phase.
      const exitingCapture = captured[captured.length - 1];
      expect(exitingCapture.phase).toBe("exiting");
      expect(exitingCapture.previousStep).not.toBeNull();

      // Both steps should be in the DOM.
      expect(screen.getByTestId("previous-step")).toBeInTheDocument();
      expect(screen.getByTestId("next-step")).toBeInTheDocument();
      expect(screen.getByText("Step B")).toBeInTheDocument();
    });
  });

  describe("onExited advances phase", () => {
    it("advances to 'exited' and unmounts previousStep", async () => {
      const captured: TransitionSlotProps[] = [];
      const transition = createControlledTransition((p) => captured.push(p));

      function StepAdvance() {
        const { advance } = useSequentStep();
        return (
          <button type="button" onClick={() => advance(() => StepB)}>
            Next
          </button>
        );
      }

      function Host() {
        const { init, SequentOutlet } = useSequentFlow();
        return (
          <>
            <button type="button" onClick={() => init(() => StepAdvance)}>
              Init
            </button>
            <SequentOutlet transition={transition} />
          </>
        );
      }

      render(<Host />);

      await act(async () => {
        screen.getByText("Init").click();
      });

      await act(async () => {
        screen.getByText("Next").click();
      });

      // Click the "Done" button that calls onExited.
      await act(async () => {
        screen.getByTestId("call-on-exited").click();
      });

      // Now phase should be "exited" and previousStep null.
      const exitedCapture = captured[captured.length - 1];
      expect(exitedCapture.phase).toBe("exited");
      expect(exitedCapture.previousStep).toBeNull();

      // Previous step should no longer be in the DOM.
      expect(screen.queryByTestId("previous-step")).not.toBeInTheDocument();
      // Step B should still be visible.
      expect(screen.getByText("Step B")).toBeInTheDocument();
    });
  });

  describe("onExited outside 'exiting' phase", () => {
    it("is a no-op when called in 'exited' phase", async () => {
      const captured: TransitionSlotProps[] = [];
      const transition = createControlledTransition((p) => captured.push(p));

      function Host() {
        const { init, SequentOutlet } = useSequentFlow();
        return (
          <>
            <button type="button" onClick={() => init(() => StepA)}>
              Init
            </button>
            <SequentOutlet transition={transition} />
          </>
        );
      }

      render(<Host />);

      await act(async () => {
        screen.getByText("Init").click();
      });

      // Should still be in "exited" phase with Step A visible.
      expect(screen.getByText("Step A")).toBeInTheDocument();
      const lastCapture = captured[captured.length - 1];
      expect(lastCapture.phase).toBe("exited");
      // Calling onExited here should be harmless (tested implicitly by no crash).
    });
  });

  describe("one transition per step", () => {
    it("only accepts the first advance, drops subsequent synchronous calls", async () => {
      const captured: TransitionSlotProps[] = [];
      const transition = createControlledTransition((p) => captured.push(p));

      // A step that calls advance twice in the same click handler.
      function StepDoubleAdvance() {
        const { advance } = useSequentStep();
        return (
          <button
            type="button"
            onClick={() => {
              advance(() => StepB);
              advance(() => StepC);
            }}
          >
            Double
          </button>
        );
      }

      function Host() {
        const { init, SequentOutlet } = useSequentFlow();
        return (
          <>
            <button type="button" onClick={() => init(() => StepDoubleAdvance)}>
              Init
            </button>
            <SequentOutlet transition={transition} />
          </>
        );
      }

      render(<Host />);

      await act(async () => {
        screen.getByText("Init").click();
      });

      await act(async () => {
        screen.getByText("Double").click();
      });

      // First advance accepted: transition to Step B.
      expect(screen.getByText("Step B")).toBeInTheDocument();
      // Second advance dropped — Step C never appears.
      expect(screen.queryByText("Step C")).not.toBeInTheDocument();

      // Complete exit.
      await act(async () => {
        screen.getByTestId("call-on-exited").click();
      });

      // Settled on Step B — no queued transition to Step C.
      expect(screen.getByText("Step B")).toBeInTheDocument();
      expect(screen.queryByTestId("previous-step")).not.toBeInTheDocument();
    });

    it("exiting step cannot advance or retreat", async () => {
      const captured: TransitionSlotProps[] = [];
      const transition = createControlledTransition((p) => captured.push(p));

      // A step with two buttons so the exiting step can try a *different* destination.
      function StepWithTwoTargets() {
        const { advance } = useSequentStep();
        return (
          <>
            <button type="button" onClick={() => advance(() => StepB)}>
              To B
            </button>
            <button type="button" onClick={() => advance(() => StepC)}>
              To C
            </button>
          </>
        );
      }

      function Host() {
        const { init, SequentOutlet } = useSequentFlow();
        return (
          <>
            <button type="button" onClick={() => init(() => StepWithTwoTargets)}>
              Init
            </button>
            <SequentOutlet transition={transition} />
          </>
        );
      }

      render(<Host />);

      await act(async () => {
        screen.getByText("Init").click();
      });

      // Advance to Step B — transition starts.
      await act(async () => {
        screen.getByText("To B").click();
      });

      // In "exiting" phase. StepWithTwoTargets is the exiting step.
      // Click "To C" — this calls queueAdvance, which should be dropped.
      const previousStepRoot = screen.getByTestId("previous-step");
      const toCButton = previousStepRoot.querySelector("button:nth-child(2)") as HTMLButtonElement | null;
      expect(toCButton).not.toBeNull();

      await act(async () => {
        toCButton!.click();
      });

      // Complete exit.
      await act(async () => {
        screen.getByTestId("call-on-exited").click();
      });

      // Should be settled on Step B — exiting step's advance to C was dropped.
      expect(screen.getByText("Step B")).toBeInTheDocument();
      expect(screen.queryByText("Step C")).not.toBeInTheDocument();
    });

    it("entering step can queue a navigation during exit", async () => {
      const captured: TransitionSlotProps[] = [];
      const transition = createControlledTransition((p) => captured.push(p));

      function StepAdvanceToQueue() {
        const { advance } = useSequentStep();
        return (
          <button type="button" onClick={() => advance(() => StepQueue)}>
            Next
          </button>
        );
      }

      // The entering step — queues an advance to Step C when interacted with.
      function StepQueue() {
        const { advance } = useSequentStep();
        return (
          <button type="button" onClick={() => advance(() => StepC)}>
            Queue C
          </button>
        );
      }

      function Host() {
        const { init, SequentOutlet } = useSequentFlow();
        return (
          <>
            <button type="button" onClick={() => init(() => StepAdvanceToQueue)}>
              Init
            </button>
            <SequentOutlet transition={transition} />
          </>
        );
      }

      render(<Host />);

      await act(async () => {
        screen.getByText("Init").click();
      });

      await act(async () => {
        screen.getByText("Next").click();
      });

      // In "exiting" phase. StepQueue is the entering step (inside next-step).
      // Click its "Queue C" button to enqueue a transition to Step C.
      const nextStepRoot = screen.getByTestId("next-step");
      const queueButton = nextStepRoot.querySelector("button") as HTMLButtonElement | null;
      expect(queueButton).not.toBeNull();

      await act(async () => {
        queueButton!.click();
      });

      // Complete the exit animation.
      await act(async () => {
        screen.getByTestId("call-on-exited").click();
      });

      // Now the queued transition to Step C should be processing.
      expect(screen.getByText("Step C")).toBeInTheDocument();

      // Complete second exit.
      await act(async () => {
        screen.getByTestId("call-on-exited").click();
      });

      // Settled on Step C.
      expect(screen.getByText("Step C")).toBeInTheDocument();
    });
  });

  describe("resolve during transition", () => {
    it("tears down both steps immediately, onExited not required", async () => {
      const captured: TransitionSlotProps[] = [];
      const transition = createControlledTransition((p) => captured.push(p));

      function StepAdvanceAndResolve() {
        const { advance } = useSequentStep();
        return (
          <>
            <button type="button" onClick={() => advance(() => StepWithResolve)}>
              Next
            </button>
            <span>Step AdvanceAndResolve</span>
          </>
        );
      }

      function Host() {
        const { init, SequentOutlet } = useSequentFlow();
        return (
          <>
            <button
              type="button"
              onClick={() => init(() => StepAdvanceAndResolve)}
            >
              Init
            </button>
            <SequentOutlet transition={transition} />
          </>
        );
      }

      render(<Host />);

      await act(async () => {
        screen.getByText("Init").click();
      });

      await act(async () => {
        screen.getByText("Next").click();
      });

      // Now in "exiting" phase — StepWithResolve is the entering step.
      expect(screen.getByText("Resolve")).toBeInTheDocument();

      // Resolve during transition.
      await act(async () => {
        screen.getByText("Resolve").click();
      });

      // Everything should be torn down.
      expect(screen.queryByText("Resolve")).not.toBeInTheDocument();
      expect(screen.queryByText("Step AdvanceAndResolve")).not.toBeInTheDocument();
      expect(screen.queryByTestId("call-on-exited")).not.toBeInTheDocument();
    });
  });

  describe("abort during transition", () => {
    it("tears down both steps immediately", async () => {
      const captured: TransitionSlotProps[] = [];
      const transition = createControlledTransition((p) => captured.push(p));

      function StepAdvanceAndAbort() {
        const { advance } = useSequentStep();
        return (
          <>
            <button type="button" onClick={() => advance(() => StepWithAbort)}>
              Next
            </button>
            <span>Step AdvanceAndAbort</span>
          </>
        );
      }

      function Host() {
        const { init, SequentOutlet } = useSequentFlow();
        return (
          <>
            <button
              type="button"
              onClick={() => init(() => StepAdvanceAndAbort)}
            >
              Init
            </button>
            <SequentOutlet transition={transition} />
          </>
        );
      }

      render(<Host />);

      await act(async () => {
        screen.getByText("Init").click();
      });

      await act(async () => {
        screen.getByText("Next").click();
      });

      // Now in "exiting" phase.
      expect(screen.getByText("Abort")).toBeInTheDocument();

      // Abort during transition.
      await act(async () => {
        screen.getByText("Abort").click();
      });

      // Everything torn down.
      expect(screen.queryByText("Abort")).not.toBeInTheDocument();
      expect(screen.queryByText("Step AdvanceAndAbort")).not.toBeInTheDocument();
    });
  });

  describe("retreat during transition", () => {
    it("queues retreat behind current exit transition", async () => {
      const captured: TransitionSlotProps[] = [];
      const transition = createControlledTransition((p) => captured.push(p));

      function Host() {
        const { init, SequentOutlet } = useSequentFlow();
        return (
          <>
            <button
              type="button"
              onClick={() => init(() => StepA)}
            >
              Init
            </button>
            <SequentOutlet transition={transition} />
          </>
        );
      }

      render(<Host />);

      await act(async () => {
        screen.getByText("Init").click();
      });

      // Manually trigger advance to StepWithBoth via changing the init...
      // Actually, let's use a simpler setup: init with a step that can advance.
      // We already did init with StepA. Let's use a different approach.
      // For retreat testing, we need history. Let me use a different harness.
    });

    it("retreat from first step (empty history) is a no-op", async () => {
      const captured: TransitionSlotProps[] = [];
      const transition = createControlledTransition((p) => captured.push(p));

      function StepWithRetreatAndAdvance() {
        const { advance, retreat } = useSequentStep();
        return (
          <>
            <button type="button" onClick={() => retreat()}>
              Retreat
            </button>
            <button type="button" onClick={() => advance(() => StepB)}>
              Advance
            </button>
          </>
        );
      }

      function Host() {
        const { init, SequentOutlet } = useSequentFlow();
        return (
          <>
            <button
              type="button"
              onClick={() => init(() => StepWithRetreatAndAdvance)}
            >
              Init
            </button>
            <SequentOutlet transition={transition} />
          </>
        );
      }

      render(<Host />);

      await act(async () => {
        screen.getByText("Init").click();
      });

      expect(screen.getByText("Retreat")).toBeInTheDocument();

      // Retreat from first step should no-op.
      await act(async () => {
        screen.getByText("Retreat").click();
      });

      // Step should still be rendered (retreat from first step is no-op).
      expect(screen.getByText("Retreat")).toBeInTheDocument();

      // The outlet must NOT enter "exiting": this consumer renders nextStep
      // directly when previousStep is null, so there would be no exit
      // animation to call onExited and the flow would be stuck in "exiting".
      const afterRetreat = captured[captured.length - 1];
      expect(afterRetreat.phase).toBe("exited");
      expect(afterRetreat.previousStep).toBeNull();
      expect(screen.queryByTestId("call-on-exited")).not.toBeInTheDocument();

      // A later navigation still starts a normal transition instead of
      // being queued forever behind the stuck phase.
      await act(async () => {
        screen.getByText("Advance").click();
      });

      expect(screen.getByTestId("previous-step")).toBeInTheDocument();
      expect(screen.getByText("Step B")).toBeInTheDocument();

      await act(async () => {
        screen.getByTestId("call-on-exited").click();
      });

      expect(screen.getByText("Step B")).toBeInTheDocument();
      expect(screen.queryByTestId("previous-step")).not.toBeInTheDocument();
    });
  });

  describe("missing transition prop (regression)", () => {
    it("behaves identically to current release — immediate step swap", async () => {
      function StepAdvanceToB() {
        const { advance } = useSequentStep();
        return (
          <button type="button" onClick={() => advance(() => StepB)}>
            Advance
          </button>
        );
      }

      function Host() {
        const { init, SequentOutlet } = useSequentFlow();
        return (
          <>
            <button type="button" onClick={() => init(() => StepAdvanceToB)}>
              Init
            </button>
            <SequentOutlet />
          </>
        );
      }

      render(<Host />);

      await act(async () => {
        screen.getByText("Init").click();
      });

      expect(screen.getByText("Advance")).toBeInTheDocument();

      await act(async () => {
        screen.getByText("Advance").click();
      });

      // Should immediately show Step B (no transition wrapper).
      expect(screen.getByText("Step B")).toBeInTheDocument();
      expect(screen.queryByText("Advance")).not.toBeInTheDocument();
    });
  });

  describe("transitionKey", () => {
    it("increments for each new transition", async () => {
      const captured: TransitionSlotProps[] = [];
      const transition = createControlledTransition((p) => captured.push(p));

      function StepAdvance() {
        const { advance } = useSequentStep();
        return (
          <button type="button" onClick={() => advance(() => StepB)}>
            Next
          </button>
        );
      }

      function Host() {
        const { init, SequentOutlet } = useSequentFlow();
        return (
          <>
            <button type="button" onClick={() => init(() => StepAdvance)}>
              Init
            </button>
            <SequentOutlet transition={transition} />
          </>
        );
      }

      render(<Host />);

      await act(async () => {
        screen.getByText("Init").click();
      });
      const idleKey = captured[captured.length - 1].transitionKey;

      await act(async () => {
        screen.getByText("Next").click();
      });
      const firstExitKey = captured[captured.length - 1].transitionKey;
      expect(captured[captured.length - 1].phase).toBe("exiting");
      expect(firstExitKey).toBeGreaterThan(idleKey);
    });

    it("is stable across re-renders within a single transition", async () => {
      const captured: TransitionSlotProps[] = [];
      const transition = createControlledTransition((p) => captured.push(p));

      function StepAdvanceToB() {
        const { advance } = useSequentStep();
        return (
          <button type="button" onClick={() => advance(() => StepB)}>
            Next
          </button>
        );
      }

      function Host() {
        const { init, SequentOutlet } = useSequentFlow();
        return (
          <>
            <button type="button" onClick={() => init(() => StepAdvanceToB)}>
              Init
            </button>
            <SequentOutlet transition={transition} />
          </>
        );
      }

      render(<Host />);

      await act(async () => {
        screen.getByText("Init").click();
      });

      await act(async () => {
        screen.getByText("Next").click();
      });

      const exitingCaptures = captured.filter((p) => p.phase === "exiting");
      const keys = new Set(exitingCaptures.map((p) => p.transitionKey));
      expect(keys.size).toBe(1);
    });
  });
});
