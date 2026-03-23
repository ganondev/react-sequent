# AGENT.md — react-sequent

## What This Is

`react-sequent` is a lightweight React utility for building UX flows — sequences of steps where each step owns its own transition logic. Think multi-step forms, onboarding wizards, modal flows, or any UI that moves through discrete states.

The core idea: **the current step decides what comes next**, rather than a top-level config knowing all states in advance. This is the defining design decision of the library. Do not drift from it.

---

## The Paradigm (Read This Carefully)

Most state machine libraries (XState, Zag, etc.) require you to define all states and transitions upfront in a centralized config. The machine is rigid and "above" the components in the control hierarchy.

`react-sequent` inverts this. Flows are **implicit** — transitions emerge from step-level logic rather than a global declaration. This means:

- You can add, remove, or reorder steps without touching a central config
- Branching logic lives where it's most readable — in the step itself
- Flows are easier to test in isolation because each step is self-contained

This is the library's entire reason for existing. Any implementation that reintroduces a required top-level state map is architecturally wrong, even if it works.

---

## Core Vocabulary

These terms have precise meanings. Use them consistently in code, comments, and tests.

| Term | Meaning |
|---|---|
| **Flow** | A sequence of steps managed as a unit |
| **Step** | A discrete state in a flow; owns its own transition logic |
| **Transition** | The act of moving from one step to another; triggered by the current step |
| **Advance** | Move to the next step, as determined by the current step's logic |
| **Retreat** | Move to the previous step by popping the history stack; does not restore step-local state |
| **Context** | Flow-scoped, consumer-owned data the library carries and makes available to all steps; the intended solution for both prop-drilling and preserving state across retreat |
| **Outlet** | The location in the component tree where the active step is rendered; declared by the consumer via `<FlowOutlet />` |
| **Resolve** | A flow completes successfully |
| **Abort** | A flow exits without completing |

---

## Architecture

### Hooks

Two hooks with strictly separated concerns. A step must never be able to access initializer-level capabilities, and vice versa.

**`useFlowInit`** — for flow entry points only
- Returns `initFlow` to start a flow with a step loader and initial context
- Returns a reference to associate the flow with a `<FlowOutlet />`
- Has no knowledge of step-internal state

**`useStep`** — for step components only
- Returns `advance(nextLoader, contextPatch?)` — transition to next step
- Returns `retreat()` — pop history stack, render previous step
- Returns `resolve(value?)` — end flow successfully
- Returns `abort(reason?)` — end flow without completing
- Returns `context` — the current flow context value
- Has no access to initializer-level capabilities

**`useFlowContext`** — for chrome components and any consumer component inside the outlet's provider boundary
- Returns an object with `context` (the current flow context value), `resolve`, and `abort`
- Available to components that are not steps but need to respond to flow state (e.g. a chrome component that displays a dynamic title) or terminate the flow (e.g. a close button)
- Has no navigation capabilities (`advance`/`retreat` remain exclusive to `useStep`)

These hooks must not share a public interface beyond what is explicitly listed. Compartmentalization is a hard requirement, not a preference.

### Outlet

`<FlowOutlet />` is a component the consumer renders wherever they want flow output to appear. It has two states: **idle** and **active**.

- **Idle** — renders `children` if provided, otherwise nothing. The outlet is inert until a flow is initialized against it via `initFlow`. When the flow resolves or aborts, the outlet returns to idle and children reappear. Idle children are wrapped in the internal `FlowContext.Provider`, so they can call `useFlowContext` — which returns the last consumer context from the last *resolved* flow, or `undefined` if no flow has resolved yet. (Aborted flows do not update this context.)
- **Active** — renders the result of calling the chrome render prop (if provided) with the step slot, or the step slot directly. Children are not rendered during the active state. Teardown (via `resolve` or `abort`) returns the outlet to idle.

The outlet's active/idle state is derived entirely from whether a flow has been initialized against it. The consumer never manages this boolean directly.

`<FlowOutlet />`:

- Invisibly owns the internal React context provider
- Owns both the Suspense boundary and the error boundary for the active step
- Accepts optional `children` that render when idle (no active flow) and are hidden when a flow is active — useful for trigger buttons or placeholder content
- Accepts a `fallback` prop for the async step loading state (passed through to Suspense)
- Accepts an `errorFallback` prop for the error boundary, analogous to `fallback`
- Accepts an optional **chrome render prop** (`chrome?: (children: ReactNode) => ReactNode`) — a function that receives the step slot (error boundary + Suspense + active step) and returns JSX; chrome renders outside the Suspense boundary but inside the provider boundary, so it remains stable across async step transitions
- Has no opinions about layout or visual structure

