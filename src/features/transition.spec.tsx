import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import type { TransitionSlotProps } from "../components/FlowOutlet";
import { useSequentFlow } from "../hooks/useSequentFlow";
import { useSequentStep } from "../hooks/useSequentStep";

// ── Fixture step components ──────────────────────────────────────────

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

type InitFn = ReturnType<typeof useSequentFlow>["init"];

// ── Host with transition prop ────────────────────────────────────────

interface TransitionHostProps {
  children?: ReactNode;
  chrome?: (children: ReactNode) => ReactNode;
  onCaptureInit?: (init: InitFn) => void;
  onCaptureTransition?: (props: TransitionSlotProps) => void;
}

/**
 * A host that renders SequentOutlet with a transition prop.
 * Captures `init` synchronously during render (not on button click).
 * The transition captures props and provides a "Done" button
 * to trigger onExited during the "exiting" phase.
 */
function TransitionHost({
  children,
  chrome,
  onCaptureInit,
  onCaptureTransition,
}: TransitionHostProps) {
  const { init, SequentOutlet } = useSequentFlow();

  // Capture init synchronously — same pattern as existing BDD hosts.
  if (onCaptureInit) {
    onCaptureInit(init);
  }

  const transition = (p: TransitionSlotProps): ReactNode => {
    onCaptureTransition?.(p);
    // Pass through directly when settled.
    if (p.phase === "exited" || !p.previousStep) {
      return p.nextStep;
    }
    // Transition mode: render both steps with a Done button.
    return (
      <div>
        <div data-testid="previous-step">{p.previousStep}</div>
        <div data-testid="next-step">{p.nextStep}</div>
        <button
          type="button"
          data-testid="call-on-exited"
          onClick={() => p.onExited()}
        >
          Done
        </button>
      </div>
    );
  };

  return (
    <SequentOutlet transition={transition} chrome={chrome}>
      {children}
    </SequentOutlet>
  );
}

// ── Host without transition (legacy) ─────────────────────────────────

function LegacyHost({
  onCaptureInit,
}: {
  onCaptureInit?: (init: InitFn) => void;
}) {
  const { init, SequentOutlet } = useSequentFlow();

  if (onCaptureInit) {
    onCaptureInit(init);
  }

  return <SequentOutlet />;
}

const feature = await loadFeature("src/features/transition.feature");

