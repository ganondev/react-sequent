# Animated Transition Support — Design Spec

**Date:** 2026-08-11  
**Status:** Draft  
**Scope:** `src/components/FlowOutlet.tsx`, public API surface

## Problem

When `advance()` or `retreat()` is called, the old step component unmounts immediately as the new step mounts. There is no window where both steps coexist in the DOM, making animated transitions (crossfade, slide, etc.) impossible.

## Design

### Core Principle

A single new optional prop on `SequentOutlet` — `transition` — enables the transition codepath. When absent, behavior is identical to the current release (immediate swap, zero overhead).

### New Public API

```ts
interface TransitionSlotProps {
  /** The outgoing step element. `null` when no transition is in flight. */
  previousStep: ReactNode | null;
  /** The incoming/current step element. Always present when a flow is active. */
  nextStep: ReactNode;
  /** Current phase:
   *  - `"exiting"`  — previous step is animating out; `onExited` is expected.
   *  - `"entering"` — previous step has unmounted; the next step renders for
   *    one tick in this phase (enter-animation window) before settling.
   *  - `"exited"`   — the flow is settled and ready for the next navigation.
   */
  phase: "exiting" | "entering" | "exited";
  /** Call to signal the exit animation has completed. Only meaningful during
   *  the `"exiting"` phase; calling it in other phases is a no-op. */
  onExited: () => void;
  /** Monotonically increasing identity of the current transition. Increments
   *  each time a new exit transition starts — including back-to-back queued
   *  transitions where `previousStep` swaps without ever becoming `null`.
   *  Consumers attach it as a React `key` on animation wrapper elements so
   *  each transition remounts them and restarts their animations. */
  transitionKey: number;
}

// Added to existing FlowOutletProps:
interface FlowOutletProps {
  // ... existing props (children, fallback, errorStep, chrome)
  /** When provided, the outlet enters transition mode. The render prop is invoked
   *  whenever a flow is active, including during transitions. When absent, the
   *  outlet performs immediate step swaps with no dual-mounting. */
  transition?: (props: TransitionSlotProps) => ReactNode;
}
```

### Lifecycle

```
  phase: "exited"
  previousStep: null
  nextStep: <current step>
        │
        │ advance() / retreat()
        ▼
  phase: "exiting"
  previousStep: <old step>
  nextStep: <new step>
        │
        │ onExited()
        ▼
  phase: "entering"
  previousStep: null (unmounted)
  nextStep: <new step>
        │
        │ (settles after one tick)
        ▼
  phase: "exited"
  previousStep: null
  nextStep: <new step> (now current)
        │
        ├── queue non-empty ──▶ phase: "exiting" (next queued transition)
        │
        └── queue empty ──▶ (remain "exited")
```

The transition render prop is **always invoked** when `transition` is defined and a flow is active. The consumer uses `phase` and `previousStep` to decide what to render:
- `phase === "exiting"` — a transition is in flight; render the animated layout (both `previousStep` and `nextStep` are mounted).
- `phase === "entering"` — the exit animation has completed and `previousStep` has unmounted. The entering step renders alone for one tick so consumers can trigger an enter animation (e.g. slide-in, fade-in). No `onExited` call is expected; the phase advances to `"exited"` automatically.
- `phase === "exited"` (and `previousStep === null`) — the flow is settled; render `nextStep` directly.

### Usage Examples

**Crossfade (simultaneous):**

```tsx
<SequentOutlet
  transition={({ previousStep, nextStep, phase, onExited, transitionKey }) => {
    if (phase === "exited") return nextStep;
    return (
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
    );
  }}
/>
```

**Sequential (exit then enter):**

```tsx
<SequentOutlet
  transition={({ previousStep, nextStep, phase, onExited, transitionKey }) => {
    if (phase === "exited") return nextStep;
    return (
      <div style={{ position: "relative" }}>
        {previousStep && (
          <div
            key={`exit-${transitionKey}`}
            style={{ position: "absolute", animation: "slideOutLeft 300ms" }}
            onAnimationEnd={onExited}
          >
            {previousStep}
          </div>
        )}
        {!previousStep && (
          <div key={`enter-${transitionKey}`} style={{ animation: "slideInRight 300ms" }}>
            {nextStep}
          </div>
        )}
      </div>
    );
  }}
/>
```

**Framer Motion:**

