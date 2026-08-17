# Design Spec: `retreatOnBrowserBack` for FlowOutlet

- **Date:** 2026-08-17
- **Status:** Approved (design) — pending user review of this spec
- **Target version:** 1.2.0
- **Scope:** `react-sequent` core (`src/`), docs, stories, package version

## Summary

Add an opt-in prop `retreatOnBrowserBack?: boolean` to `FlowOutlet`. While a flow is active,
a browser Back press (popstate) triggers `retreat` instead of navigating the page away.
Interception is implemented with a same-URL `pushState` sentinel history entry that is
re-pushed on each intercept and automatically consumed when the flow settles. On the first
step, Back aborts the flow and lets the browser navigate normally — the flow never traps
the user.

## Idea Evaluation

**Verdict: good idea as an opt-in, default-off feature.** Wizards, checkouts, and modal
flows make the current step feel like "a page," so Back-to-previous-step is intuitive and
prevents accidental data loss. It must never be default behavior.

Two concerns shaped the design:

1. **`popstate` cannot be canceled.** Interception requires pushing a sentinel history entry
   and re-pushing it after each intercept. This leaves cleanup work (Section: Sentinel
   cleanup) and documented caveats (Section: Platform caveats).
2. **The first step is a trap risk.** `retreat` from an empty history is a no-op by
   invariant. Re-pushing the sentinel unconditionally would make it impossible to leave the
   flow via Back — a known UX anti-pattern. The design therefore aborts and falls through
   at the first step.

Rejected alternatives: documentation recipe only (duplicates subtle logic per consumer),
URL-synced steps (much larger scope, conflicts with the "current step decides what's next"
philosophy; YAGNI).

## Goals / Non-goals

Goals:

- Opt-in interception of browser Back while a flow is active, producing one `retreat` per press.
- Never trap the user: first-step Back aborts and falls through.
- Leave zero residue after the flow ends: no phantom history entry, no extra Back press.
- Zero interference when no flow is active or the prop is unset.
- Work in both direct mode and transition mode, reusing existing retreat semantics
  (including exit-transition queuing).

Non-goals:

- No URL changes or deep-linking of steps.
- No retreat guards or cancellation.
- No coordination with app-level routers beyond documented limitations.
- No default-on behavior.

## Public API

`FlowOutletProps` gains:

```ts
retreatOnBrowserBack?: boolean
```

Default `false` (undefined behaves as `false`). Available on `SequentOutlet` from
`useSequentFlow` (whose props are `ComponentPropsWithoutRef<typeof FlowOutlet>`), and on
`defineSequentFlow`-based outlets through the same path. No other public API changes.

## Behavior Contract

Documented to consumers in `docs/docs/api/flow-outlet.mdx`:

1. **Flow active:** a browser Back press retreats exactly one step, as if `retreat()` were
   called. The URL never changes. Mouse-back buttons and history gestures are included
   (all fire `popstate`).
2. **First step:** Back calls `abort()` — `onAbort` fires, `result` becomes `"aborted"`,
   the outlet returns to idle — then the browser is allowed to navigate back. This is
   deliberate anti-trap behavior and **differs from normal `retreat`**, which is a no-op on
   an empty history. The docs state this explicitly.
3. **Flow ended (resolve/abort via UI):** the sentinel entry is auto-consumed. Subsequent
   Back presses behave as if the feature was never active.
4. **Idle, or prop `false`:** no listener, no history writes, no interference.
5. **History menu:** the sentinel entry appears in the browser's long-press history menu
   while active. Clicking it is either a no-op (it is the current entry) or, once stale
   (flow ended after an unmount that could not consume it), one of: adopted by a currently
   armed outlet (`adoptStaleSentinel` — see decision module; no retreat, no residue) or, when
   no outlet is armed, an ordinary history navigation to the flow page's URL with no
   interception — no active flow means the handler is inert.
6. **Mid-transition Back:** a Back press arriving while a transition is exiting is queued
   via the existing `pendingNavigationRef` queue and applied when the current transition
   completes. A Back press arriving while a step is loading is an ordinary retreat.
7. **At most one armed outlet:** the feature supports one armed outlet at a time (module-level
   lock). If a second outlet activates with the prop set while another holds the lock, the
   second does not arm (no listener, no history writes) and emits a one-time dev-only
   `console.warn`. Documented as a contract, not just a limitation.

## Design

