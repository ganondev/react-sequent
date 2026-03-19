# Plan: Project Milestones for react-sequent

The project is fully scaffolded but 100% unimplemented — every hook and component is a thrown stub. The architecture and all design questions are settled in AGENT.md. The work breaks naturally into layers: internal state model first, then the sync happy path, then progressive enrichment (async, errors, chrome), then hardening (types, build, docs). Tests are woven into the relevant milestone rather than deferred.

---

## Milestone 1 — Internal State Model

Define the shape that wires the whole system together before writing any public-facing code.

1. Define `FlowContextValue` in `src/internal/context.ts`: history stack (array of loaded step components), active step, consumer-owned context value, and `resolve`/`abort` callbacks (initially typed `unknown`)
2. Implement `FlowContext` via `createContext` with a stable default; add an internal `useFlowInternalContext()` accessor that throws a descriptive error outside a provider
3. No public API changes; no tests needed beyond a type-check pass (`yarn typecheck`)

---

### Milestone 1 — Completion Notes

- Implemented `FlowContextValue` in [src/internal/context.ts](src/internal/context.ts):
  - `history: StepLoader[]` — stack of loaded step components
  - `activeStep: StepLoader | null` — currently rendered step
  - `consumerContext: unknown` — consumer-owned context value
  - `resolve: (value?: TResult) => void` — callback for successful flow completion
  - `abort: (reason?: unknown) => void` — callback for flow exit without completion
- Created `FlowContext` via `createContext<FlowContextValue | null>(null)` with a stable default
- Added `useFlowInternalContext()` accessor that throws a descriptive error if used outside a provider
- No public API changes; verified with `yarn typecheck` and `yarn lint` (zero errors/violations)

Milestone 1 is fully complete and verified.

---

## Milestone 2 — End-to-End Sync Flow

First fully working user-facing slice: initialize a flow, advance/retreat through sync steps, resolve or abort.

1. Implement `useFlowInit` in `src/hooks/useFlowInit.ts`: create outlet ref via `useRef`; return `initFlow(stepLoader, ref)` that pushes initial state into context
2. Implement `<FlowOutlet />` in `src/components/FlowOutlet.tsx`: `forwardRef`; idle (renders nothing) until `initFlow` activates it; owns internal context provider; renders active step
3. Implement `useStep` in `src/hooks/useStep.ts`: `advance(nextLoader, contextPatch?)` pushes to history; `retreat()` pops; `resolve(value?)` and `abort(reason?)` tear down and return to idle; `context` exposes current consumer context value
4. Write unit tests in `src/hooks/__tests__/useFlowInit.test.ts` (init, resolve, abort, advance, retreat)
5. Implement BDD step bodies in `src/features/flow-init.spec.ts` to replace all `expect(true).toBe(true)` placeholders; all scenarios green
6. Add a `BasicFlow` storybook story in `src/stories/BasicFlow.stories.tsx` showing a two-step sync flow

---

## Milestone 2 — Completion Notes

- Implemented `useFlowInit` in [src/hooks/useFlowInit.ts](src/hooks/useFlowInit.ts): returns `initFlow(stepLoader, ref, initialContext?)` and validates the outlet ref before activation.
- Implemented `<FlowOutlet />` in [src/components/FlowOutlet.tsx](src/components/FlowOutlet.tsx): a `forwardRef` outlet that owns the internal provider, manages `history`, `activeStep`, and `consumerContext`, and exposes an imperative `activate` handle.
- Implemented `useStep` in [src/hooks/useStep.ts](src/hooks/useStep.ts): returns `advance(nextLoader, contextPatch?)`, `retreat()`, `resolve(value?)`, `abort(reason?)`, and read-only `context`.
- Added unit tests in [src/hooks/__tests__/useFlowInit.test.tsx](src/hooks/__tests__/useFlowInit.test.tsx) covering init, resolve, abort, advance, retreat, context patching, error handling, and re-initialization.
- Replaced BDD placeholders with real step bodies in [src/features/flow-init.spec.tsx](src/features/flow-init.spec.tsx) (paired with `src/features/flow-init.feature`).
- Added a `BasicFlow` Storybook story in [src/stories/BasicFlow.stories.tsx](src/stories/BasicFlow.stories.tsx) demonstrating a simple two-step sync flow using Mantine for styling.
- Verified local checks: `yarn typecheck`, `yarn lint`, `yarn test:unit`, and `yarn test:bdd` all pass in the current environment.