```tsx
<SequentOutlet
  transition={({ previousStep, nextStep, phase, onExited, transitionKey }) => {
    if (phase === "exited") return nextStep;
    return (
      <AnimatePresence onExitComplete={onExited}>
        {previousStep && (
          <motion.div key={`exit-${transitionKey}`} exit={{ opacity: 0 }}>
            {previousStep}
          </motion.div>
        )}
        <motion.div
          key={`enter-${transitionKey}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {nextStep}
        </motion.div>
      </AnimatePresence>
    );
  }}
/>
```

Note the keys derive from `transitionKey` rather than static strings.
`AnimatePresence` detects exits by a child key disappearing from the children
set; with a static `key="exit"`, back-to-back queued transitions (where
`previousStep` swaps without becoming `null`) would never be detected as an
exit and `onExitComplete` would never fire. See
[Back-to-back transitions and wrapper identity](#back-to-back-transitions-and-wrapper-identity).

## Edge Cases

### Back-to-back Transitions and Wrapper Identity

When a queued navigation drains, the outlet moves directly from one `"exiting"`
phase into the next: `previousStep` swaps (e.g. Step1 → Step2) **without ever
becoming `null`** in between. React's reconciliation sees the same wrapper
element type at the same position and reuses the existing DOM node.

This breaks every animation approach, not just raw CSS:

- **Raw CSS `animation`** — the `animation` shorthand string is unchanged, so
  the browser never restarts the animation and `animationend` never fires.
- **Framer Motion** — explicitly skips animating when the `animate` target
  equals the current value; `onAnimationComplete` never re-fires (verified
  empirically and in `motion-dom` source).
- **react-transition-group** — `CSSTransition` only exits when its `in` prop
  flips to `false`, which never happens here; `onExited` never fires.
- **react-spring** — `useSpring` skips animation on an identical target;
  `onRest` never re-fires.

In every case the completion callback deadlocks: `phase` stays `"exiting"`,
`previousStep` stays truthy, and the outlet renders a permanently blank
finished-animation wrapper.

The fix is **transition identity**: `transitionKey` increments on every new
exit transition. Consumers attach it as a React `key` on their animation
wrappers, forcing React to unmount the stale wrapper and mount a fresh one
whose animation starts from scratch. This mirrors the keyed-presence contract
of `AnimatePresence`, `TransitionGroup`, and `useTransition` — and of
`location.key` in router-driven page transitions. The library must distribute
the key because the render prop cannot use hooks to mint its own, and a
module-level counter would collide across concurrent flows.

### Navigation During Transition

**Invariant: one transition per step.** After a step dispatches its first
`advance()` or `retreat()` call, all subsequent navigation calls from that same
step render are silently dropped. The library enforces this via a monotonic
epoch counter:

- Each step render is assigned the current epoch.
- When a transition is *accepted* (the "exiting" phase begins), the epoch
  increments. The step that initiated the transition is now stale — its epoch
  no longer matches the current counter — and any further calls from it are
  no-ops.
- The incoming step receives the new epoch and may dispatch its own transition
  when ready.

While `phase === "exiting"`, the **entering** step (the new step fading in)
may call `advance()` or `retreat()` to enqueue a navigation for after the
current exit animation completes. The **exiting** step's calls are always
dropped (it already transitioned). The queue holds at most one entry — each
new enqueue replaces the previous, so only the latest navigation is kept.
When `onExited()` fires, the outlet drains the queued entry and starts a
fresh transition.

If the consumer needs to navigate multiple steps, each step must dispatch its
own transition after mounting. Rapid successive calls from the same step are
collapsed: only the first is accepted, subsequent ones are no-ops.

### Resolve / Abort During Transition

`resolve()` or `abort()` during any transition phase immediately tears down both steps. `onExited` is never expected. This is documented behavior. The flow terminates cleanly with no dangling state.

### Retreat During Transition

`retreat()` during a transition queues identically to `advance()`. The history predecessor becomes the pending next step. The transition is not canceled or rewound — arbitrary CSS/JS animations cannot be reliably interrupted, so the current transition plays to completion before the retreat is processed.

### First Advance (No Prior Step)

On the initial `advance()` call that starts a flow, there is no previous step. The outlet renders the first step through the `transition` render prop with `phase: "exited"` and `previousStep: null`. The consumer should render `nextStep` directly when `phase === "exited"` (or equivalently, when `previousStep === null`).

### Chrome

The `chrome` prop wraps the output of the `transition` slot. Chrome does not receive `phase` or any transition state. It is never unmounted during a transition — only when the entire flow starts or ends.

## Non-Goals (Deferred)

- **`onEntered` callback** — the entering step's settle signal. Deferred to a future release. The entering step can manage its own post-mount logic via `useEffect`.
- **Transition direction awareness** — no built-in concept of "forward" vs. "backward" transitions. The consumer can derive direction from their own state if needed.
- **Transition cancellation** — no API to abort a transition mid-flight. The exiting animation must play to completion.

## API Impact

| Surface | Change |
|---------|--------|
| `FlowOutletProps` | New optional `transition` prop |
| `TransitionSlotProps` | New exported type |
| `useSequentFlow` | No change |
| `useSequentStep` | No change |
| `useSequentContext` | No change |
| `advance()` | No change |
| `retreat()` | No change |
| `SequentOutlet` | Accepts `transition` prop |

**Backward compatibility:** Full. No existing API is modified or removed.

## Internal Changes

`FlowOutlet.tsx` gains:
- Three epoch refs — `transitionEpochRef` (monotonic counter), `currentStepEpochRef` (entering/active step), `previousStepEpochRef` (exiting step) — that enforce **one transition per step**: navigation callbacks check their step's epoch against the counter, and stale calls (from a step that already transitioned) are silently dropped
- A `transitionQueue` ref holding at most one `{ type: "advance", stepLoader: StepLoader, contextPatch?: unknown } | { type: "retreat" }` entry — each new enqueue replaces the previous
- A `phase` state (`"exiting" | "entering" | "exited"`) matching the public `TransitionSlotProps.phase`
- Branching: when `transition` prop is present, navigate through the phase machine; when absent, immediate swap (existing codepath)
- Queue drain logic on `onExited`: if a queued entry exists, start next transition with `phase: "exiting"`; if empty, advance through `"entering"` to `"exited"`
- The `transition` render prop is invoked on every render when defined and a flow is active, passing the current phase and step elements

### Amendment (2026-08-13): Step Instance Retention

Review found that the original implementation stored only the previous step's
*component type* and reconstructed it with `createElement` in the
`previousStep` slot — unmounting the original subtree and mounting a fresh
instance, so local state reset and effects re-ran before the exit animation.

Because the render prop lets consumers place `previousStep`/`nextStep` in
arbitrary, phase-dependent tree positions, retention cannot rely on React
reconciliation of the slot elements. Instead, each mounted step gets a
persistent `StepRecord { id, Component, host }`: the full step subtree
(`StepContext.Provider` → `FlowErrorBoundary` → `Suspense` → step) renders
through a keyed `createPortal` into a stable `display: contents` host element,
and the slot props are lightweight `StepSlot` placeholders that adopt the host
DOM via `appendChild` in a layout effect. Consequences:

- The outgoing step keeps its instance (state + effects) for the whole exit.
- The entering step no longer remounts between the `"exiting"` and
  `"entering"` phases.
- Each record has its own error boundary; new steps always start clean.
- History (`retreat`) still stores component types — a restored step is a
  fresh instance, as before.

Covered by the "outgoing step instance retention" test.

## Testing

Test suite: `src/internal/__tests__/flow-outlet-transition.test.tsx`.

Scenarios:
1. `transition` prop causes dual-mount of previous and next step
2. `onExited` advances phase from `"exiting"` → `"exited"`, unmounts `previousStep`
3. Rapid `advance()` calls queue in FIFO order
4. `resolve()` during transition tears down both steps, `onExited` not required
5. `abort()` during transition tears down both steps
6. `retreat()` during transition queues behind current transition
7. Chrome is not unmounted/re-mounted during a transition
8. First `advance()` (initial flow start) renders step through transition slot with `phase: "exited"`, `previousStep: null`
9. Absent `transition` prop matches current release behavior (regression)
10. `transitionKey` increments for every new transition, including queued back-to-back transitions where `previousStep` never becomes `null`
11. `transitionKey` is stable across re-renders within a single transition
12. A step may only transition once — subsequent `advance()`/`retreat()` calls from the same step render are silently dropped (epoch guard)
13. The entering step may enqueue a navigation during the "exiting" phase; the exiting step's calls are always dropped

## Documentation

- `docs/concepts.mdx` — new "Animated Transitions" section
- API reference — `FlowOutletProps.transition` and `TransitionSlotProps`
- Storybook — new `TransitionFlow.stories.tsx` (crossfade + sequential examples)
- `static/llms.txt` — updated with `TransitionSlot` and `TransitionSlotProps`