All implementation lives in `FlowOutlet` plus one pure helper module. Existing retreat
machinery (`directRetreat`, `transitionRetreat`, `queueRetreat`, `retreatState`) is reused
unchanged.

### Pure decision module — `src/internal/browserBack.ts`

No DOM access, fully unit-testable:

- `SENTINEL_KEY` — the property name used on pushed history state objects.
- `createSentinelToken()` — unique per activation (monotonic counter).
- `createSentinelState(token)` — `{ [SENTINEL_KEY]: token }`.
- `isSentinelState(state, token)` — predicate for "this history entry is ours";
  `isAnySentinelState(state)` — predicate for "a sentinel from this library, any token".
- Armed-outlet lock: `claimBrowserBackLock(token)` / `releaseBrowserBackLock(token)` over a
  module-scoped owner variable. First activation claims; a second claim fails and triggers a
  one-time dev-only `console.warn`. Release on cleanup/consume. (Known limit: the lock does
  not span duplicate copies of the library in `node_modules`.)
- `decideBrowserBackAction(input)` — pure function mapping
  `{ token, flowActive, arrivingState, lastKnownState, isFirstStep }` to one of:
  - `"none"` — ordinary traversal between unrelated entries; do nothing.
  - `"consume"` — flow ended or sentinel already gone; disarm, do nothing.
  - `"stayArmed"` — arrived at our own entry (Forward traversal); no retreat.
  - `"adoptStaleSentinel"` — arrived at a sentinel entry with a **different** token while
    armed. Unambiguous evidence of a stale activation's entry (a user Back never lands there
    in normal operation — this is the StrictMode double-effect race or a stale history-menu
    entry). Response: `history.replaceState(createSentinelState(currentToken), "")`, update
    `lastKnownStateRef`, stay armed, **no retreat**. Self-heals with no residue.
  - `"retreat"` — Back away from our sentinel at a non-first step; re-push + retreat.
  - `"abortAndFallThrough"` — Back away from our sentinel at the first step; abort + fall through.

### FlowOutlet wiring — `src/components/FlowOutlet.tsx`

New refs, all mirrored via a single every-render `useLayoutEffect` (no dependency array).
This is a **new, deliberate pattern** for this codebase — the existing style (atomic
callback sync, e.g. `setPhaseValue`) only works for values with a single imperative write
path, whereas these are derived values and closures with many write sites. `useLayoutEffect`
(not `useEffect`) is required: it flushes synchronously in the commit task, before the
browser can dispatch any event, so a `popstate` can never observe stale refs.

- `sentinelTokenRef` — current activation token; non-null means "we pushed a sentinel and
  are armed." Doubles as the consumed flag.
- `lastKnownStateRef` — the last seen `history.state`. Distinguishes *leaving our sentinel*
  (Back) from traversal between unrelated entries. **Must be updated on every `popstate`
  and after every `pushState` we perform** — if it goes stale, a second consecutive Back
  press misses interception.
- `retreatHandlerRef` — refreshed each render to point at `transitionRetreat` (transition
  mode) or `directRetreat` (direct mode), so the handler never calls a stale closure.
- `settleAbortRef` — refreshed handle to `settleFlow("abort")`.

Activation effect — dependencies are **exactly** `[retreatOnBrowserBack, flowState !== null]`
(the boolean, so it does not re-run per navigation):

- On activation with the prop set: attempt `claimBrowserBackLock(token)`. If another outlet
  holds the lock, do **not** arm (no listener, no history writes); warn once in dev. Otherwise
  generate a token, `history.pushState(createSentinelState(token), "")`, set
  `sentinelTokenRef` and `lastKnownStateRef`.
- On cleanup: remove the listener **first**, then — only if a token is still armed **and**
  the current history entry is still our sentinel — call `history.back()` once, wrapped in
  try/catch, and disarm. Release the lock. The "current entry is still ours" guard prevents
  a double-pop after a first-step fall-through and after a post-resolve Back that raced the
  cleanup.
- StrictMode note: dev double-invocation (setup → cleanup → setup) queues an async
  `history.back()` from the first cleanup that lands **after** the second setup has armed,
  arriving as a popstate at the first activation's sentinel (foreign token). This is exactly
  the `"adoptStaleSentinel"` case — the handler adopts the entry via `replaceState` and no
  spurious retreat/abort occurs.

`popstate` handler decision order:

1. No token → return.
2. Flow inactive (settled between the press and the event) → consume (disarm), return.
   The browser falls through; no trap, no later double-pop.