describeFeature(feature, ({ Scenario }) => {
  // ── Helpers ──────────────────────────────────────────────────────

  /** Render TransitionHost and capture init + transition props. */
  function setupTransitionHost(
    opts?: Omit<TransitionHostProps, "children">,
  ): {
    init: InitFn;
    capturedProps: TransitionSlotProps[];
  } {
    const result = {
      init: null as unknown as InitFn,
      capturedProps: [] as TransitionSlotProps[],
    };

    cleanup();
    render(
      <TransitionHost
        chrome={opts?.chrome}
        onCaptureInit={(i) => {
          result.init = i;
        }}
        onCaptureTransition={(p) => result.capturedProps.push(p)}
      />,
    );

    return result;
  }

  /** Render LegacyHost and capture init. */
  function setupLegacyHost(): { init: InitFn } {
    const result = { init: null as unknown as InitFn };

    cleanup();
    render(
      <LegacyHost
        onCaptureInit={(i) => {
          result.init = i;
        }}
      />,
    );

    return result;
  }

  // ── Scenario: Initial step renders without a transition ───────────

  Scenario("Initial step renders without a transition", ({ Given, When, Then, And }) => {
    let init: InitFn;
    let capturedProps: TransitionSlotProps[];

    Given("a host with a transition render prop", () => {
      const s = setupTransitionHost();
      init = s.init;
      capturedProps = s.capturedProps;
      expect(init).toBeDefined();
    });

    When("init is called with a sync step loader", async () => {
      await act(async () => {
        init(() => StepA);
      });
    });

    Then('the transition slot is invoked with phase "exited"', () => {
      const last = capturedProps[capturedProps.length - 1];
      expect(last.phase).toBe("exited");
    });

    And("previousStep is null", () => {
      const last = capturedProps[capturedProps.length - 1];
      expect(last.previousStep).toBeNull();
    });

    And("the step is visible in the DOM", () => {
      expect(screen.getByText("Step A")).toBeInTheDocument();
    });
  });

  // ── Scenario: Advance triggers a dual-mount transition ────────────

  Scenario("Advance triggers a dual-mount transition", ({ Given, And, When, Then }) => {
    let init: InitFn;
    let capturedProps: TransitionSlotProps[];

    function StepWithAdvanceBtn() {
      const { advance } = useSequentStep();
      return (
        <button type="button" onClick={() => advance(() => StepB)}>
          Advance
        </button>
      );
    }

    Given("a host with a transition render prop", () => {
      const s = setupTransitionHost();
      init = s.init;
      capturedProps = s.capturedProps;
    });

    And('a flow on step A with an "Advance" button to step B', async () => {
      await act(async () => {
        init(() => StepWithAdvanceBtn);
      });
    });

    When('the user clicks "Advance"', async () => {
      await act(async () => {
        screen.getByText("Advance").click();
      });
    });

    Then('the transition slot is invoked with phase "exiting"', () => {
      const last = capturedProps[capturedProps.length - 1];
      expect(last.phase).toBe("exiting");
    });

    And("previousStep contains step A", () => {
      // previousStep is a ReactNode — we verify by checking the DOM.
      expect(screen.getByTestId("previous-step")).toBeInTheDocument();
      expect(screen.getByTestId("previous-step").textContent).toContain("Advance");
    });

    And("nextStep contains step B", () => {
      expect(screen.getByTestId("next-step")).toBeInTheDocument();
      expect(screen.getByText("Step B")).toBeInTheDocument();
    });

    And("both step A and step B are present in the DOM", () => {
      expect(screen.getByText("Advance")).toBeInTheDocument();
      expect(screen.getByText("Step B")).toBeInTheDocument();
    });
  });

  // ── Scenario: onExited completes the transition ───────────────────

  Scenario("onExited completes the transition", ({ Given, And, When, Then }) => {
    let init: InitFn;
    let capturedProps: TransitionSlotProps[];

    function StepWithAdvanceBtn() {
      const { advance } = useSequentStep();
      return (
        <button type="button" onClick={() => advance(() => StepB)}>
          Advance
        </button>
      );
    }

    Given("a host with a transition render prop", () => {
      const s = setupTransitionHost();
      init = s.init;
      capturedProps = s.capturedProps;
    });

    And('a flow is in the "exiting" phase transitioning from step A to step B', async () => {
      await act(async () => {
        init(() => StepWithAdvanceBtn);
      });
      await act(async () => {
        screen.getByText("Advance").click();
      });
      // Verify we're in exiting phase.
      expect(screen.getByTestId("call-on-exited")).toBeInTheDocument();
    });

    When("the consumer calls onExited", async () => {
      await act(async () => {
        screen.getByTestId("call-on-exited").click();
      });
    });

    Then('the transition slot is invoked with phase "exited"', () => {
      const last = capturedProps[capturedProps.length - 1];
      expect(last.phase).toBe("exited");
    });

    And("previousStep is null", () => {
      const last = capturedProps[capturedProps.length - 1];
      expect(last.previousStep).toBeNull();
    });

    And("step A is no longer in the DOM", () => {
      expect(screen.queryByTestId("previous-step")).not.toBeInTheDocument();
    });

    And("step B remains visible", () => {
      expect(screen.getByText("Step B")).toBeInTheDocument();
    });
  });

  // ── Scenario: Resolve during transition tears down ────────────────

  Scenario("Resolve during transition tears down both steps", ({ Given, And, When, Then }) => {
    let init: InitFn;

    function StepAdvanceToResolve() {
      const { advance } = useSequentStep();
      return (
        <>
          <button type="button" onClick={() => advance(() => StepWithResolve)}>
            Advance
          </button>
          <span>Outgoing Step</span>
        </>
      );
    }

    Given("a host with a transition render prop", () => {
      const { init: i } = setupTransitionHost();
      init = i;
    });

    And('a flow is in the "exiting" phase where the entering step has a "Resolve" button', async () => {
      await act(async () => {
        init(() => StepAdvanceToResolve);
      });
      await act(async () => {
        screen.getByText("Advance").click();
      });
      // In exiting phase, entering step (StepWithResolve) is mounted.
      expect(screen.getByText("Resolve")).toBeInTheDocument();
    });

    When('the user clicks "Resolve"', async () => {
      await act(async () => {
        screen.getByText("Resolve").click();
      });
    });

    Then("both the exiting step and the entering step are removed from the DOM", () => {
      expect(screen.queryByText("Outgoing Step")).not.toBeInTheDocument();
      expect(screen.queryByText("Resolve")).not.toBeInTheDocument();
    });

    And("the outlet returns to idle", () => {
      // After resolve, the outlet should show children (if any) or nothing.
      expect(screen.queryByTestId("call-on-exited")).not.toBeInTheDocument();
      expect(screen.queryByTestId("previous-step")).not.toBeInTheDocument();
      expect(screen.queryByTestId("next-step")).not.toBeInTheDocument();
    });
  });

  // ── Scenario: Abort during transition tears down ──────────────────

  Scenario("Abort during transition tears down both steps", ({ Given, And, When, Then }) => {
    let init: InitFn;

    function StepAdvanceToAbort() {
      const { advance } = useSequentStep();
      return (
        <>
          <button type="button" onClick={() => advance(() => StepWithAbort)}>
            Advance
          </button>
          <span>Outgoing Step</span>
        </>
      );
    }

    Given("a host with a transition render prop", () => {
      const { init: i } = setupTransitionHost();
      init = i;
    });

    And('a flow is in the "exiting" phase where the entering step has an "Abort" button', async () => {
      await act(async () => {
        init(() => StepAdvanceToAbort);
      });
      await act(async () => {
        screen.getByText("Advance").click();
      });
      expect(screen.getByText("Abort")).toBeInTheDocument();
    });

    When('the user clicks "Abort"', async () => {
      await act(async () => {
        screen.getByText("Abort").click();
      });
    });

    Then("both the exiting step and the entering step are removed from the DOM", () => {
      expect(screen.queryByText("Outgoing Step")).not.toBeInTheDocument();
      expect(screen.queryByText("Abort")).not.toBeInTheDocument();
    });

    And("the outlet returns to idle", () => {
      expect(screen.queryByTestId("call-on-exited")).not.toBeInTheDocument();
    });
  });

  // ── Scenario: Entering step queues a navigation during exit ───────

  Scenario("Entering step can queue a navigation during exit", ({ Given, And, When, Then }) => {
    let init: InitFn;

    function StepAdvanceToQueue() {
      const { advance } = useSequentStep();
      return (
        <button type="button" onClick={() => advance(() => StepQueue)}>
          Advance
        </button>
      );
    }

    function StepQueue() {
      const { advance } = useSequentStep();
      return (
        <button type="button" onClick={() => advance(() => StepC)}>
          Queue Next
        </button>
      );
    }

    Given("a host with a transition render prop", () => {
      const { init: i } = setupTransitionHost();
      init = i;
    });

    And('a flow is in the "exiting" phase transitioning from step A to step B', async () => {
      await act(async () => {
        init(() => StepAdvanceToQueue);
      });
      await act(async () => {
        screen.getByText("Advance").click();
      });
      expect(screen.getByTestId("call-on-exited")).toBeInTheDocument();
    });

    And('step B has a "Queue Next" button that advances to step C', () => {
      expect(screen.getByText("Queue Next")).toBeInTheDocument();
    });

    When('the user clicks "Queue Next"', async () => {
      await act(async () => {
        screen.getByText("Queue Next").click();
      });
    });

    And("the consumer calls onExited", async () => {
      await act(async () => {
        screen.getByTestId("call-on-exited").click();
      });
    });

    Then("a new transition begins from step B to step C", () => {
      // After onExited, the queued advance drains — a new exiting phase starts.
      expect(screen.getByTestId("call-on-exited")).toBeInTheDocument();
      expect(screen.getByText("Step C")).toBeInTheDocument();
    });

    And("after calling onExited again, step C is the settled step", async () => {
      await act(async () => {
        screen.getByTestId("call-on-exited").click();
      });
      expect(screen.getByText("Step C")).toBeInTheDocument();
      expect(screen.queryByTestId("call-on-exited")).not.toBeInTheDocument();
      expect(screen.queryByText("Queue Next")).not.toBeInTheDocument();
    });
  });

  // ── Scenario: Entering step navigates from its mount effect ───────

  Scenario(
    "Navigation from the entering step mount effect starts a new transition",
    ({ Given, And, When, Then }) => {
      let init: InitFn;
      let capturedProps: TransitionSlotProps[];

      function StepWithAdvanceBtn() {
        const { advance } = useSequentStep();
        return (
          <button type="button" onClick={() => advance(() => StepAutoAdvance)}>
            Advance
          </button>
        );
      }

      /**
       * Mounts twice: first as the incoming step during the "exiting" phase,
       * then again as the settled current step during the "entering" phase.
       * The component instance is remounted between phases, so a component
       * ref would reset — track mounts in the scenario closure instead.
       * Auto-advances only on that second mount, mimicking a step that
       * navigates from its mount effect (e.g. an auto-skipped step).
       */
      let mountCount = 0;
      function StepAutoAdvance() {
        const { advance } = useSequentStep();
        useEffect(() => {
          mountCount += 1;
          if (mountCount > 1) {
            advance(() => StepC);
          }
        }, [advance]);
        return <div>Auto Step B</div>;
      }

      Given("a host with a transition render prop", () => {
        const s = setupTransitionHost();
        init = s.init;
        capturedProps = s.capturedProps;
      });

      And(
        'a flow on a step with an "Advance" button to a step that auto-advances when entering',
        async () => {
          await act(async () => {
            init(() => StepWithAdvanceBtn);
          });
        },
      );

      When('the user clicks "Advance"', async () => {
        await act(async () => {
          screen.getByText("Advance").click();
        });
      });

      And("the consumer calls onExited", async () => {
        await act(async () => {
          screen.getByTestId("call-on-exited").click();
        });
      });

      Then('the transition slot is invoked with phase "exiting"', () => {
        const last = capturedProps[capturedProps.length - 1];
        expect(last.phase).toBe("exiting");
      });

      And("previousStep contains the entering step", () => {
        expect(screen.getByTestId("previous-step").textContent).toContain("Auto Step B");
      });

      And("the auto-advanced step is mounted as the nextStep", () => {
        expect(screen.getByTestId("next-step").textContent).toContain("Step C");
      });
    },
  );

  // ── Scenario: No transition prop = legacy ─────────────────────────

  Scenario("No transition prop behaves identically to legacy mode", ({ Given, And, When, Then }) => {
    let init: InitFn;

    function StepWithAdvanceBtn() {
      const { advance } = useSequentStep();
      return (
        <button type="button" onClick={() => advance(() => StepB)}>
          Advance
        </button>
      );
    }

    Given("a host without a transition render prop", () => {
      const s = setupLegacyHost();
      init = s.init;
    });

    And('a flow on a step with an "Advance" button to another step', async () => {
      await act(async () => {
        init(() => StepWithAdvanceBtn);
      });
      expect(screen.getByText("Advance")).toBeInTheDocument();
    });

    When('the user clicks "Advance"', async () => {
      await act(async () => {
        screen.getByText("Advance").click();
      });
    });

    Then("the new step appears immediately", () => {
      expect(screen.getByText("Step B")).toBeInTheDocument();
    });

    And("the old step is no longer in the DOM", () => {
      expect(screen.queryByText("Advance")).not.toBeInTheDocument();
    });
  });

  // ── Scenario: Chrome survives across transitions ──────────────────

  Scenario("Chrome survives across transitions", ({ Given, And, When, Then }) => {
    let init: InitFn;
    let chromeRenderCount = 0;

    function StepWithAdvanceBtn() {
      const { advance } = useSequentStep();
      return (
        <button type="button" onClick={() => advance(() => StepB)}>
          Advance
        </button>
      );
    }

    function chrome(children: ReactNode): ReactNode {
      chromeRenderCount++;
      return <div data-testid="chrome">{children}</div>;
    }

    Given("a host with a transition render prop and a chrome wrapper", () => {
      const s = setupTransitionHost({ chrome });
      init = s.init;
    });

    And('a flow on step A with an "Advance" button to step B', async () => {
      await act(async () => {
        init(() => StepWithAdvanceBtn);
      });
    });

    When('the user clicks "Advance"', async () => {
      const beforeCount = chromeRenderCount;
      await act(async () => {
        screen.getByText("Advance").click();
      });
      // Chrome should still be present, not remounted.
      expect(chromeRenderCount).toBe(beforeCount + 1); // one additional render for the phase change
      // But the key point: chrome element is still in DOM.
    });

    Then("the chrome wrapper element remains in the DOM", () => {
      expect(screen.getByTestId("chrome")).toBeInTheDocument();
    });

    And("the chrome wrapper is not remounted", () => {
      // Chrome is never unmounted during a transition — only at flow start/end.
      // We verify by checking it still wraps both steps.
      const chromeEl = screen.getByTestId("chrome");
      expect(chromeEl).toBeInTheDocument();
      // The chrome should contain the transition output.
      expect(screen.getByTestId("previous-step")).toBeInTheDocument();
      expect(screen.getByTestId("next-step")).toBeInTheDocument();
    });
  });
});