The chrome render prop is optional. Outlets with no chrome render prop simply render the step slot directly when initialized. The consumer controls placement. The library controls nothing above the outlet.

#### Chrome and `useFlowContext`

Steps should never include chrome. Chrome belongs to the outlet so that it remains visually stable across step transitions — a modal header should not flicker when an async step loads, and animated transitions between steps should not affect the surrounding shell.

To allow chrome to respond to per-step concerns (e.g. a dynamic title, a conditionally hidden close button), the library exposes **`useFlowContext`** — a hook available to any component inside the outlet's provider boundary. It returns the current flow context value (read-only) along with `resolve` and `abort` callbacks for flow termination. Steps write chrome-relevant state into context via `advance`'s `contextPatch`; the chrome component reads it via `useFlowContext`. Chrome can terminate a flow (e.g. a close button that aborts) but cannot navigate between steps — `advance` and `retreat` remain exclusive to `useStep`.

The library defines no chrome slots. The consumer owns both the shape of the context and the chrome component itself, keeping the library generic. Common outlet patterns (modal, drawer, wizard) are left to the consumer or their own codebase to define as reusable compositions.

The tree structure during an active flow with chrome:

```
<FlowOutlet chrome={chrome}>   ← provider
  {chrome(
    <FlowErrorBoundary>        ← error boundary
      <Suspense>               ← fallback shown during async step loads
        <ActiveStep />         ← swaps on each transition
      </Suspense>
    </FlowErrorBoundary>
  )}
  // chrome wraps and composes around the step slot
</FlowOutlet>
```

### Async Step Loading & Suspense

Step loaders may be sync (a component directly) or async (a dynamic import or promise-returning function). The library handles both without jitter:

- **Sync steps** render immediately — no deferred resolution, no loading flash
- **Async steps** suspend naturally at the outlet's Suspense boundary; the consumer's `fallback` is shown until the step resolves

This replaces any need for a purpose-built loading step component. Do not reintroduce one.

`React.lazy` expects `{ default: Component }` — the library should provide a thin internal normalizer so consumers can pass a plain `() => import('./MyStep')` without caring about this shape. This normalization is the library's responsibility, not the consumer's.

`retreat` is always sync — the previous step is already loaded and in history. No async concern on the way back.

### Internal Context

The library uses a React context internally to coordinate between `useFlowInit`, `useStep`, and `<FlowOutlet />`. This context is an implementation detail — consumers never interact with it directly and do not insert a provider manually.

---

## API Constraints

The public API must stay **minimal**. When in doubt, do less.

- Prefer one way to do things over multiple escape hatches
- Do not add props/options speculatively — wait for a concrete use case
- If a consumer could reasonably implement it themselves in 5 lines, it probably doesn't belong in the library
- No required wrapper components or boilerplate to get a basic flow running
- `context` is consumer-owned — the library carries it, never inspects or mutates it. It is not a state management feature; it is a delivery mechanism

There is no secondary constraint priority list. Minimal surface area is the only one that matters at this stage.

### On retreat and state persistence

`retreat` navigates — it does not restore. Step-local state (e.g. `useState`) is the consumer's responsibility. If a consumer needs state preserved across retreat, the answer is to write it to `context` before advancing. The library does not need to solve this.

---

## Development Workflow

### Prerequisites
- Node 24+ (pinned via `.node-version`)
- Yarn 4+ (pinned via `packageManager` in `package.json`, managed by corepack)

### Install dependencies
```bash
corepack enable   # one-time, if not already enabled
yarn install
```

### Scripts
| Command | Description |
|---|---|
| `yarn dev` | Start Vite dev server |
| `yarn build` | Production build → `dist/` (ES + CJS + types) |
| `yarn typecheck` | Type-check all source files (no emit) |
| `yarn test` | Run full test suite (unit + BDD) |
| `yarn test:unit` | Run unit tests only |
| `yarn test:bdd` | Run BDD / vitest-cucumber tests only |
| `yarn test:watch` | Watch mode for all tests |
| `yarn lint` | Lint via Biome |
| `yarn format` | Auto-fix lint + format via Biome |

### Test structure
- **Unit tests** (`src/**/*.test.{ts,tsx}`) — standard Vitest, `jsdom` environment
- **BDD tests** (`src/**/*.spec.ts`) — vitest-cucumber, paired with `.feature` files in `src/features/`
- Both run via Vitest 4 workspace projects (configured in `vitest.config.ts`)

### Testing against a local consumer app
```bash
# From this repo
yarn link

# From the consumer app
yarn link react-sequent
```

---

## Current Status

