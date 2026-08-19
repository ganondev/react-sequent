# Design Spec: `onFlowStarted` Flow Lifecycle Hook

- **Date:** 2026-08-18
- **Status:** Approved (design) — pending user review of this spec
- **Target version:** 1.2.0
- **Scope:** `react-sequent` core (`src/`), docs, version alignment
- **Supersedes:** `2026-08-17-browser-back-retreat-design.md` (deleted; retained in git history)

## Summary

Add an opt-in prop `onFlowStarted` to `FlowOutlet`. The callback fires once per flow
activation with a controls object (`retreat`, `abort`, `getHistoryDepth`), and its return
value is a cleanup function that runs when the flow settles. Consumers compose use cases —
notably browser-Back-to-retreat — themselves on top of this hook.

This replaces the previously approved `retreatOnBrowserBack` design: the library no longer
implements browser-back interception internally. No sentinel module, no popstate handling,
no armed-outlet lock in library code.

## Idea Evaluation

**Verdict: good idea.** A lifecycle hook generalizes the browser-back use case instead of
hardcoding it. One hook serves browser-back interception, imperative controllers, analytics,
and anything else that needs to react to a flow starting, while the sentinel-based browser-back
logic stays where it belongs — consumer-owned (with a vetted recipe in the docs).

The library remains "the current step decides what's next": it owns flow state and retreat
semantics, and merely exposes them at the outlet level. The controls are the same retreat/abort
paths step components already get via `useSequentStep` — no new flow behavior is invented.

Rejected alternative from the previous spec: built-in `retreatOnBrowserBack` (specific use
case in core; sentinel cleanup, StrictMode races, and the single-armed-outlet lock all become
library responsibility). Rejected now: exposing the same capability via the imperative handle
(`subscribeLifecycle` on `FlowOutletHandle`) — worse JSX ergonomics, no gain.

## Goals / Non-goals

Goals:

- Opt-in notification when a flow activates, with always-current controls usable from
  long-lived listeners (e.g. `popstate`).
- A cleanup return value so consumers can register/unregister listeners symmetrically.
- Reuse the existing retreat/abort machinery unchanged (direct mode, transition mode,
  exit-transition queueing, first-step no-op invariant, flow-id guards).
- Zero behavior change for consumers who do not pass the prop.

Non-goals:

- No browser-back implementation, sentinel management, or history writes in the library.
- No URL changes, no deep-linking of steps.
- No retreat guards or cancellation.
- No default-on behavior.
- No other lifecycle events (`onFlowEnded`, step-level hooks) — YAGNI. The cleanup return
  covers end-of-flow needs.

## Public API

`FlowOutletProps` gains:

```ts
export interface FlowStartedControls {
  /** Pop history to the previous step. Routes through the existing
   *  transition/direct retreat machinery, including queueing during an
   *  exit transition. First-step no-op invariant preserved. */
  retreat: () => void;
  /** Abort the flow, same as step-level `abort()`. */
  abort: (reason?: unknown) => void;
  /** Always-current history depth of the active flow. 0 = first step.
   *  Consumers read this to distinguish "retreat" from "abort + fall through". */
  getHistoryDepth: () => number;
}

export interface FlowOutletProps {
  // ...existing props...
  onFlowStarted?: (controls: FlowStartedControls) => void | (() => void);
}
```

- `FlowStartedControls` is exported from `src/components/FlowOutlet.tsx` and re-exported
  from `src/index.ts`.
- Available on `SequentOutlet` from `useSequentFlow` (whose props are
  `ComponentPropsWithoutRef<typeof FlowOutlet>`) and on `defineSequentFlow`-based outlets
  through the same path. No other public API changes.
- Default `undefined` behaves as "no subscription, zero overhead".

## Behavior Contract

Documented to consumers in `docs/docs/api/flow-outlet.mdx`:

1. **Fires once per activation** (in dev under StrictMode, subscribe → cleanup → subscribe
   due to double-invoked effects — see contract #6). Fires in a layout effect after the first
   step commits (before paint). The `onActivated` parameter of `activate()` remains synchronous
   and is unchanged.
2. **Cleanup runs exactly once**: when the flow settles (resolve or abort), when the outlet
   unmounts while a flow is active, or when `activate()` re-enters to start a new flow (old
   subscription cleaned up first, then a new subscription starts).
3. **Prop identity changes mid-flow are ignored** — the subscription is per-activation, not
   per-render. Consumers should pass a stable callback (or `useCallback`).
4. **Controls are always-current**: `retreat`/`abort` delegate through refs mirrored every
   render, and `getHistoryDepth` reads the current `FlowState`. Safe to call from a listener
   registered at activation and held for the whole flow.
5. **First step**: `retreat()` is a no-op (existing invariant) and `getHistoryDepth()`
   returns `0` — the consumer decides what to do there (the docs recipe aborts and lets the
   browser fall through).
6. **StrictMode (dev)**: double-invoked effects mean subscribe → cleanup → subscribe.
   Consumers must keep their listeners idempotent; the docs recipe is. Documented as a
   consumer contract.
7. **Idle or prop unset**: the callback never fires; no listeners, no overhead.
8. **Callback/cleanup throws**: propagate through the layout effect to the app's error
   boundary. Documented.
9. **Navigation between steps** does not re-subscribe and does not run the cleanup;
   `getHistoryDepth()` tracks the new depth.
10. **Post-settle control calls are no-ops**: after flow settles (resolve, abort, unmount),
    `retreat()` hits the null-state guard on all retreat paths, `abort()` returns early inside
    the inline guard closure, and `getHistoryDepth()` reads `flowStateRef.current ?? null`,
    returning `0`. The consumer never sees half-settled state from a late call.
11. **`getHistoryDepth() === 0` ambiguity**: this value occurs both at the first step and
    after settlement. It is harmless for the docs recipe (which aborts at depth 0 anyway), but
    consumers reading this during their listener should not interpret it as "we're still at the
    first step" without checking `flowStateRef.current !== null` separately. Documented as a
    consumer contract.
12. **Prop identity ignored** — `onFlowStarted` is deliberately excluded from effect deps so
    the activation-time callback persists. Suppress the linter (`// biome-ignore lint/correctness/exhaustive-deps: prop identity change mid-flow must be ignored per contract`). See contract #3.

## Design

All implementation lives in `src/components/FlowOutlet.tsx`. Existing retreat machinery
(`directRetreat`, `transitionRetreat`, `queueRetreat`, `retreatState`, `settleFlow`) is
reused unchanged. No new internal modules.

### Ref mirrors

All three mirrors use **every-render `useLayoutEffect`** (no dependency array) — adopted from
the predecessor spec's reviewed design decision for exactly this problem. `useLayoutEffect` is
required: it flushes synchronously in the commit task, before the browser can dispatch any
event, so a listener (e.g. `popstate`) registered by the consumer can never observe stale refs.

The controls object is created **once per activation** with stable identity, but must read
and call current state for the whole flow. `flowState` is `useState` state (its `history`
list is not a ref), and `transitionRetreat`/`settleFlow("abort")` are recreated per render — so
plain closure captures would freeze at activation-time values. The design therefore adds:

- `flowStateRef` — mirror of `flowState`, assigned every render (new; no such ref exists
  today). `getHistoryDepth` reads `flowStateRef.current?.history.length ?? 0`.
- `retreatHandlerRef` — mirrored every render to `props.transition ? transitionRetreat :
  directRetreat`. `controls.retreat` delegates to it.
- `abortHandlerRef` — mirrored every render to a guarded `settleFlow("abort")` closure that
  preserves the current render's flow-id guard. Because `guardedAbort` is defined below the
  early `if (flowState === null) return` in FlowOutlet, the guard is implemented as an inline
  check (`if (flowIdRef.current !== activeFlowId) return; settleFlow("abort", reason)`) within
  the same render pass, ensuring the closure captures the correct flow id without depending on
  `guardedAbort`'s lexical scope. `controls.abort` delegates to it.

The mirrors are **derived** values with a single assignment point per render — they cannot
drift, unlike a parallel depth counter maintained at each mutation site.

### Subscription effect

- Subscription effect — a `useLayoutEffect` with dependencies
  `[flowState !== null, activeFlowId]` (where `activeFlowId = flowIdRef.current`):
  `flowIdRef` already increments inside `activate()` ([FlowOutlet.tsx](src/components/FlowOutlet.tsx)),
  making a separate epoch counter redundant.

  - Runs on idle→active: build the controls object, invoke `onFlowStarted`, store its
    cleanup.
  - Runs on re-activation while active (flowId changes): old cleanup runs, new subscription
    starts.
  - Effect cleanup (runs on active→idle, flowId change, and unmount): invoke the stored
    consumer cleanup exactly once.
  - Navigation between steps changes neither dependency — no re-subscription.

Settling flips `flowState !== null`, so cleanup runs. Layout-effect timing closes the
staleness window before browser events can observe it (same argument as the previous spec).

### SSR

The callback invocation happens in an effect; nothing runs during server render.

## Edge-case matrix

| Situation | Behavior |
| --- | --- |
| Flow activates with prop set | Callback fires once after first step commits |
| Flow settles (resolve or abort) | `onResolve`/`onAbort` fire synchronously during settle; the subscription cleanup runs in that commit's effect cleanup |
| Outlet unmounts while active | Cleanup runs |
| `activate()` re-enters while active | Old cleanup runs; new subscription starts with fresh controls |
| Consumer replaces the prop mid-flow | Ignored; the activation-time callback remains subscribed |
| StrictMode dev double-invoke | Subscribe → cleanup → subscribe; consumer listener must be idempotent |
| `retreat()` at the first step | No-op (existing invariant) |
| `retreat()` during an exit transition | Queued via `pendingNavigationRef` (existing behavior) |
| Callback or cleanup throws | Propagates to the app's error boundary |
| Idle or prop unset | No invocation, no overhead |
| Post-settle `retreat()` / `abort()` | No-ops — null-state guard on retreat paths; inline abort guard returns early |
| Post-settle `getHistoryDepth() === 0` | Returns `0`; consumer must check `flowState !== null` separately to distinguish first-step from settled |
| Two rapid `controls.retreat()` during exit transition | Both land in `pendingNavigationRef`; last-write-wins, applied on animation completion (queueing semantics same as step-level `queueRetreat`) |

## Testing

### BDD — `src/features/flow-lifecycle.feature` + `flow-lifecycle.spec.tsx`

Following the existing `loadFeature`/`describeFeature` pattern. Scenarios:

1. `onFlowStarted` fires once per activation; `getHistoryDepth()` starts at `0` and reflects
   advances and retreats.
2. `controls.retreat()` retreats one step in direct mode; queues correctly during an exit
   transition in transition mode (existing `webkitAnimationEnd` fixture knowledge). Two rapid
   `retreat()` calls replace each other in `pendingNavigationRef`; the last-write wins on
   animation completion — verifies queueing semantics same as step-level `queueRetreat`.
3. `controls.abort()` fires `onAbort`, settles the outlet, cleanup runs. Post-settle calls
   on stale controls are no-ops (`abort()` returns early, `retreat()` hits null-state guard).
4. Cleanup runs exactly once on resolve, on abort, on unmount-while-active, and on
   re-activation (old cleanup before new subscription).
5. Prop unset or idle: callback never fires.
6. Prop identity changes mid-flow do not re-subscribe.
7. StrictMode: subscribe → cleanup → subscribe with no leak (assert listener add/remove
   symmetry in a composition test).
8. **Composition test** — the browser-back recipe itself: spy on `history.pushState` /
   `history.back`, dispatch `PopStateEvent`s, assert one retreat per Back at depth ≥ 1 and
   abort + no re-push at depth 0. Validates the motivating use case through the public API.
9. **Post-settle control no-ops**: activate → resolve → call all three controls; assert
   `retreat()` does not crash, `abort()` does not re-fire `onAbort`, `getHistoryDepth()` is `0`.
10. **`getHistoryDepth() === 0` ambiguity**: verify depth returns `0` both at first step and
    after settle; consumer must check flow state separately to disambiguate.

jsdom notes: do not rely on real `history.back()` traversal — spy and assert calls; dispatch
`new PopStateEvent("popstate", { state })` inside `act()`.

No new pure unit module — the logic is React wiring covered by the BDD feature. Existing
tests stay green (no behavioral change to retreat/transition machinery).

## Docs, Demo, Version Alignment

- `docs/docs/api/flow-outlet.mdx`: new `onFlowStarted` section with the full behavior
  contract (per-activation subscription, cleanup timing, StrictMode note, prop-identity
  note), linking to the wizard demo for the complete composition.
- `docs/docs/demos/wizard.mdx`: the wizard demo gains the browser-back recipe — Back
  retreats one step while active; first-step Back aborts and falls through. The recipe design:
  - Pushes a sentinel on flow start (same-token entry via `history.pushState`).
  - Registers a `popstate` listener that delegates to `controls.retreat()` at depth ≥ 1
    and `controls.abort()` at depth 0.
  - Cleans up the listener and `back()`s the sentinel on flow settle / outlet unmount.
  - **Adopt-style handling for dev double-effect**: if cleanup's async `back()` lands after
    re-arm (foreign-token popstate), the recipe replaces state with its current token — no
    spurious retreat. Same mechanism as the predecessor spec's `"adoptStaleSentinel"` but
    inline in the recipe rather than a library module.
  - Documents inherited limitations from the predecessor: iOS `pushState` throttle, SPA-router
    desync (`lastKnownStateRef` not maintained by consumer so recipe handles single-entry
    window only), same-URL history entries inside docs playground, at-most-one armed outlet
    contract (no enforcement — first consumer wins).
- `docs/static/llms.txt`: add `onFlowStarted` to the API section; bump the version field
  to 1.2.0.
- `package.json`: version `1.1.0` → `1.2.0`.
- `.github/skills/use-react-sequent/SKILL.md`: re-pin to v1.2.0 per the version-alignment
  instruction.
- `src/index.ts`: export the `FlowStartedControls` type.
- No new story files.
- Never hand-edit `docs/build/llms.txt` or `storybook-static/` (build outputs).

## Files Touched

Create:

- `src/features/flow-lifecycle.feature`
- `src/features/flow-lifecycle.spec.tsx`

Delete:

- `docs/superpowers/specs/2026-08-17-browser-back-retreat-design.md` (superseded; retained in
  git history)

Modify:

- `src/components/FlowOutlet.tsx`
- `src/index.ts` (type export)
- `docs/docs/api/flow-outlet.mdx`
- `docs/docs/demos/wizard.mdx`
- `docs/static/llms.txt`
- `package.json` (version bump only)
- `.github/skills/use-react-sequent/SKILL.md` (version pin)

## Decisions Log

| Decision | Choice | Rationale |
| --- | --- | --- |
| Approach | Lifecycle hook `onFlowStarted` | Generalizes browser-back; consumer-owned composition |
| Controls surface | `retreat` + `abort` + `getHistoryDepth` | Minimum for the motivating use case; first-step signal needed |
| Lifecycle shape | Single callback with cleanup return | Symmetric register/unregister; `useEffect`-style ergonomics |
| Depth mechanism | `flowStateRef` mirror read at call time | `flowState` is `useState`, not a ref — closure captures would freeze at activation. Parallel counter at mutation sites duplicates the stack and can drift; the mirror is derived, single-assignment |
| Controls freshness | Stable controls object + handler refs (`retreatHandlerRef`, `abortHandlerRef`) | Per-render handler recreation requires delegation; same pattern as the superseded spec |
| Subscription identity | `flowIdRef` (bumped in `activate()` only) — no separate epoch needed | Settle flips `flowState !== null`; re-activation bumps flowId; boolean dep covers both paths. Replaces `activationEpochRef` after reviewer found it redundant with existing ref. |
| Prop identity changes | Ignored mid-flow | Subscription is per-activation, not per-render |
| Timing | Layout effect after first step commit | Before paint; `onActivated` stays synchronous |
| Ref mirroring mechanism | Every-render `useLayoutEffect`, owned as a deliberate pattern (adopted from predecessor) | Existing atomic-callback sync only works for values with single imperative write path. These are derived values/closures with many sites. Layout timing closes staleness window before events dispatch. Aborted guard hoisted above early return via inline flow-id check in same render pass. |
| End-of-flow events | None beyond cleanup return | YAGNI |
| Post-settle control calls | Documented no-ops (not an event) | All retreat paths hit null-state guard; inline abort guard returns early; `getHistoryDepth()` returns `0`. Consumer never sees half-settled state. |
| StrictMode | Recipe must be idempotent AND handle subscribe/cleanup race structurally | Library does not dedupe. The browser-back recipe inherits the same dev double-effect problem the predecessor solved with tokens + `adoptStaleSentinel`; spec requires either lazy push on first advance or adopt-style handling in recipe. See Review Notes §3. |
| Recipe design | Inherited predecessor's design rigor — decision table, platform caveats, adoption logic | Complexity relocated, not eliminated. Wizard demo documents limitations: iOS `pushState` throttle, SPA-router desync, stale history-menu entries, at-most-one armed outlet contract. |
| Prop identity suppression | Explicit biome-ignore in layout effect deps | `// biome-ignore lint/correctness/exhaustive-deps: prop identity change mid-flow must be ignored per contract` |
| Recipe location | Wizard demo + API docs pointer | User preference; no new story/demo page |
| Version | 1.2.0 | Additive, non-breaking |
| Old spec | Deleted, superseded | None of its internals become library code |

## Review Notes (2026-08-18)

Design reviewed interactively, section by section, with the requester. Points raised and
resolved:

1. **Depth mechanism challenge** ("the utility already tracks a stack for retreat — count the
   links"): rejected in favor of the `flowStateRef` mirror. The stack lives in `useState`,
   not a ref; a per-activation closure would freeze the count. A parallel counter maintained
   at every mutation site duplicates the stack and can desync; the mirror is derived with a
   single assignment per render and cannot drift. See Decisions Log.
2. **History-list-as-ref suggestion**: confirmed no ref holds `flowState` today; the design's
   `flowStateRef` is exactly the "closure holds a ref, evaluate `ref.current`" mechanism.
3. **Recipe location**: originally a new story; moved into the existing wizard demo per
   requester preference.

## Additional Review Notes (post-implementation-gap analysis)

The predecessor spec (`retreatOnBrowserBack`, deleted) carried significant design rigor for
the same motivating use case — decision tables, adopt-style token handling, platform caveats.
That complexity was relocated, not eliminated, when the approach pivoted to a lifecycle hook.
These notes record the resolved gaps:

1. **`activationEpochRef` dropped in favor of `flowIdRef`**: Reviewer found a second monotonic
   activation counter unnecessary — `flowIdRef` already bumps on `activate()` and settle,
   covering every transition in the matrix with deps `[flowState !== null, activeFlowId]`.
   Decisions Log updated accordingly.

2. **Abort guard hoisted above early return**: `guardedAbort` is defined below the
   `if (flowState === null) return` in FlowOutlet, so a ref-mirrored closure cannot capture it
   lexically. The fix is an inline flow-id check inside the layout effect's render-pass closure,
   preserving the same guard without hoisting code or depending on lexical scope. Full detail
   in the "Ref mirrors" section.

3. **StrictMode race for the browser-back recipe**: The dev double-effect creates a cleanup →
   re-arm sequence where the first cleanup's async `history.back()` lands after the second
   subscription has armed with a new token. Plain idempotency does not cover this — it produces
   a popstate at a stale sentinel, which triggers a retreat. The predecessor solved this with
   tokens + `adoptStaleSentinel` (foreign-token arrival → `replaceState` with current token).
   The new spec requires the wizard-demo recipe to either:
   - Use lazy push (push sentinel only on first `advance()`, not on subscription), OR
   - Implement inline adopt-style handling: if the listener sees a foreign-token sentinel
     popstate while armed, call `history.replaceState(createSentinel(state), "")` to self-heal.
   This must be written into the recipe before implementation.

4. **Recipe inherited the predecessor's full design burden**: Because the library exposes no
   browser-back machinery, the consumer-facing recipe inherits everything the predecessor spec
   designed: sentinel tokens, popstate classification, adoption logic, single-armed-outlet
   contract, iOS throttle caveat, SPA-router desync limitation, and history-menu stale entry
   behavior. The docs plan now explicitly enumerates these under each scenario so they are
   not lost between spec and implementation. The composition test (§8–10) covers the happy path;
   adopt-style handling is verified through StrictMode fixture (§7) plus inline adopt in the
   recipe source code (no unit tests needed since it lives in userland).

5. **`getHistoryDepth() === 0` ambiguity documented**: Both first-step and settled produce `0`.
   Harmless for the wizard recipe but consumers need to check `flowStateRef.current !== null`
   separately. Added to Behavior Contract and testing.

6. **Two rapid `controls.retreat()` during exit transition**: Queueing via `pendingNavigationRef`
   uses last-write-wins semantics (same as step-level `queueRetreat`). Added to edge-case matrix
   and BDD scenario 2.
