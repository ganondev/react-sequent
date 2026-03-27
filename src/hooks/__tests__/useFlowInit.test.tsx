import { act, cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useSequentContext } from "../useSequentContext";
import { useSequentFlow } from "../useSequentFlow";
import { useSequentStep } from "../useSequentStep";

type InitFn = ReturnType<typeof useSequentFlow>["init"];

function StepOne() {
  return <div>Step 1</div>;
}

function StepTwo() {
  return <div>Step 2</div>;
}

function StepWithContext() {
  const { context } = useSequentStep();
  return <div>context:{JSON.stringify(context)}</div>;
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

function StepWithAdvance() {
  const { advance } = useSequentStep();
  return (
    <button type="button" onClick={() => advance(() => StepTwo)}>
      Advance
    </button>
  );
}

function StepWithAdvanceAndContext() {
  const { advance } = useSequentStep();
  return (
    <button type="button" onClick={() => advance(() => StepWithContext, { extra: "merged" })}>
      AdvanceCtx
    </button>
  );
}

function StepWithRetreat() {
  const { retreat } = useSequentStep();
  return (
    <button type="button" onClick={() => retreat()}>
      Retreat
    </button>
  );
}

function StepWithResolveValue() {
  const { resolve } = useSequentStep();
  return (
    <button type="button" onClick={() => resolve("success-value")}>
      ResolveValue
    </button>
  );
}

function StepWithAbortReason() {
  const { abort } = useSequentStep();
  return (
    <button type="button" onClick={() => abort("abort-reason")}>
      AbortReason
    </button>
  );
}

function TestHost({ children, onInit }: { children?: ReactNode; onInit?: (init: InitFn) => void }) {
  const { init, SequentOutlet } = useSequentFlow();

  return (
    <>
      <button type="button" onClick={() => onInit?.(init)}>
        Init
      </button>
      <SequentOutlet>{children}</SequentOutlet>
    </>
  );
}

function TestHostWithPromise({
  onPromise,
  step,
}: {
  onPromise?: (promise: Promise<unknown>) => void;
  step: Parameters<InitFn>[0];
}) {
  const { init, SequentOutlet } = useSequentFlow();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          const promise = init(step);
          onPromise?.(promise);
        }}
      >
        Init
      </button>
      <SequentOutlet />
    </>
  );
}

