# react-sequent

`react-sequent` is a lightweight React library for building UX flows where each step owns its own transition logic. It is designed for multi-step forms, onboarding wizards, modal flows, and other UI sequences that move through discrete states without requiring a centralized state machine configuration.

The library deliberately exposes a small API centered on `useSequentFlow()`, `useSequentStep()`, `useSequentContext()`, and `defineSequentFlow()`.

## Technology Stack

- TypeScript for source and public types
- React and React DOM as peer dependencies (`^16.14.0 || ^17 || ^18 || ^19`)
- Vite and `vite-plugin-dts` for library builds
- Vitest, Testing Library, and `@amiceli/vitest-cucumber` for tests
- Biome for linting and formatting
- Storybook for interactive demos
- Docusaurus for project documentation
- Yarn 4 and Node.js 24+ for local development

## Project Architecture

`react-sequent` is built around an implicit flow model:

- `useSequentFlow()` creates a flow controller and returns a bound `SequentOutlet`.
- `SequentOutlet` is the render target for the active step and owns the internal provider boundary, `Suspense` fallback, and error boundary.
- `useSequentStep()` is only available inside the active step subtree and exposes `advance`, `retreat`, `resolve`, `abort`, and the current flow context.
- `useSequentContext()` is for flow-level consumers such as stable chrome or idle children; it can read context and terminate the flow, but it cannot navigate.
- `defineSequentFlow()` adds shared TypeScript context/result typing without changing runtime behavior.

This separation is intentional: the current step decides what comes next, while the outlet owns rendering and flow lifecycle concerns.

## Getting Started

### Install

```bash
npm install react-sequent react react-dom
```

### Minimal Example

```tsx
import { useSequentFlow, useSequentStep } from "react-sequent";

function WelcomeStep() {
  const { advance } = useSequentStep<string>();

  return <button onClick={() => advance(() => ConfirmStep)}>Continue</button>;
}

function ConfirmStep() {
  const { retreat, resolve } = useSequentStep<string>();

  return (
    <>
      <button onClick={retreat}>Back</button>
      <button onClick={() => resolve("done")}>Finish</button>
    </>
  );
}

export function ExampleFlow() {
  const { init, SequentOutlet } = useSequentFlow<string>();

  return (
    <>
      <SequentOutlet fallback={<p>Loading...</p>} />
      <button onClick={() => init(() => WelcomeStep)}>Start flow</button>
    </>
  );
}
```

Additional docs:

- [Getting Started](https://ganondev.github.io/react-sequent/docs/getting-started)
- [Core Concepts](https://ganondev.github.io/react-sequent/docs/concepts.mdx)
- [API reference](https://ganondev.github.io/react-sequent/docs/docs/api)

## Project Structure

```text
src/
  components/   Outlet runtime component
  hooks/        Public hooks
  internal/     Context, loader normalization, and error boundary internals
  features/     BDD feature files and acceptance specs
  stories/      Storybook demos
docs/
  docs/         Docusaurus documentation content
  src/          Docusaurus site source
```

The build outputs are generated into `dist/` as ESM, CJS, and declaration files.

## Key Features

- Step-owned transitions instead of a centralized machine definition
- Sync and async step loaders handled through the outlet's `Suspense` boundary
- Flow-scoped context for passing shared data across steps without prop drilling
- Stable chrome via `SequentOutlet` render props for shells such as modals and drawers
- Explicit `resolve` and `abort` flow termination semantics
- Typed flow wrappers with `defineSequentFlow()` for shared context/result typing
- Step-level error handling through an internal error boundary
- Idle outlet children that reappear when the flow completes or aborts

## Contributing

Development workflow, coding standards, and testing guidelines are documented in the contributing guide. For full contributor instructions (prerequisites, install steps, common commands, test workflow, and coding standards) see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE.md](./LICENSE.md).