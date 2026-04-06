# Contributing

## Development Workflow

### Prerequisites

- Node.js 24+
- Corepack-enabled Yarn 4

### Install

```bash
corepack enable
yarn install
```

### Common Commands

| Command | Purpose |
| --- | --- |
| `yarn build` | Build the library into `dist/` |
| `yarn typecheck` | Run TypeScript without emitting files |
| `yarn test` | Run the full Vitest suite |
| `yarn test:unit` | Run unit tests only |
| `yarn test:bdd` | Run feature/spec tests only |
| `yarn test:watch` | Run tests in watch mode |
| `yarn lint` | Run Biome checks on `src/` |
| `yarn format` | Apply Biome fixes on `src/` |
| `yarn storybook` | Start Storybook for local demos |
| `yarn build-storybook` | Build the Storybook site |
| `yarn docs:dev` | Start the Docusaurus docs site |
| `yarn docs:build` | Build the Docusaurus docs site |

## Coding Standards

- Preserve the library's implicit-flow model; do not reintroduce a required top-level state map.
- Keep the public API small and avoid speculative abstractions.
- Use `useSequentStep()` only inside rendered step components; use `useSequentContext()` for chrome and other flow-level consumers.
- Treat flow context as consumer-owned data carried by the library, not as internal library state.
- Follow the existing Biome conventions: 2-space indentation, double quotes, and semicolons.
- When behavior changes, update the docs, stories, and tests so the library stays internally consistent.

## Testing

Vitest is configured as two projects:

- `unit` for standard jsdom-based tests under `src/**/*.test.{ts,tsx}`
- `bdd` for Gherkin-style acceptance coverage under `src/**/*.spec.{ts,tsx}` with paired `.feature` files

The BDD scenarios cover core behavior such as flow initialization, async step loading, chrome and flow context behavior, error boundaries, and idle-child rendering.

## How to Contribute

- Install dependencies with Yarn 4 and run `yarn typecheck`, `yarn test`, and `yarn lint` before submitting changes.
- Keep user-facing changes aligned across source, Docusaurus docs, Storybook stories, and feature/spec coverage.
- Prefer small, defensible API changes that reinforce the library's step-owned transition model.