describe("useSequentFlow", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be a function", () => {
    expect(typeof useSequentFlow).toBe("function");
  });

  describe("init", () => {
    it("renders the step component in the bound outlet after calling init", async () => {
      render(
        <TestHost
          onInit={(init) => {
            init(() => StepOne);
          }}
        />,
      );

      expect(screen.queryByText("Step 1")).not.toBeInTheDocument();

      await act(async () => {
        screen.getByText("Init").click();
      });

      expect(screen.getByText("Step 1")).toBeInTheDocument();
    });
  });

  describe("init with context", () => {
    it("makes initial context accessible via useSequentStep().context", async () => {
      render(
        <TestHost
          onInit={(init) => {
            init(() => StepWithContext, { name: "hello" });
          }}
        />,
      );

      await act(async () => {
        screen.getByText("Init").click();
      });

      expect(screen.getByText('context:{"name":"hello"}')).toBeInTheDocument();
    });
  });

  describe("resolve", () => {
    it("returns the outlet to idle when resolve() is called", async () => {
      render(
        <TestHost
          onInit={(init) => {
            init(() => StepWithResolve);
          }}
        />,
      );

      await act(async () => {
        screen.getByText("Init").click();
      });
      expect(screen.getByText("Resolve")).toBeInTheDocument();

      await act(async () => {
        screen.getByText("Resolve").click();
      });

      expect(screen.queryByText("Resolve")).not.toBeInTheDocument();
    });

    it("resolves the init promise with the value passed to resolve()", async () => {
      let promise: Promise<unknown> | undefined;

      render(
        <TestHostWithPromise
          onPromise={(nextPromise) => {
            promise = nextPromise;
          }}
          step={() => StepWithResolveValue}
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

  describe("abort", () => {
    it("returns the outlet to idle when abort() is called", async () => {
      render(
        <TestHost
          onInit={(init) => {
            init(() => StepWithAbort);
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

    it("rejects the init promise with the reason passed to abort()", async () => {
      let promise: Promise<unknown> | undefined;

      render(
        <TestHostWithPromise
          onPromise={(nextPromise) => {
            promise = nextPromise;
          }}
          step={() => StepWithAbortReason}
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

  describe("advance", () => {
    it("renders the next step and pushes the previous step to history", async () => {
      render(
        <TestHost
          onInit={(init) => {
            init(() => StepWithAdvance);
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

      expect(screen.getByText("Step 2")).toBeInTheDocument();
      expect(screen.queryByText("Advance")).not.toBeInTheDocument();
    });
  });

  describe("retreat", () => {
    it("returns to the previous step after advancing", async () => {
      function StepA() {
        const { advance } = useSequentStep();
        return (
          <button type="button" onClick={() => advance(() => StepB)}>
            Go to B
          </button>
        );
      }

      function StepB() {
        const { retreat } = useSequentStep();
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
          onInit={(init) => {
            init(() => StepA);
          }}
        />,
      );

      await act(async () => {
        screen.getByText("Init").click();
      });
      expect(screen.getByText("Go to B")).toBeInTheDocument();

      await act(async () => {
        screen.getByText("Go to B").click();
      });
      expect(screen.getByText("In B")).toBeInTheDocument();

      await act(async () => {
        screen.getByText("Back").click();
      });
      expect(screen.getByText("Go to B")).toBeInTheDocument();
      expect(screen.queryByText("In B")).not.toBeInTheDocument();
    });

    it("does nothing when history is empty", async () => {
      render(
        <TestHost
          onInit={(init) => {
            init(() => StepWithRetreat);
          }}
        />,
      );

      await act(async () => {
        screen.getByText("Init").click();
      });
      expect(screen.getByText("Retreat")).toBeInTheDocument();

      await act(async () => {
        screen.getByText("Retreat").click();
      });
      expect(screen.getByText("Retreat")).toBeInTheDocument();
    });
  });

  describe("advance with context patch", () => {
    it("merges context patch into the consumer context", async () => {
      render(
        <TestHost
          onInit={(init) => {
            init(() => StepWithAdvanceAndContext, { initial: true });
          }}
        />,
      );

      await act(async () => {
        screen.getByText("Init").click();
      });
      expect(screen.getByText("AdvanceCtx")).toBeInTheDocument();

      await act(async () => {
        screen.getByText("AdvanceCtx").click();
      });

      expect(screen.getByText('context:{"initial":true,"extra":"merged"}')).toBeInTheDocument();
    });

    it("replaces context when patch is not an object", async () => {
      function StepAdvanceScalar() {
        const { advance } = useSequentStep();
        return (
          <button type="button" onClick={() => advance(() => StepWithContext, "replaced")}>
            AdvanceScalar
          </button>
        );
      }

      render(
        <TestHost
          onInit={(init) => {
            init(() => StepAdvanceScalar, { original: true });
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

  describe("error handling", () => {
    it("throws when init is called before the bound outlet is mounted", () => {
      let capturedInit!: InitFn;

      function Capture() {
        const { init } = useSequentFlow();
        capturedInit = init;
        return null;
      }

      render(<Capture />);

      expect(() => {
        capturedInit(() => StepOne);
      }).toThrowError(
        "SequentOutlet is not mounted. Ensure <SequentOutlet /> is rendered before calling init().",
      );
    });
  });

  describe("re-initialization", () => {
    it("can re-init the flow after it has been resolved", async () => {
      render(
        <TestHost
          onInit={(init) => {
            init(() => StepWithResolve);
          }}
        />,
      );

      await act(async () => {
        screen.getByText("Init").click();
      });
      expect(screen.getByText("Resolve")).toBeInTheDocument();

      await act(async () => {
        screen.getByText("Resolve").click();
      });
      expect(screen.queryByText("Resolve")).not.toBeInTheDocument();

      await act(async () => {
        screen.getByText("Init").click();
      });
      expect(screen.getByText("Resolve")).toBeInTheDocument();
    });
  });

  describe("bound SequentOutlet", () => {
    it("renders children when idle", () => {
      render(
        <TestHost>
          <div>Idle Content</div>
        </TestHost>,
      );

      expect(screen.getByText("Idle Content")).toBeInTheDocument();
    });

    it("hides children when a flow is active", async () => {
      render(
        <TestHost
          onInit={(init) => {
            init(() => StepOne);
          }}
        >
          <div>Idle Content</div>
        </TestHost>,
      );

      expect(screen.getByText("Idle Content")).toBeInTheDocument();

      await act(async () => {
        screen.getByText("Init").click();
      });

      expect(screen.queryByText("Idle Content")).not.toBeInTheDocument();
      expect(screen.getByText("Step 1")).toBeInTheDocument();
    });

    it("shows children again after resolve", async () => {
      render(
        <TestHost
          onInit={(init) => {
            init(() => StepWithResolve);
          }}
        >
          <div>Idle Content</div>
        </TestHost>,
      );

      await act(async () => {
        screen.getByText("Init").click();
      });

      expect(screen.queryByText("Idle Content")).not.toBeInTheDocument();

      await act(async () => {
        screen.getByText("Resolve").click();
      });

      expect(screen.getByText("Idle Content")).toBeInTheDocument();
    });

    it("shows children again after abort", async () => {
      render(
        <TestHost
          onInit={(init) => {
            init(() => StepWithAbort);
          }}
        >
          <div>Idle Content</div>
        </TestHost>,
      );

      await act(async () => {
        screen.getByText("Init").click();
      });

      expect(screen.queryByText("Idle Content")).not.toBeInTheDocument();

      await act(async () => {
        screen.getByText("Abort").click();
      });

      expect(screen.getByText("Idle Content")).toBeInTheDocument();
    });

    it("preserves the last resolved context for idle children", async () => {
      function IdleContextReader() {
        const { context } = useSequentContext<{ note?: string }>();
        return <div>idle:{context?.note ?? "empty"}</div>;
      }

      function ResolvingStep() {
        const { resolve } = useSequentStep();
        return (
          <button type="button" onClick={() => resolve("done")}>
            Done
          </button>
        );
      }

      render(
        <TestHost
          onInit={(init) => {
            init(() => ResolvingStep, { note: "remembered" });
          }}
        >
          <IdleContextReader />
        </TestHost>,
      );

      expect(screen.getByText("idle:empty")).toBeInTheDocument();

      await act(async () => {
        screen.getByText("Init").click();
      });

      await act(async () => {
        screen.getByText("Done").click();
      });

      expect(screen.getByText("idle:remembered")).toBeInTheDocument();
    });

    it("renders nothing when idle with no children", () => {
      function EmptyHost() {
        const { SequentOutlet } = useSequentFlow();
        return (
          <div data-testid="wrapper">
            <SequentOutlet />
          </div>
        );
      }

      render(<EmptyHost />);
      expect(screen.getByTestId("wrapper").innerHTML).toBe("");
    });
  });
});
