import { act, cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { type RefObject, useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { FlowOutlet, type FlowOutletHandle } from "../../components/FlowOutlet";
import { useFlowInit } from "../useFlowInit";
import { useStep } from "../useStep";

// ---------------------------------------------------------------------------
// Fixture step components
// ---------------------------------------------------------------------------

function StepOne() {
  return <div>Step 1</div>;
}

function StepTwo() {
  return <div>Step 2</div>;
}

function StepWithContext() {
  const { context } = useStep();
  return <div>context:{JSON.stringify(context)}</div>;
}

function StepWithResolve() {
  const { resolve } = useStep();
  return (
    <button type="button" onClick={() => resolve()}>
      Resolve
    </button>
  );
}

function StepWithAbort() {
  const { abort } = useStep();
  return (
    <button type="button" onClick={() => abort()}>
      Abort
    </button>
  );
}

function StepWithAdvance() {
  const { advance } = useStep();
  return (
    <button type="button" onClick={() => advance(() => StepTwo)}>
      Advance
    </button>
  );
}

function StepWithAdvanceAndContext() {
  const { advance } = useStep();
  return (
    <button type="button" onClick={() => advance(() => StepWithContext, { extra: "merged" })}>
      AdvanceCtx
    </button>
  );
}

function StepWithRetreat() {
  const { retreat } = useStep();
  return (
    <button type="button" onClick={() => retreat()}>
      Retreat
    </button>
  );
}

function StepWithResolveValue() {
  const { resolve } = useStep();
  return (
    <button type="button" onClick={() => resolve("success-value")}>
      ResolveValue
    </button>
  );
}

function StepWithAbortReason() {
  const { abort } = useStep();
  return (
    <button type="button" onClick={() => abort("abort-reason")}>
      AbortReason
    </button>
  );
}

// ---------------------------------------------------------------------------
// Host component that wires useFlowInit + FlowOutlet together
// ---------------------------------------------------------------------------

function TestHost({
  onInit,
}: {
  onInit?: (
    initFlow: ReturnType<typeof useFlowInit>["initFlow"],
    ref: RefObject<FlowOutletHandle | null>,
  ) => void;
}) {
  const ref = useRef<FlowOutletHandle>(null);
  const { initFlow } = useFlowInit();
  return (
    <>
      <button type="button" onClick={() => onInit?.(initFlow, ref)}>
        Init
      </button>
      <FlowOutlet ref={ref} />
    </>
  );
}

function TestHostWithPromise({
  step,
  onPromise,
}: {
  step: Parameters<ReturnType<typeof useFlowInit>["initFlow"]>[0];
  onPromise?: (promise: Promise<unknown>) => void;
}) {
  const ref = useRef<FlowOutletHandle>(null);
  const { initFlow } = useFlowInit();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          const p = initFlow(step, ref);
          onPromise?.(p);
        }}
      >
        Init
      </button>
      <FlowOutlet ref={ref} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useFlowInit", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be a function", () => {
    expect(typeof useFlowInit).toBe("function");
  });

  // ── Init ────────────────────────────────────────────────────────────────

  describe("init", () => {
    it("renders the step component in the outlet after calling initFlow", async () => {
      render(
        <TestHost
          onInit={(initFlow, ref) => {
            initFlow(() => StepOne, ref);
          }}
        />,
      );

      // Before init, step should not be present
      expect(screen.queryByText("Step 1")).not.toBeInTheDocument();

      await act(async () => {
        screen.getByText("Init").click();
      });

      expect(screen.getByText("Step 1")).toBeInTheDocument();
    });
  });

  // ── Init with context ──────────────────────────────────────────────────

  describe("init with context", () => {
    it("makes initial context accessible via useStep().context", async () => {
      render(
        <TestHost
          onInit={(initFlow, ref) => {
            initFlow(() => StepWithContext, ref, { name: "hello" });
          }}
        />,
      );

      await act(async () => {
        screen.getByText("Init").click();
      });

      expect(screen.getByText('context:{"name":"hello"}')).toBeInTheDocument();
    });
  });

  // ── Resolve ─────────────────────────────────────────────────────────────

  describe("resolve", () => {
    it("returns the outlet to idle (renders nothing) when resolve() is called", async () => {
      render(
        <TestHost
          onInit={(initFlow, ref) => {
            initFlow(() => StepWithResolve, ref);
          }}
        />,
      );

      // Activate the flow
      await act(async () => {
        screen.getByText("Init").click();
      });
      expect(screen.getByText("Resolve")).toBeInTheDocument();

      // Resolve the flow
      await act(async () => {
        screen.getByText("Resolve").click();
      });

      // Outlet should be idle — no step content rendered
      expect(screen.queryByText("Resolve")).not.toBeInTheDocument();
    });

    it("resolves the initFlow promise with the value passed to resolve()", async () => {
      let promise: Promise<unknown> | undefined;

      render(
        <TestHostWithPromise
          step={() => StepWithResolveValue}
          onPromise={(p) => {
            promise = p;
          }}
        />,
      );

      await act(async () => {
        screen.getByText("Init").click();
      });

      await act(async () => {
        screen.getByText("ResolveValue").click();
      });

      await expect(promise).resolves.toBe("success-value");
    });
  });

  // ── Abort ───────────────────────────────────────────────────────────────

  describe("abort", () => {
    it("returns the outlet to idle (renders nothing) when abort() is called", async () => {
      render(
        <TestHost
          onInit={(initFlow, ref) => {
            initFlow(() => StepWithAbort, ref);
          }}
        />,
      );

      await act(async () => {
        screen.getByText("Init").click();
      });
      expect(screen.getByText("Abort")).toBeInTheDocument();

      await act(async () => {
        screen.getByText("Abort").click();
      });

      expect(screen.queryByText("Abort")).not.toBeInTheDocument();
    });

    it("rejects the initFlow promise with the reason passed to abort()", async () => {
      let promise: Promise<unknown> | undefined;

      render(
        <TestHostWithPromise
          step={() => StepWithAbortReason}
          onPromise={(p) => {
            promise = p;
          }}
        />,
      );

      await act(async () => {
        screen.getByText("Init").click();
      });

      await act(async () => {
        screen.getByText("AbortReason").click();
      });

      await expect(promise).rejects.toBe("abort-reason");
    });
  });

  // ── Advance ─────────────────────────────────────────────────────────────

  describe("advance", () => {
    it("renders the next step and pushes the previous step to history", async () => {
      render(
        <TestHost
          onInit={(initFlow, ref) => {
            initFlow(() => StepWithAdvance, ref);
          }}
        />,
      );

      await act(async () => {
        screen.getByText("Init").click();
      });
      expect(screen.getByText("Advance")).toBeInTheDocument();
      expect(screen.queryByText("Step 2")).not.toBeInTheDocument();

      await act(async () => {
        screen.getByText("Advance").click();
      });

      // StepTwo should now be rendered
      expect(screen.getByText("Step 2")).toBeInTheDocument();
      // StepWithAdvance should no longer be visible
      expect(screen.queryByText("Advance")).not.toBeInTheDocument();
    });
  });

  // ── Retreat ─────────────────────────────────────────────────────────────

  describe("retreat", () => {
    it("returns to the previous step after advancing", async () => {
      // Use a step that can advance, then a step that can retreat
      function StepA() {
        const { advance } = useStep();
        return (
          <button type="button" onClick={() => advance(() => StepB)}>
            Go to B
          </button>
        );
      }

      function StepB() {
        const { retreat } = useStep();
        return (
          <>
            <div>In B</div>
            <button type="button" onClick={() => retreat()}>
              Back
            </button>
          </>
        );
      }

      render(
        <TestHost
          onInit={(initFlow, ref) => {
            initFlow(() => StepA, ref);
          }}
        />,
      );

      // Activate flow
      await act(async () => {
        screen.getByText("Init").click();
      });
      expect(screen.getByText("Go to B")).toBeInTheDocument();

      // Advance to StepB
      await act(async () => {
        screen.getByText("Go to B").click();
      });
      expect(screen.getByText("In B")).toBeInTheDocument();

      // Retreat back to StepA
      await act(async () => {
        screen.getByText("Back").click();
      });
      expect(screen.getByText("Go to B")).toBeInTheDocument();
      expect(screen.queryByText("In B")).not.toBeInTheDocument();
    });

    it("does nothing when history is empty (at the first step)", async () => {
      render(
        <TestHost
          onInit={(initFlow, ref) => {
            initFlow(() => StepWithRetreat, ref);
          }}
        />,
      );

      await act(async () => {
        screen.getByText("Init").click();
      });
      expect(screen.getByText("Retreat")).toBeInTheDocument();

      // Retreat with no history — should stay on the same step
      await act(async () => {
        screen.getByText("Retreat").click();
      });
      expect(screen.getByText("Retreat")).toBeInTheDocument();
    });
  });

  // ── Advance with context patch ──────────────────────────────────────────

  describe("advance with context patch", () => {
    it("merges context patch into the consumer context", async () => {
      render(
        <TestHost
          onInit={(initFlow, ref) => {
            initFlow(() => StepWithAdvanceAndContext, ref, { initial: true });
          }}
        />,
      );

      await act(async () => {
        screen.getByText("Init").click();
      });
      expect(screen.getByText("AdvanceCtx")).toBeInTheDocument();

      // Advance with context patch
      await act(async () => {
        screen.getByText("AdvanceCtx").click();
      });

      // StepWithContext should display merged context
      expect(screen.getByText('context:{"initial":true,"extra":"merged"}')).toBeInTheDocument();
    });

    it("replaces context when patch is not an object", async () => {
      function StepAdvanceScalar() {
        const { advance } = useStep();
        return (
          <button type="button" onClick={() => advance(() => StepWithContext, "replaced")}>
            AdvanceScalar
          </button>
        );
      }

      render(
        <TestHost
          onInit={(initFlow, ref) => {
            initFlow(() => StepAdvanceScalar, ref, { original: true });
          }}
        />,
      );

      await act(async () => {
        screen.getByText("Init").click();
      });

      await act(async () => {
        screen.getByText("AdvanceScalar").click();
      });

      expect(screen.getByText('context:"replaced"')).toBeInTheDocument();
    });
  });

  // ── Error: ref not attached ─────────────────────────────────────────────

  describe("error handling", () => {
    it("throws when initFlow is called with an unattached ref", () => {
      // We need to call the hook outside of the component tree,
      // but hooks can only be called inside components. Instead,
      // capture initFlow from inside a component and call it with
      // a ref that has no current value.
      let capturedInitFlow: ReturnType<typeof useFlowInit>["initFlow"];

      function Capture() {
        const { initFlow } = useFlowInit();
        capturedInitFlow = initFlow;
        return null;
      }

      render(<Capture />);

      const emptyRef = { current: null };

      expect(() => {
        capturedInitFlow(() => StepOne, emptyRef);
      }).toThrowError(
        "FlowOutlet ref is not attached. Ensure <FlowOutlet ref={...} /> is mounted before calling initFlow.",
      );
    });
  });

  // ── Re-init ─────────────────────────────────────────────────────────────

  describe("re-initialization", () => {
    it("can re-init the flow after it has been resolved", async () => {
      render(
        <TestHost
          onInit={(initFlow, ref) => {
            initFlow(() => StepWithResolve, ref);
          }}
        />,
      );

      // First init
      await act(async () => {
        screen.getByText("Init").click();
      });
      expect(screen.getByText("Resolve")).toBeInTheDocument();

      // Resolve
      await act(async () => {
        screen.getByText("Resolve").click();
      });
      expect(screen.queryByText("Resolve")).not.toBeInTheDocument();

      // Re-init
      await act(async () => {
        screen.getByText("Init").click();
      });
      expect(screen.getByText("Resolve")).toBeInTheDocument();
    });
  });

  // ── Idle children ──────────────────────────────────────────────────
  describe("idle children", () => {
    it("renders children when outlet is idle", () => {
      function TestHost() {
        const ref = useRef<FlowOutletHandle>(null);
        return (
          <FlowOutlet ref={ref}>
            <div>Idle Content</div>
          </FlowOutlet>
        );
      }

      render(<TestHost />);
      expect(screen.getByText("Idle Content")).toBeInTheDocument();
    });

    it("hides children when a flow is active", async () => {
      let capturedInitFlow!: ReturnType<typeof useFlowInit>["initFlow"];
      let capturedRef!: RefObject<FlowOutletHandle | null>;

      function TestHost() {
        const ref = useRef<FlowOutletHandle>(null);
        const { initFlow } = useFlowInit();
        capturedInitFlow = initFlow;
        capturedRef = ref;
        return (
          <FlowOutlet ref={ref}>
            <div>Idle Content</div>
          </FlowOutlet>
        );
      }

      render(<TestHost />);
      expect(screen.getByText("Idle Content")).toBeInTheDocument();

      await act(async () => {
        capturedInitFlow(() => StepOne, capturedRef);
      });

      expect(screen.queryByText("Idle Content")).not.toBeInTheDocument();
      expect(screen.getByText("Step 1")).toBeInTheDocument();
    });

    it("shows children again after resolve", async () => {
      let capturedInitFlow!: ReturnType<typeof useFlowInit>["initFlow"];
      let capturedRef!: RefObject<FlowOutletHandle | null>;

      function TestHost() {
        const ref = useRef<FlowOutletHandle>(null);
        const { initFlow } = useFlowInit();
        capturedInitFlow = initFlow;
        capturedRef = ref;
        return (
          <FlowOutlet ref={ref}>
            <div>Idle Content</div>
          </FlowOutlet>
        );
      }

      render(<TestHost />);
      expect(screen.getByText("Idle Content")).toBeInTheDocument();

      await act(async () => {
        capturedInitFlow(() => StepWithResolve, capturedRef);
      });

      expect(screen.queryByText("Idle Content")).not.toBeInTheDocument();

      await act(async () => {
        screen.getByText("Resolve").click();
      });

      expect(screen.getByText("Idle Content")).toBeInTheDocument();
    });

    it("shows children again after abort", async () => {
      let capturedInitFlow!: ReturnType<typeof useFlowInit>["initFlow"];
      let capturedRef!: RefObject<FlowOutletHandle | null>;

      function TestHost() {
        const ref = useRef<FlowOutletHandle>(null);
        const { initFlow } = useFlowInit();
        capturedInitFlow = initFlow;
        capturedRef = ref;
        return (
          <FlowOutlet ref={ref}>
            <div>Idle Content</div>
          </FlowOutlet>
        );
      }

      render(<TestHost />);
      expect(screen.getByText("Idle Content")).toBeInTheDocument();

      await act(async () => {
        capturedInitFlow(() => StepWithAbort, capturedRef);
      });

      expect(screen.queryByText("Idle Content")).not.toBeInTheDocument();

      await act(async () => {
        screen.getByText("Abort").click();
      });

      expect(screen.getByText("Idle Content")).toBeInTheDocument();
    });

    it("renders nothing when idle with no children", () => {
      function TestHost() {
        const ref = useRef<FlowOutletHandle>(null);
        return (
          <div data-testid="wrapper">
            <FlowOutlet ref={ref} />
          </div>
        );
      }

      render(<TestHost />);
      expect(screen.getByTestId("wrapper").innerHTML).toBe("");
    });
  });
});
