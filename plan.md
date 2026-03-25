## Plan: `useSequentFlow` Primary API

Replace the current ref-driven primary API with a single hook-centered abstraction: `useSequentFlow()`. That hook becomes the default way to create and control one flow host instance, and it returns a bound `init` function plus a bound `SequentOutlet` component. This removes the explicit ref coupling between [src/hooks/useFlowInit.ts](src/hooks/useFlowInit.ts#L15-L42) and [src/components/FlowOutlet.tsx](src/components/FlowOutlet.tsx#L139-L165), making the library feel more like a React abstraction while preserving the existing runtime behavior inside the outlet. Per your decision, [src/components/FlowOutlet.tsx](src/components/FlowOutlet.tsx) should stop being a direct public export for now to keep the surface minimal; it can remain an internal primitive that the hook wraps.

**Steps**
1. Introduce `useSequentFlow()` as the new primary public entry point in [src/hooks](src/hooks) and export it from [src/index.ts](src/index.ts). Its public contract should return a bound `init` function and a bound `SequentOutlet` component.
2. Internally keep [src/components/FlowOutlet.tsx](src/components/FlowOutlet.tsx#L62-L238) as the lifecycle/runtime engine for active state, step transitions, history, chrome, error fallback, and idle rendering. The architectural change is public composition, not runtime ownership.
3. Move the current imperative binding logic from [src/hooks/useFlowInit.ts](src/hooks/useFlowInit.ts#L18-L35) behind `useSequentFlow()`, so consumers no longer manage a `ref` or call an imperative handle directly.
4. Remove `FlowOutlet` from the public export surface in [src/index.ts](src/index.ts), making it an internal implementation detail for this release. Keep naming internal symbols stable enough that re-exporting later remains possible.
5. Decide whether [src/hooks/useFlowInit.ts](src/hooks/useFlowInit.ts) is removed entirely or retained as an internal compatibility layer used by `useSequentFlow()`. Given the minimalism goal, the preferred direction is to retire it from the public API rather than document two parallel entry paths.
  - DECISION: Remove it from public surface
6. Preserve the current step/chrome capabilities exactly as they are today in [src/hooks/useStep.ts](src/hooks/useStep.ts#L15-L30), [src/hooks/useFlowContext.ts](src/hooks/useFlowContext.ts#L14-L22), and [src/internal/context.ts](src/internal/context.ts#L1-L46). The initialization API changes, but the step model and compartmentalization stay consistent.
7. Update public naming and docs everywhere the old pair appears. This includes replacing `useFlowInit()` and direct `FlowOutlet` usage in [docs/docs/getting-started.mdx](docs/docs/getting-started.mdx), [docs/docs/api/flow-outlet.mdx](docs/docs/api/flow-outlet.mdx), [docs/docs/api/use-flow-init.mdx](docs/docs/api/use-flow-init.mdx), [docs/docs/demos/modal.mdx](docs/docs/demos/modal.mdx), [docs/docs/demos/wizard.mdx](docs/docs/demos/wizard.mdx), [docs/docs/demos/toast.mdx](docs/docs/demos/toast.mdx), and any story/test coverage built around the ref API.
8. Rewrite demos and stories so the intended usage reads as: call `useSequentFlow()`, render `SequentOutlet`, pass `init` around as needed. This should replace the current pattern of custom wrappers whose main purpose is hiding the outlet ref.
9. Update or replace tests covering initialization semantics, especially the BDD and hook tests in [src/features/flow-init.spec.tsx](src/features/flow-init.spec.tsx), [src/features/flow-init.feature](src/features/flow-init.feature), and [src/hooks/__tests__/useFlowInit.test.tsx](src/hooks/__tests__/useFlowInit.test.tsx), so they assert the new public contract rather than ref attachment behavior.
10. Keep the low-level imperative mechanism internal for now. If users later need direct outlet handles, that can be reintroduced deliberately as a secondary export instead of remaining part of the default story.

**Verification**
- Confirm the documented getting-started flow no longer requires manual refs or direct outlet imports.
- Confirm one `useSequentFlow()` call creates one isolated flow host, preserving support for multiple independent flows without extra configuration.
- Confirm `init`, `advance`, `retreat`, `resolve`, `abort`, chrome behavior, idle-child behavior, and last-resolved context semantics still match the runtime in [src/components/FlowOutlet.tsx](src/components/FlowOutlet.tsx#L71-L136) and [src/components/FlowOutlet.tsx](src/components/FlowOutlet.tsx#L167-L238).
- Confirm public exports in [src/index.ts](src/index.ts) only expose the minimal surface intended for this release.
- Confirm docs and examples consistently use `useSequentFlow()` with `SequentOutlet`.
- Use the #tool:askQuestions tool to suspend and get explicit verification from the user on visual and behavioral changes in a live browser via storybook and docusaurus demos

**Decisions**
- Chose `useSequentFlow()` as the primary hook name.
- Chose `SequentOutlet` as the bound outlet returned from the hook.
- Chose to stop exporting `FlowOutlet` publicly for now to preserve minimalism.
- Chose not to keep two equally documented initialization paths, to avoid two-pronged coupling and API dilution.
- Chose to rename `useStep` to `useSequentStep`, and `useFlowContext` to `useSequentContext`

## Progress

- Done: added `useSequentFlow()`, `SequentOutlet`, `useSequentStep()`, and `useSequentContext()`.
- Done: removed `FlowOutlet` and `useFlowInit` from the public export surface in [src/index.ts](src/index.ts).
- Done: preserved outlet runtime behavior in [src/components/FlowOutlet.tsx](src/components/FlowOutlet.tsx) as the internal engine.
- Done: updated core hook/unit/BDD tests to the new API and verified them with Vitest.
- Done: updated Storybook examples to the new hook-centered usage.
- Done: updated the main getting-started, concepts, homepage, sidebar, and live-scope docs.
- In progress: finishing the remaining docs/demo pages that still reference the old API, especially [docs/docs/demos/modal.mdx](docs/docs/demos/modal.mdx), [docs/docs/demos/wizard.mdx](docs/docs/demos/wizard.mdx), [docs/docs/demos/toast.mdx](docs/docs/demos/toast.mdx), and the legacy API pages.

## Remaining work

1. Update the remaining docs demos to use `useSequentFlow()` + `SequentOutlet` consistently.
2. Decide whether to keep, alias, or remove the legacy API docs pages (`use-flow-init`, `use-step`, `use-flow-context`, `flow-outlet`) so the docs surface matches the new public API.
3. Run a final docs build / storybook smoke check once the remaining pages are migrated.
4. Optionally remove the internal compatibility wrappers (`useStep`, `useFlowContext`) in a follow-up if the package should expose only the renamed hooks.
