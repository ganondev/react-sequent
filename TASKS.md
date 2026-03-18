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

---

## Milestone 3 — Async Step Loading

Allow consumers to pass dynamic imports as step loaders without changing the API shape.

1. Implement `normalizeStepLoader` in `src/internal/normalizer.ts`: if the argument is already a component, return it; if it is a function returning a promise, wrap with `React.lazy`
2. Apply the normalizer inside `advance` (in `useStep`) and `initFlow` (in `useFlowInit`) before storing to history
3. Wrap the active step render in `<FlowOutlet />` with `<Suspense fallback={props.fallback}>` — only around the step, not the future chrome slot
4. Write `src/features/async-step-loading.feature` with scenarios: async loader shows `fallback` during suspension then renders the step; sync loader renders immediately with no fallback shown
5. Implement step bindings in `src/features/async-step-loading.spec.ts`; all scenarios green
6. Set up Storybook in the repo (Vite builder, React); add a `BasicFlow` story in `src/stories/BasicFlow.stories.tsx` showing a two-step sync flow and a two-step async flow with a visible `fallback` state

---

## Milestone 4 — Error Boundary

Contain broken step blast radius to the outlet.

1. Add a minimal internal `FlowErrorBoundary` class component (no third-party dependency)
2. Place it in `<FlowOutlet />` around the Suspense+step subtree; wire `errorFallback` prop
3. Write `src/features/error-boundary.feature` with scenarios: a step that throws renders `errorFallback`; the outlet remains mounted after the error
4. Implement step bindings in `src/features/error-boundary.spec.ts`; all scenarios green
5. Add an `ErrorBoundary` story in `src/stories/ErrorBoundary.stories.tsx` showing a flow where the second step throws and the `errorFallback` is rendered in place of the outlet content

---

## Milestone 5 — Chrome + `useFlowContext`

Allow stable chrome components (modal headers, progress indicators) to coexist with async step transitions.

1. Implement `useFlowContext` in a new file `src/hooks/useFlowContext.ts`: read-only wrapper around the internal context; throws if called outside provider boundary
2. Export `useFlowContext` from `src/index.ts`
3. Update `<FlowOutlet />` to accept an optional chrome child (rendered between provider and Suspense boundary, matching the tree structure in AGENT.md)
4. Write `src/features/chrome-and-flow-context.feature` with scenarios: chrome renders alongside the active step; chrome stays mounted when the step advances; chrome reads updated context via `useFlowContext` after a `contextPatch`; a step renders without chrome when none is provided
5. Implement step bindings in `src/features/chrome-and-flow-context.spec.ts`; all scenarios green
6. Add a `ChromeFlow` story in `src/stories/ChromeFlow.stories.tsx` showing a modal-style outlet with a header chrome component that displays a title driven by `useFlowContext`; title updates visibly as steps advance

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