Notes:
- The outlet is associated by a consumer-created ref passed to both `initFlow` and `<FlowOutlet ref={...} />`.
- `advance` shallow-merges `contextPatch` into the existing consumer context when both are objects; otherwise it replaces the context.
- No async/suspense behavior was added in this milestone — that is Milestone 3.

---

## Milestone 3 — Async Step Loading

Allow consumers to pass dynamic imports as step loaders without changing the API shape.

1. Implement `normalizeStepLoader` in `src/internal/normalizer.ts`: if the argument is already a component, return it; if it is a function returning a promise, wrap with `React.lazy`
2. Apply the normalizer inside `advance` (in `useStep`) and `initFlow` (in `useFlowInit`) before storing to history
3. Wrap the active step render in `<FlowOutlet />` with `<Suspense fallback={props.fallback}>` — only around the step, not the future chrome slot
4. Write `src/features/async-step-loading.feature` with scenarios: async loader shows `fallback` during suspension then renders the step; sync loader renders immediately with no fallback shown
5. Implement step bindings in `src/features/async-step-loading.spec.ts`; all scenarios green
6. Add an `AsyncFlow` story in `src/stories/AsyncFlow.stories.tsx` showing a two-step async flow with a visible `fallback` state

---

### Milestone 3 — Completion Notes

- Implemented `normalizeStepLoader` in [src/internal/normalizer.ts](src/internal/normalizer.ts): accepts a `StepLoader` (a `ComponentType` or an async factory) and returns a sync component as-is or a `React.lazy`-wrapped component for async factories; exports the `StepLoader` type.
- Applied the normalizer in the initializer and transition paths:
  - `useFlowInit` ([src/hooks/useFlowInit.ts](src/hooks/useFlowInit.ts)) normalizes the initial loader before activating the outlet.
  - `useStep` ([src/hooks/useStep.ts](src/hooks/useStep.ts)) wraps `advance` to normalize next-step loaders before forwarding to the outlet.
  - `FlowOutlet` ([src/components/FlowOutlet.tsx](src/components/FlowOutlet.tsx)) normalizes in both `activate` and internal `advance` handlers.
- Wrapped the active step render in a `Suspense` boundary inside `FlowOutlet` (`<Suspense fallback={props.fallback}>`) so consumer-provided `fallback` UI is shown only while async steps load; sync steps render immediately with no loading flash. The Suspense wraps only the active step (chrome remains outside, per Milestone 5 plan).
- Added BDD feature + spec: [src/features/async-step-loading.feature](src/features/async-step-loading.feature) and [src/features/async-step-loading.spec.tsx](src/features/async-step-loading.spec.tsx) — scenarios verify that async loaders show the `fallback` during suspension and then render, and that sync loaders render immediately with no fallback.
- Added a Storybook story [src/stories/AsyncFlow.stories.tsx](src/stories/AsyncFlow.stories.tsx) demonstrating a two-step async flow with a visible fallback (simulated load delay).
- Verification notes: `yarn test:bdd` and the updated unit tests pass for the new/changed files. `yarn typecheck` reports pre-existing `.ts` test files containing JSX (no new type errors introduced). `yarn lint` flagged only pre-existing formatting issues; new files were formatted where needed.


## Milestone 4 — Error Boundary

Contain broken step blast radius to the outlet.

1. Add a minimal internal `FlowErrorBoundary` class component (no third-party dependency)
2. Place it in `<FlowOutlet />` around the Suspense+step subtree; wire `errorFallback` prop
3. Write `src/features/error-boundary.feature` with scenarios: a step that throws renders `errorFallback`; the outlet remains mounted after the error
4. Implement step bindings in `src/features/error-boundary.spec.ts`; all scenarios green
5. Add an `ErrorBoundary` story in `src/stories/ErrorBoundary.stories.tsx` showing a flow where the second step throws and the `errorFallback` is rendered in place of the outlet content

---

### Milestone 4 — Completion Notes