3. Arriving entry is ours (Forward traversal back onto a re-pushed sentinel) → stay armed, return.
4. Arriving entry is a sentinel with a **different** token → adopt: `replaceState` with our
   token, update `lastKnownStateRef`, return (no retreat).
5. `lastKnownState` is ours (genuine Back away from the sentinel):
   - First step (`flowState.history.length === 0`) → disarm, `settleFlow("abort")`, return
     **without re-pushing** — the browser completes the navigation away.
   - Otherwise → re-push the sentinel with the same token, update `lastKnownStateRef`, then
     `retreatHandlerRef.current()`.
6. Otherwise (neither entry is ours) → update `lastKnownStateRef`, return.

The existing guards inside `transitionRetreat`/`directRetreat` (stale-flow check via
`flowIdRef`, epoch guards, exit queueing via `pendingNavigationRef`, the first-step no-op
invariant) keep working unchanged. The handler performs its own first-step check because it
must distinguish "abort and leave" from "no-op and stay".

The first-step check reads `flowState.history.length` through the layout-effect-mirrored
ref, since the handler must never depend on a stale render closure.

### Edge-case matrix

| Situation | Behavior |
| --- | --- |
| Back at a middle step | Re-push sentinel, one `retreat` |
| Two rapid Back presses | Two retreats (one per press) |
| Back at the first step | `abort()` + fall through; sentinel not re-pushed; no programmatic `back()` later |
| Resolve via UI | Cleanup consumes sentinel (`history.back()` once); normal Back behavior afterward |
| Back racing the post-resolve cleanup | Handler sees flow inactive → disarm + fall through; cleanup sees entry not ours → skips |
| Forward onto a re-pushed sentinel | No retreat; stays armed |
| Forward then Back | One retreat (sentinel window is armed) |
| Stale sentinel clicked in history menu (no armed outlet) | Ordinary navigation, no interception |
| Popstate arrives at a foreign-token sentinel while armed | Adopt via `replaceState`; stay armed; no retreat (StrictMode race, stale menu entry) |
| StrictMode dev double-effect at activation | First cleanup's async `back()` lands post re-arm → adopted; no spurious retreat/abort, no residue |
| Second outlet activates with the prop while one is armed | Lock denied; second outlet never arms; one-time dev warning |
| App pushes its own history entries while active | Unsupported; may desync `lastKnownStateRef` (documented limitation) |
| Outlet unmounts while active after app navigated elsewhere | Cleanup guard skips `back()` (entry no longer current); stale entry may remain in history |
| Prop toggled off mid-flow | Cleanup runs; sentinel consumed; interception stops |
| Flow resolves in the same commit it activated | Sentinel pushed then immediately consumed; net zero, transient popstate ignored (listener removed first) |

### SSR

All `window`/`history` access happens inside effects; nothing runs during server render.
This is the library's first global-side-effect code and is deliberately effect-scoped
(no `typeof window` guards needed for render paths).

## Testing

### Unit — `src/internal/__tests__/browserBack.test.ts`

Decision-table tests for `decideBrowserBackAction` covering every action (including
`"adoptStaleSentinel"`: foreign-token sentinel while armed), the token/armed transitions,
the lock (claim / denied second claim / release / re-claim), and `isSentinelState` /
`isAnySentinelState` edge cases (null state, foreign state, same token, different token).
No DOM.

### BDD — `src/features/browser-back.feature` + `browser-back.spec.tsx`

Following the existing `loadFeature`/`describeFeature` pattern with module-level holder
fixtures. Scenarios:

1. Back on a middle step retreats one step (direct mode).
2. Repeated Back presses step down to the first step.
3. Back on the first step aborts the flow and falls through — `onAbort` fired, outlet idle,
   sentinel not re-pushed, no programmatic `back()`.
4. Idle or prop `false` — no `pushState`, no listener (spies on `history.pushState` and
   `addEventListener`).
5. Resolve via UI — `history.back()` called exactly once; subsequent popstate not intercepted.
6. Back mid exit-transition queues a retreat (transition mode, existing animation-fixture
   knowledge: `webkitAnimationEnd` dispatch helper).
7. Forward traversal onto a re-pushed sentinel does not retreat.
8. Race: resolve then an immediate Back before effect cleanup — no interception, no double-pop.
9. StrictMode: fixture rendered in `<StrictMode>`; activation causes no spurious retreat or
   abort at mount (foreign-token popstate is adopted, not classified as Back).
