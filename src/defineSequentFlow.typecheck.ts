import type { ComponentType } from "react";
import { defineSequentFlow } from "./defineSequentFlow";

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

declare const StepComponent: ComponentType;
declare const flowApi: ReturnType<typeof useSequentFlow>;
declare const stepApi: ReturnType<typeof useSequentStep>;
declare const contextApi: ReturnType<typeof useSequentContext>;

const flowPromise: Promise<CheckoutResult> = flowApi.init(() => StepComponent, {
  cartId: "cart-1",
});
const activeContext: CheckoutContext = stepApi.context;
const maybeIdleContext: CheckoutContext | undefined = contextApi.context;

stepApi.advance(() => StepComponent, { shippingAddress: "123 Main" });
stepApi.resolve({ orderId: "order-1" });
contextApi.resolve({ orderId: "order-2" });

void flowPromise;
void activeContext;
void maybeIdleContext;

// @ts-expect-error typed flows require an initial context
flowApi.init(() => StepComponent);

// @ts-expect-error wrong initial context shape
flowApi.init(() => StepComponent, { orderId: "bad" });

// @ts-expect-error wrong context patch shape
stepApi.advance(() => StepComponent, { paymentMethod: "card" });

// @ts-expect-error wrong resolve payload shape
stepApi.resolve({ ok: true });

// @ts-expect-error typed flow context must be a plain object
defineSequentFlow<string, void>();

// @ts-expect-error typed flow context must be a plain object
defineSequentFlow<string[]>();
