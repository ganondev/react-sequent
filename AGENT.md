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
| **Outlet** | The location in the component tree where the active step is rendered; exposed to consumers as the bound `SequentOutlet` returned from `useSequentFlow()` |
| **Resolve** | A flow completes successfully |
| **Abort** | A flow exits without completing |

---

## Architecture

### Public API surface

The exported API is intentionally small:

- `useSequentFlow<TResult>()` — flow entry points
- `useSequentStep<TResult>()` — active step components
- `useSequentContext<TContext>()` — chrome, idle children, and any flow-level consumer component
- `defineSequentFlow<TContext, TResult>()` — typed wrapper hooks for colocated flows

`FlowOutlet` is an internal implementation detail. Consumers work with the bound `SequentOutlet` component returned from `useSequentFlow()`.

### Hooks

The hooks have strictly separated concerns. A step must never be able to access initializer-level capabilities, and vice versa.

**`useSequentFlow<TResult>()`** — for flow entry points only
- Returns `init(stepLoader, initialContext?)` to start a flow
- Returns a bound `SequentOutlet` component for that hook instance
- Has no knowledge of step-internal state

**`useSequentStep<TResult>()`** — for step components only
- Returns `advance(nextStep, contextPatch?)` — transition to the next step
- Returns `retreat()` — pop the history stack and render the previous step
- Returns `resolve(value?)` — end the flow successfully
- Returns `abort(reason?)` — end the flow without completing
- Returns `context` — the current flow context value
- Has no access to initializer-level capabilities
- **Throws immediately if called outside the active step's subtree** (for example from chrome or an idle child). Use `useSequentContext()` for those contexts.

**`useSequentContext<TContext>()`** — for chrome components and any consumer component inside the outlet's provider boundary
- Returns `context` (the current flow context value), `resolve`, and `abort`
- Available to components that need flow state but not step-only navigation
- Has no navigation capabilities (`advance`/`retreat` remain exclusive to `useSequentStep`)

**`defineSequentFlow<TContext, TResult>()`** — for typed scopes
- Returns typed wrappers around `useSequentFlow`, `useSequentStep`, and `useSequentContext`
- Keeps `init()`, `context`, and result handling aligned for a colocated flow
- Performs no runtime coordination, it is essentially a TypeScript-only feature

These hooks must not share a public interface beyond what is explicitly listed. Compartmentalization is a hard requirement, not a preference.

### Outlet

`<SequentOutlet />` is the component the consumer renders wherever they want flow output to appear. It has two states: **idle** and **active**.

- **Idle** — renders `children` if provided, otherwise nothing. The outlet is inert until a flow is initialized through `init()`. When the flow resolves or aborts, the outlet returns to idle and children reappear. Idle children are wrapped in the internal `FlowContext.Provider`, so they can call `useSequentContext()` — which returns the last consumer context from the last *resolved* flow, or `undefined` if no flow has resolved yet. (Aborted flows do not update this context.)
- **Active** — renders the result of calling the chrome render prop (if provided) with the step slot, or the step slot directly. Children are not rendered during the active state. Teardown (via `resolve` or `abort`) returns the outlet to idle.

The outlet's active/idle state is derived entirely from whether a flow has been initialized against it. The consumer never manages this boolean directly.

`<SequentOutlet />`:

- Invisibly owns the internal React context provider
- Owns both the Suspense boundary and the error boundary for the active step
- Accepts optional `children` that render when idle (no active flow) and are hidden when a flow is active — useful for trigger buttons or placeholder content
- Accepts a `fallback` prop for the async step loading state (passed through to Suspense)
- Accepts an `errorFallback` prop for the error boundary, analogous to `fallback`
- Accepts an optional **chrome render prop** (`chrome?: (children: ReactNode) => ReactNode`) — a function that receives the step slot (error boundary + Suspense + active step) and returns JSX; chrome renders outside the Suspense boundary but inside the provider boundary, so it remains stable across async step transitions
- Has no opinions about layout or visual structure

The chrome render prop is optional. Outlets with no chrome render prop simply render the step slot directly when initialized. The consumer controls placement. The library controls nothing above the outlet.

#### Chrome and `useSequentContext`

Steps should never include chrome. Chrome belongs to the outlet so that it remains visually stable across step transitions — a modal header should not flicker when an async step loads, and animated transitions between steps should not affect the surrounding shell.

To allow chrome to respond to per-step concerns (for example a dynamic title or a conditionally hidden close button), the library exposes **`useSequentContext()`** — a hook available to any component inside the outlet's provider boundary. It returns the current flow context value (read-only) along with `resolve` and `abort` callbacks for flow termination. Steps write chrome-relevant state into context via `advance`'s `contextPatch`; the chrome component reads it via `useSequentContext()`. Chrome can terminate a flow but cannot navigate between steps — `advance` and `retreat` remain exclusive to `useSequentStep()`.

The library defines no chrome slots. The consumer owns both the shape of the context and the chrome component itself, keeping the library generic. Common outlet patterns (modal, drawer, wizard) are left to the consumer or their own codebase to define as reusable compositions.

The tree structure during an active flow with chrome:

```
<SequentOutlet chrome={chrome}>   ← flow-level context (chrome + idle children)
  {chrome(
    <step-context>               ← step-only context (active step only)
      <FlowErrorBoundary>        ← error boundary
        <Suspense>               ← fallback shown during async step loads
          <ActiveStep />         ← swaps on each transition
        </Suspense>
      </FlowErrorBoundary>
    </step-context>
  )}
  // chrome: inside flow context, outside step context
  // step: inside both contexts
</SequentOutlet>
```

### Async Step Loading & Suspense

Step loaders may be sync (a component directly) or async (a dynamic import or promise-returning function). The library handles both without jitter:

- **Sync steps** render immediately — no deferred resolution, no loading flash
- **Async steps** suspend naturally at the outlet's Suspense boundary; the consumer's `fallback` is shown until the step resolves

This replaces any need for a purpose-built loading step component. Do not reintroduce one.

`React.lazy` expects `{ default: Component }` — the library provides a thin internal normalizer so consumers can pass a plain `() => import('./MyStep')` without caring about this shape. This normalization is the library's responsibility, not the consumer's.

`retreat` is always sync — the previous step is already loaded and in history. No async concern on the way back.

### Internal Contexts

The library uses **two nested React contexts** internally to enforce hook compartmentalization. These are implementation details — consumers never interact with them directly.

- **`FlowContext` (outer)** — wraps idle children, chrome, and the step slot. Carries `consumerContext`, `resolve`, and `abort`. Read by `useSequentContext()`.
- **`StepContext` (inner)** — wraps only the active step's subtree (inside the error boundary + Suspense). Carries navigation (`advance`, `retreat`) plus `resolve`, `abort`, and `consumerContext`. Read by `useSequentStep()`.

Chrome components sit inside `FlowContext` but outside `StepContext`. `useSequentStep()` throws immediately when called without a `StepContext` present — structurally preventing chrome or idle children from accessing step-only capabilities.

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

`retreat` navigates — it does not restore. Step-local state (for example `useState`) is the consumer's responsibility. If a consumer needs state preserved across retreat, the answer is to write it to `context` before advancing. The library does not need to solve this.

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

### Impacts of Changes

Whenever something needs to be changed about the code itself, consider other places that need to be
changed downstream so the project stays internally consistent. Ask yourself if the following
need patches to reflect new state:
* Docusaurus Documentation?
* Storybook Demos?
* docs/static/llms.txt?
* Comments, in general? - Units of code may not be fully self-contextualizing.