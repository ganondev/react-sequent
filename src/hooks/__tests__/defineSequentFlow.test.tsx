import { act, cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { defineSequentFlow } from "../../defineSequentFlow";

interface CheckoutContext {
  cartId: string;
  shippingAddress?: string;
}

interface CheckoutResult {
  orderId: string;
}

const { useSequentFlow, useSequentStep, useSequentContext } = defineSequentFlow<
  CheckoutContext,
  CheckoutResult
>();

function ReviewStep() {
  const { context, resolve } = useSequentStep();

  return (
    <button type="button" onClick={() => resolve({ orderId: context.cartId })}>
      Finish:{context.shippingAddress ?? "missing"}
    </button>
  );
}

function ShippingStep() {
  const { context, advance } = useSequentStep();

  return (
    <button
      type="button"
      onClick={() => advance(() => ReviewStep, { shippingAddress: `${context.cartId}-ship` })}
    >
      Next
    </button>
  );
}

function FlowChrome() {
  const { context } = useSequentContext();
  return <div>chrome:{context?.shippingAddress ?? "idle"}</div>;
}

function IdleReader() {
  const { context } = useSequentContext();
  return <div>idle:{context?.shippingAddress ?? "empty"}</div>;
}

type InitFn = ReturnType<typeof useSequentFlow>["init"];

function TypedHost({
  children,
  onInit,
}: {
  children?: ReactNode;
  onInit?: (init: InitFn) => void;
}) {
  const { init, status, result, SequentOutlet } = useSequentFlow();

  const resultLabel =
    result === null
      ? "none"
      : result.status === "resolved"
        ? `resolved:${result.value.orderId}`
        : "aborted";

  return (
    <>
      <button type="button" onClick={() => onInit?.(init)}>
        Init
      </button>
      <div>
        flow:{status}:{resultLabel}
      </div>
      <SequentOutlet
        chrome={(step) => (
          <>
            <FlowChrome />
            {step}
          </>
        )}
      >
        {children}
      </SequentOutlet>
    </>
  );
}

describe("defineSequentFlow", () => {
  afterEach(() => {
    cleanup();
  });

  it("returns typed wrapper hooks", () => {
    expect(typeof useSequentFlow).toBe("function");
    expect(typeof useSequentStep).toBe("function");
    expect(typeof useSequentContext).toBe("function");
  });

  it("starts a flow through the typed useSequentFlow() wrapper", async () => {
    render(
      <TypedHost
        onInit={(init) => {
          init(() => ShippingStep, { cartId: "cart-1" });
        }}
      />,
    );

    await act(async () => {
      screen.getByText("Init").click();
    });

    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.getByText("chrome:idle")).toBeInTheDocument();
  });

  it("narrows advance() patches while preserving runtime merge behavior", async () => {
    render(
      <TypedHost
        onInit={(init) => {
          init(() => ShippingStep, { cartId: "cart-2" });
        }}
      />,
    );

    await act(async () => {
      screen.getByText("Init").click();
    });

    await act(async () => {
      screen.getByText("Next").click();
    });

    expect(screen.getByText("Finish:cart-2-ship")).toBeInTheDocument();
    expect(screen.getByText("chrome:cart-2-ship")).toBeInTheDocument();
  });

  it("returns undefined typed context to idle children before the first resolved flow", () => {
    render(
      <TypedHost>
        <IdleReader />
      </TypedHost>,
    );

    expect(screen.getByText("idle:empty")).toBeInTheDocument();
  });

  it("resolves with the typed TResult and preserves last resolved idle context", async () => {
    render(
      <TypedHost
        onInit={(init) => {
          init(() => ShippingStep, { cartId: "cart-3", shippingAddress: "saved" });
        }}
      >
        <IdleReader />
      </TypedHost>,
    );

    expect(screen.getByText("idle:empty")).toBeInTheDocument();

    await act(async () => {
      screen.getByText("Init").click();
    });

    await act(async () => {
      screen.getByText("Next").click();
    });

    await act(async () => {
      screen.getByText("Finish:cart-3-ship").click();
    });

    expect(screen.getByText("flow:idle:resolved:cart-3")).toBeInTheDocument();
    expect(screen.getByText("idle:cart-3-ship")).toBeInTheDocument();
  });
});
