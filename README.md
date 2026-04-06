# react-sequent

**Step-driven React flows for modals, onboarding, multi-step forms, and other short UI sequences.**

`react-sequent` is a lightweight React utility for flows where **the current step decides what comes next**.

That means no centralized transition map, no machine config to keep in sync, and no giant “wizard definition” sitting above your components. Branching lives where it is easiest to read: inside the step that is making the decision.

It is built for flows that are **short, local, and UI-driven** — the kinds of flows that usually live inside a modal, a settings section, an onboarding sequence, or a checkout subsection.

## Why it exists

Most flow libraries ask you to define the whole graph up front.

`react-sequent` takes the opposite approach:

- A step can `advance()` to whatever comes next.
- A step can branch with a normal `if` statement.
- A step can `resolve()` or `abort()` the flow explicitly.
- The host owns the outlet. The step owns the transition.

That makes simple flows faster to build, easier to change, and less brittle when the shape of the UI changes.

## Install

```bash
npm install react-sequent
```

**Peer dependencies:** `react` and `react-dom` `^16.14.0 || ^17 || ^18 || ^19`

## 30-second example

```tsx
import * as React from "react";
import { useSequentFlow, useSequentStep } from "react-sequent";

function WelcomeStep() {
  const { advance } = useSequentStep<string>();

  return (
    <div>
      <h3>Welcome</h3>
      <p>This flow is step-driven.</p>
      <button onClick={() => advance(() => ConfirmStep)}>
        Continue
      </button>
    </div>
  );
}

function ConfirmStep() {
  const { retreat, resolve } = useSequentStep<string>();

  return (
    <div>
      <h3>Confirm</h3>
      <button onClick={retreat}>Back</button>
      <button onClick={() => resolve("done")}>Finish</button>
    </div>
  );
}

export function Example() {
  const { init, status, result, SequentOutlet } = useSequentFlow<string>();

  React.useEffect(() => {
    if (status === "idle" && result?.status === "resolved") {
      console.log("Flow completed:", result.value);
    }
  }, [status, result]);

  return (
    <>
      <SequentOutlet />
      <button onClick={() => init(() => WelcomeStep)}>
        Start flow
      </button>
    </>
  );
}
```

## What makes it different

### 1. The step decides what comes next

Most wizard-style tools centralize transitions in one config object.

With `react-sequent`, the active step decides:

```tsx
function PaymentMethodStep() {
  const { advance } = useSequentStep();

  const handleSelect = (method: "card" | "bank") => {
    if (method === "card") {
      advance(() => CardStep);
    } else {
      advance(() => BankTransferStep);
    }
  };

  return <PaymentMethodPicker onSelect={handleSelect} />;
}
```

Branching is just application logic. Add or remove steps without rewriting a separate transition map.

### 2. Async steps are a first-class path

You can advance to sync or async steps. The outlet owns the `Suspense` boundary, so step components stay focused on flow logic.

```tsx
function AccountStep() {
  const { advance } = useSequentStep();

  const handleContinue = () => {
    advance(() => import("./HeavyProfileStep"));
  };

  return <button onClick={handleContinue}>Continue</button>;
}
```

You can also do async work before rendering the next step:

```tsx
advance(async () => {
  const user = await fetchUser();
  return <ProfileStep user={user} />;
});
```

### 3. Stable chrome stays mounted

For modal headers, progress bars, close buttons, and other shell UI, `SequentOutlet` supports chrome that stays mounted while steps change or load.

```tsx
function CheckoutModal() {
  const { init, SequentOutlet } = useSequentFlow();

  return (
    <>
      <SequentOutlet
        fallback={<p>Loading step…</p>}
        chrome={(step) => (
          <Modal>
            <ModalHeader title="Checkout" />
            <ModalBody>{step}</ModalBody>
          </Modal>
        )}
      />

      <button onClick={() => init(() => ShippingStep)}>
        Begin checkout
      </button>
    </>
  );
}
```

This is especially useful when the outer UI should remain visually stable across transitions.

### 4. Typed flows are opt-in, not mandatory

If you want stronger typing across the host, steps, and chrome, define a typed scope once and reuse it.

```tsx
import { defineSequentFlow } from "react-sequent";

interface SignupContext {
  email: string;
  plan?: string;
}

interface SignupResult {
  accountId: string;
}

const {
  useSequentFlow,
  useSequentStep,
  useSequentContext,
} = defineSequentFlow<SignupContext, SignupResult>();
```

This keeps `init()`, `useSequentStep()`, and `useSequentContext()` aligned without introducing a registry or changing runtime behavior.

## API at a glance

### `useSequentFlow()`

Creates a flow host and returns:

- `init(stepLoader, initialContext?)`
- `status`
- `result`
- `SequentOutlet`

Use it at the point where the flow starts.

### `useSequentStep()`

Use this inside active step components. It gives you:

- `advance`
- `retreat`
- `resolve`
- `abort`
- `context`

This is the hook that drives the flow.

### `useSequentContext()`

Use this in outlet-level chrome or idle children when you need flow context or termination controls, but **not** navigation.

### `defineSequentFlow()`

Creates typed wrappers around the hooks for a specific flow context/result shape.

## Good fit

`react-sequent` is a strong fit when your flow is:

- short and UI-local
- embedded in a modal, drawer, page section, or onboarding path
- easier to express as step-level logic than as a centralized graph
- likely to change shape while you iterate on the product

Examples:

- onboarding flows
- multi-step forms
- modal confirmations
- embedded checkout or settings flows
- inline “are you sure?” or “finish setup” sequences

## Not the right fit

Reach for a more traditional state machine or graph-oriented tool when you need:

- a long or highly complex flow
- a global state graph that exists independently of rendered components
- strict visualization of every state and transition up front
- transitions that are primarily driven by external systems rather than step UI

`react-sequent` is intentionally opinionated about **architecture**, not about every possible flow problem.

## Mental model

Think in terms of three layers:

1. **Host** — starts the flow with `init()` and renders `SequentOutlet`
2. **Step** — owns transition logic with `advance`, `retreat`, `resolve`, and `abort`
3. **Chrome** — stable wrapper UI that can read flow context without becoming a navigation surface

That separation is the point. It keeps the API small and the responsibilities obvious.

## Docs and demos

- [Getting Started](https://ganondev.github.io/react-sequent/docs/getting-started/)
- [Core Concepts](https://ganondev.github.io/react-sequent/docs/concepts/)
- [API: useSequentFlow](https://ganondev.github.io/react-sequent/docs/api/use-sequent-flow/)
- [Demos](https://ganondev.github.io/react-sequent/docs/demos/subsection-flow/)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT. See [LICENSE.md](./LICENSE.md).