- [x] Core transition logic
- [x] `useFlowInit` hook
- [x] `useStep` hook
- [x] `<FlowOutlet />` component
- [x] Suspense / async step normalization
- [x] TypeScript types
- [ ] Build / publish setup
- [ ] README / docs

### Type Safety Trade-offs

`useFlowInit<TResult>()` threads a generic through to `initFlow`, which returns `Promise<TResult>`. The `FlowOutletHandle.activate` accepts `onResolve` / `onAbort` callbacks, wiring the promise lifecycle to the outlet's `resolve` / `abort` context functions.

`useStep<TResult>()` and `useFlowContext<TContext>()` also accept generics, casting the internally `unknown`-typed context values to the consumer-specified type.

**Acknowledged limitation:** TypeScript cannot verify at compile time that a step component is rendered inside the correct outlet. A step reused across flows with different `TResult` types would silently receive the wrong type. This is an acceptable trade-off because:

1. Steps are designed to be portable — the paradigm encourages step-level transition logic, not global type coordination
2. The generic is most valuable at the `initFlow` call site, where the consumer controls both the flow shape and the result handling
3. Runtime behavior is unaffected — the generic is erased at compile time and the library uses `unknown` internally

If a consumer needs airtight type safety between `initFlow` and `useStep`, they can create a thin typed wrapper hook around `useStep<MyResultType>()` co-located with the flow definition.

### Projected Examples

This is an example of what a minimal use case could look like.

```tsx

function Step1() {
    
    const { advance } = useStep();

    // this callback isn't async because it doesn't need to be
    // but it could be if necessary without changing the API
    const next = () => { advance(<Step2/> )};

    return <>
        step 1 content
        <button onClick={next}>Next</button>
    </>

}

function Step2() { return <>step 2 content</> }

function SomeComponent() {

    const outletRef = useRef();
    const { initFlow } = useFlow();

    const onClick = () => {
        initFlow(<Step />, outletRef);
    }

    // is ref the right call here (see Open Questions) — Resolved, see Outlet Association in Open Questions
    return <FlowOutlet ref={outletRef} />

}

```

> Update this section as work progresses. It is the fastest way for an agent to orient itself at the start of a session.

---

## Open Questions

> Running list of unresolved design decisions. Add to this rather than making an arbitrary call.

- ~~**History / back-navigation**~~ — Resolved. See *On retreat and state persistence* in API Constraints.
- ~~**Async step loading**~~ — Resolved. Suspense at the outlet boundary; sync steps bypass it entirely.
- ~~**Hooks API shape**~~ — Resolved. `useFlowInit` + `useStep`, strictly compartmentalized.
- ~~**Outlet association**~~ — Resolved. `useFlowInit` returns a ref that is passed to `<FlowOutlet ref={...} />`. Idiomatic React; the library absorbs the `forwardRef` ceremony so consumers don't have to.
- ~~**Conditional advance / branching**~~ — Resolved. `advance` takes a loader directly; branching is just an if-statement in the step. No special API needed — the "step decides what comes next" paradigm *is* the branching mechanism.
- ~~**Typed `resolve`/`abort` payloads**~~ — Resolved. Generic goes on `useFlowInit<ResultType>()`, which types the return value of `initFlow` (the promise/callback the consumer handles) and carries a typed `resolve` through internal context to `useStep`. This is best-effort — TypeScript cannot verify at compile time that a step is rendered inside the correct outlet, so the type is trustworthy in practice but not airtight. A step used across flows with different resolve types would silently get the wrong type; this is an acceptable trade-off given that steps are designed to be portable. If the generic approach proves unworkable, the fallback is `resolve` accepting `unknown` in `useStep` with type safety living exclusively at the `initFlow` return value.
- ~~**Multiple concurrent flows — v1 scope**~~ — Resolved. Out of scope for v1. Multiple outlets can coexist naturally via separate `useFlowInit` + `<FlowOutlet />` pairs; coordinating flows is a different problem deferred to a later version.
- ~~**Error boundary story**~~ — Resolved. `<FlowOutlet />` owns an error boundary alongside its Suspense boundary. Accepts an `errorFallback` prop analogous to `fallback`, keeping broken step blast radius contained to the outlet.
- ~~**Chrome / outlet composition**~~ — Resolved. See *Outlet* and *Chrome and `useFlowContext`* in Architecture. `<FlowOutlet />` is idle until `initFlow` activates it. An optional chrome child is rendered outside the Suspense boundary (stable across transitions) but inside the provider boundary (can call `useFlowContext`). Steps remain chrome-free and fully portable. `useFlowContext` provides context (read-only), `resolve`, and `abort` — enabling chrome to terminate flows without accessing navigation capabilities.
- ~~**Outlet association by ref**~~ — Resolved. See *Outlet association* above.