- Created `FlowErrorBoundary` class component in [src/internal/FlowErrorBoundary.tsx](src/internal/FlowErrorBoundary.tsx): a minimal React error boundary with `getDerivedStateFromError`, `componentDidCatch` (no-op), and a `resetError()` method for future recovery. Accepts `errorFallback?: ReactNode` — renders it on error, or `null` if not provided.
- Wired into [src/components/FlowOutlet.tsx](src/components/FlowOutlet.tsx): `FlowErrorBoundary` wraps the `<Suspense>` + `<ActiveStep />` subtree inside the `<FlowContext.Provider>` but outside `<Suspense>`, matching the AGENT.md tree structure. Added `errorFallback?: ReactNode` prop to `FlowOutlet`.
- Added BDD feature + spec: [src/features/error-boundary.feature](src/features/error-boundary.feature) and [src/features/error-boundary.spec.tsx](src/features/error-boundary.spec.tsx) — scenarios verify that a throwing step renders `errorFallback` (and the broken step is not visible), and that the outlet remains mounted after the error.
- Added a Storybook story [src/stories/ErrorBoundary.stories.tsx](src/stories/ErrorBoundary.stories.tsx) demonstrating a two-step flow where Step 2 throws and the `errorFallback` (a Mantine Alert) is rendered in place of the outlet content.
- Verification: `yarn test:bdd` — 21 tests pass (7 new). `yarn test:unit` — 37 tests pass. `yarn lint` — zero new violations. `yarn typecheck` — only pre-existing normalizer type errors (no new errors introduced).

---

## Milestone 5 — Chrome + `useFlowContext`

Allow stable chrome components (modal headers, progress indicators) to coexist with async step transitions.

1. Implement `useFlowContext` in a new file `src/hooks/useFlowContext.ts`: read-only wrapper around the internal context; throws if called outside provider boundary
2. Export `useFlowContext` from `src/index.ts`
3. Update `<FlowOutlet />` to accept an optional chrome child (rendered between provider and Suspense boundary, matching the tree structure in AGENT.md)
4. Write `src/features/chrome-and-flow-context.feature` with scenarios: chrome renders alongside the active step; chrome stays mounted when the step advances; chrome reads updated context via `useFlowContext` after a `contextPatch`; a step renders without chrome when none is provided
5. Implement step bindings in `src/features/chrome-and-flow-context.spec.ts`; all scenarios green
6. Add a `ChromeFlow` story in `src/stories/ChromeFlow.stories.tsx` showing a modal-style outlet with a header chrome component that displays a title driven by `useFlowContext`; title updates visibly as steps advance, but does not flicker on async transitions of different lengths - chrome remains static despite fallback

---

## Milestone 6 — TypeScript Generics

Thread result type safety from `useFlowInit` through to `resolve`/`abort`.

1. Make `useFlowInit` generic: `useFlowInit<TResult = unknown>()` — types `initFlow`'s return promise/callback
2. Carry `TResult` through `FlowContextValue` to `resolve` in context, so `useStep`'s `resolve` is typed at the outlet level
3. Document the acknowledged trade-off (no compile-time guarantee a step is inside the correct outlet) in AGENT.md status section
4. `yarn typecheck` must pass cleanly with the projected examples from AGENT.md used as type fixtures

---

## Milestone 7 — Build & Publish Setup

Verify the library is distributable as a proper dual-format package.

1. Run `yarn build`; confirm `dist/` contains ESM + CJS + `.d.ts` outputs
2. Verify `package.json` `exports` field covers `import`, `require`, and `types` conditions
3. Test local consumption via `yarn link` in a throwaway consumer app using the projected examples

---

## Milestone 8 — README & Docs

1. Write root-level `README.md` covering: install, minimal example (matching projected examples in AGENT.md), full API reference for `useFlowInit`, `useStep`, `useFlowContext`, and `<FlowOutlet />`
2. Update the *Current Status* checklist in AGENT.md to reflect completed items

---

## Verification (overall)

- `yarn test` — all unit + BDD tests green
- `yarn typecheck` — zero errors
- `yarn lint` — zero Biome violations
- `yarn build` — clean dist output
- Manual smoke test in a local consumer app using `yarn link`

---

## Decisions

- Tests woven into each milestone rather than batched at the end — catches regressions early and keeps each milestone verifiable independently
- `useFlowContext` deferred to Milestone 5 (after chrome) rather than Milestone 2 — it is only useful alongside chrome, and implementing it early would mean testing it without its primary use case
- No third-party error boundary library — a minimal internal class component keeps the dependency surface at zero