10. Two armed outlets: second outlet does not arm (no `pushState`, no listener), dev warning
    emitted once; first outlet's interception is unaffected.

jsdom notes: do not rely on real `history.back()` traversal (unreliable in jsdom) — spy on
`history.back` and assert calls; dispatch `new PopStateEvent("popstate", { state })` inside
`act()`, with an `Event` + `Object.defineProperty(ev, "state", …)` fallback.

## Docs, Story, Version Alignment

- `docs/docs/api/flow-outlet.mdx`: new `retreatOnBrowserBack` subsection with the full
  behavior contract (including the anti-trap first-step note and the platform caveats).
- `src/stories/BrowserBackFlow.stories.tsx`: API usage demo; doc block notes the
  Storybook-iframe caveat for the browser Back button.
- `docs/static/llms.txt`: add the prop to the API section; bump the version field to 1.2.0.
- `package.json`: version `1.1.0` → `1.2.0`.
- `.github/skills/use-react-sequent/SKILL.md`: re-pin to v1.2.0 per the version-alignment
  instruction.
- Never hand-edit `docs/build/llms.txt` or `storybook-static/` (build outputs).

## Platform Caveats (documented)

- The browser's Back button cannot be disabled; the history menu still shows the sentinel
  entry while active. This is a platform limitation, not hideable.
- The flow page's URL never changes; step state is not restorable via history entries.
- Interception assumes the app does not push its own history entries while a flow is active.
  SPA routers that navigate during a flow can desync `lastKnownStateRef`, stopping
  interception early (the sentinel may then remain as a stale entry; clicking it is an
  ordinary navigation — see Behavior Contract point 5).
- At most one armed outlet at a time (see Behavior Contract point 7). The module-level lock
  does not span duplicate copies of the library in `node_modules`.
- iOS Safari throttles `pushState` (~100 calls/30 s). Each intercepted Back re-pushes once;
  unreachable at human Back-press rates. No mitigation needed.

## Files Touched

Create:

- `src/internal/browserBack.ts`
- `src/internal/__tests__/browserBack.test.ts`
- `src/features/browser-back.feature`
- `src/features/browser-back.spec.tsx`
- `src/stories/BrowserBackFlow.stories.tsx`

Modify:

- `src/components/FlowOutlet.tsx`
- `docs/docs/api/flow-outlet.mdx`
- `docs/static/llms.txt`
- `package.json` (version bump only)
- `.github/skills/use-react-sequent/SKILL.md` (version pin)

## Decisions Log

| Decision | Choice | Rationale |
| --- | --- | --- |
| Approach | Library-managed sentinel | Recipe duplicates subtle logic; URL sync is YAGNI |
| First-step Back | `abort()` + fall through | Never trap the user; consistent state via `onAbort` |
| Sentinel cleanup | Auto-consume, guarded | No phantom entry; guard prevents double-pop |
| Interception timing | Re-push on every intercept | One entry total regardless of step count |
| Mode support | Both direct and transition | Reuse existing retreat paths and queue semantics |
| Default | `false` | Interception must be opt-in |
| StrictMode race | `adoptStaleSentinel` decision action | Cleanup's async `back()` lands post re-arm; foreign-token sentinel arrival is unambiguous → adopt via `replaceState`, no flag needed (review 2026-08-17) |
| Multiple armed outlets | Documented contract + module-level lock, dev warn | Two listeners double-retreat per press; lock keeps behavior defined (review 2026-08-17) |
| Ref mirroring | Every-render `useLayoutEffect`, owned as a new pattern | Existing atomic-callback style needs a single write path; these are derived values/closures. Layout timing closes the staleness window before events can dispatch (review 2026-08-17) |

## Review Notes (2026-08-17)

Adversarial plan review; 11/12 checkable codebase claims verified against source (all named
identifiers, first-step guard, prop passthrough, version pins, "first global side effect").
The one failed claim (ref style "matching existing") is corrected above.

Triage: Completeness 4/5, Feasibility 4/5, Scope 4/5, Testability 5/5, Risk 3/5,
Assumptions 3/5. Three gaps found and resolved (see Decisions Log rows marked "review
2026-08-17"): StrictMode activation race, unstated single-armed-outlet assumption, ref
mirroring mischaracterization. Noted, no action: lock does not span duplicate library
copies; iOS Safari pushState throttling unreachable in practice.
