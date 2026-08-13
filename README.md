<div align="center">

# react-sequent

**Step-driven React flows — no centralized state map required.**

[![npm version](https://img.shields.io/npm/v/react-sequent?style=flat-square)](https://www.npmjs.com/package/react-sequent)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![GitHub Actions](https://img.shields.io/github/actions/workflow/status/ganondev/react-sequent/ci.yml?style=flat-square&label=Build)](https://github.com/ganondev/react-sequent/actions)

</div>

`react-sequent` is a lightweight React utility for flows where **the current step decides what comes next** — not a centralized transition map.

Branching is a normal `if` statement. Adding a step means writing a new component, not editing a config. Async steps load on demand with no extra wiring. It is built for the kinds of flows that live in modals, drawers, onboarding paths, and checkout sections.

```bash
npm install react-sequent
```

> **Peer dependencies:** `react` and `react-dom` `^16.14.0 || ^17 || ^18 || ^19`

---

## Why react-sequent?

Most flow and wizard libraries ask you to define the entire state graph up front — every state, every transition, every branch — in a centralized config object. This works well for long-lived machines that exist independently of your UI, but it adds friction for the kinds of flows that live **inside** a UI component: a modal, a checkout section, an onboarding tooltip sequence.

`react-sequent` takes the opposite approach. **The step decides what comes next.** There is no separate transition map to keep in sync, no machine definition sitting above your components. If a step needs to branch, it writes a normal `if` statement. If you remove a step, you delete a component — nothing else breaks.

This makes simple flows faster to build, easier to change, and less brittle when the shape of the UI evolves. The library is intentionally opinionated about **architecture**, not about every possible flow problem.

There is a second, subtler difference: **flow state lives independently of the component that starts it.** Call `init()` from a button click, a useEffect, or a parent component — the outlet doesn't care. The flow isn't tethered to the caller's lifecycle; it runs inside the outlet's provider boundary, which stays mounted as long as the outlet is rendered. This means you can reuse the same outlet for entirely different flows — start a login flow, then tear it down and start a checkout flow — without remounting chrome, losing context, or wrapping each flow in its own closure. There are no dangling active or inactive flags to track per flow either — `react-sequent` manages outlet state internally, so consumers never need to manage lifecycle state at all, not even remembering to tear down a completed or aborted flow.

---

## Quick start

```tsx
import * as React from "react";
import { useSequentFlow, useSequentStep } from "react-sequent";

function WelcomeStep() {
  const { advance } = useSequentStep<string>();
  return (
    <div>
      <h3>Welcome</h3>
      <button onClick={() => advance(() => ConfirmStep)}>Continue</button>
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

export function App() {
  const { init, result, SequentOutlet } = useSequentFlow<string>();

  React.useEffect(() => {
    if (result?.status === "resolved") {
      console.log("Flow completed:", result.value);
    }
  }, [result]);

  return (
    <>
      <SequentOutlet />
      <button onClick={() => init(() => WelcomeStep)}>Start flow</button>
    </>
  );
}
```

---

## Features

### Steps own transitions

There is no wizard config, no machine definition, no centralized graph. Each step calls `advance()` with whatever comes next. Branching is a plain `if`:

```tsx
function PaymentStep() {
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

Add, remove, or reorder steps without touching anything outside the step component itself.

### Async steps, no ceremony

Pass a dynamic import — or do async work and return an element. The outlet owns the `Suspense` boundary.

```tsx
// Lazy-load a step module
advance(() => import("./HeavyProfileStep"));

// Fetch data, then render the next step with props
advance(async () => {
  const user = await fetchUser();
  return <ProfileStep user={user} />;
});
```

> [!TIP]
> You never need to call `React.lazy()` yourself — the library normalizes async factories internally.

### Stable chrome

Wrap the step in modal chrome, progress bars, or headers that stay mounted across transitions — no flicker during async step loading.

```tsx
<SequentOutlet
  fallback={<p>Loading step…</p>}
  chrome={(step) => (
    <Modal>
      <ModalHeader title="Checkout" />
      <ModalBody>{step}</ModalBody>
    </Modal>
  )}
/>
```

Chrome reads flow state via `useSequentContext()`. Steps write chrome-relevant data into context via `advance`'s `contextPatch` parameter.

### Animated transitions

Step swaps are immediate by default. Add a `transition` render prop to `SequentOutlet` to animate between steps — the outlet mounts the outgoing and incoming step together and passes you both elements plus `phase`, `onExited`, and `transitionKey`:

```tsx
<SequentOutlet
  transition={({ previousStep, nextStep, phase, onExited, transitionKey }) =>
    phase === "exited" ? (
      nextStep
    ) : (
      <div style={{ position: "relative" }}>
        <div
          key={`exit-${transitionKey}`}
          style={{ position: "absolute", animation: "fadeOut 300ms" }}
          onAnimationEnd={onExited}
        >
          {previousStep}
        </div>
        <div key={`enter-${transitionKey}`} style={{ animation: "fadeIn 300ms" }}>
          {nextStep}
        </div>
      </div>
    )
  }
/>
```

Wire the signals to CSS, framer-motion, GSAP, or any animation library. The outgoing step keeps its component instance (local state and effects) while it animates out. Without the `transition` prop, behavior is unchanged.

### Flow context

Carry shared data across steps without prop-drilling:

```tsx
init(() => Step1, { name: "Alice", plan: "pro" });

function Step1() {
  const { advance, context } = useSequentStep();
  return <button onClick={() => advance(() => Step2, { verified: true })}>Next</button>;
}
```

### Hooks with separated concerns

| Hook | Where to use | Capabilities |
|---|---|---|
| `useSequentFlow` | Flow entry point (host) | `init()`, `SequentOutlet`, `status`, `result` |
| `useSequentStep` | Inside active step components | `advance`, `retreat`, `resolve`, `abort`, `context` |
| `useSequentContext` | Chrome, idle children, any consumer inside the outlet | `context`, `resolve`, `abort` |

`useSequentStep()` throws if called outside the active step's subtree — chrome and idle children must use `useSequentContext()`.

---

## When to use it

`react-sequent` is a strong fit when your flow is:

- **Short and UI-local** — embedded in a modal, drawer, page section, or onboarding path
- **Iterative** — likely to change shape as the product evolves
- **Easier to express as step-level logic** than as a centralized graph

Examples: onboarding flows, multi-step forms, modal confirmations, checkout sections, inline "are you sure?" sequences.

> [!NOTE]
> Reach for a state machine (XState, Zag, etc.) when you need a long or highly complex flow, a global state graph independent of rendered components, strict up-front visibility of all states, or transitions driven primarily by external systems.

---

## API at a glance

### `useSequentFlow<TResult>()`

```tsx
const { init, status, result, SequentOutlet } = useSequentFlow<string>();
```

- **`init(stepLoader, initialContext?)`** — starts the flow
- **`status`** — `"idle"` | `"active"`
- **`result`** — `{ status: "resolved", value } | { status: "aborted", reason } | null`
- **`SequentOutlet`** — bound outlet component for rendering the active step; accepts `children`, `fallback`, `errorStep`, `chrome`, and `transition`

### `useSequentStep<TResult>()`

```tsx
const { advance, retreat, resolve, abort, context } = useSequentStep();
```

- **`advance(stepLoader, contextPatch?)`** — move to the next step
- **`retreat()`** — go back to the previous step (history stack)
- **`resolve(value?)`** — complete the flow successfully
- **`abort(reason?)`** — exit the flow without completing
- **`context`** — flow-scoped data from `init()` or `advance`

### `useSequentContext<TContext>()`

```tsx
const { context, resolve, abort } = useSequentContext();
```

For chrome and idle children — flow state without navigation.

---

## Docs & demos

- [Getting started](https://ganondev.github.io/react-sequent/docs/getting-started/)
- [Core concepts](https://ganondev.github.io/react-sequent/docs/concepts/)
- [API reference](https://ganondev.github.io/react-sequent/docs/api/use-sequent-flow/)
- [Demos](https://ganondev.github.io/react-sequent/docs/demos/subsection-flow/)