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

These two hooks must not share a public interface. Compartmentalization is a hard requirement, not a preference.

### Outlet

`<FlowOutlet />` is a component the consumer renders wherever they want flow output to appear. It:

- Invisibly owns the internal React context provider
- Acts as the Suspense boundary for async step loading
- Accepts a `fallback` prop for the loading state (passed through to Suspense)
- Has no opinions about layout or visual structure

The consumer controls placement. The library controls nothing above the outlet.

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

## CI/CD

Two separate workflows. One validates every push; one ships.

### Workflow 1: CI (`ci.yml`)

Triggers on every push and pull request. Does not publish.

```yaml
on:
  push:
  pull_request:
```

Steps: install → lint → typecheck → test → build.

### Workflow 2: Release (`release.yml`)

Triggers when a GitHub Release is published. This is the only publish path.

```yaml
on:
  release:
    types: [published]
```

Steps: install → lint → typecheck → test → build → `npm publish`.

Publishing authenticates via an npm token stored as a GitHub Actions secret:

```yaml
- name: Publish to npm
  run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Generate the token once in your npm account settings and add it to the repo under **Settings → Secrets → Actions**.

### Tagging and releasing

Tags are created *through* GitHub Releases, not pushed directly. The flow is:

1. Bump the version in `package.json` and commit
2. On GitHub, create a new Release — set the tag (e.g. `v1.2.0`), write release notes, publish
3. Publishing the release fires the `release.yml` workflow, which builds and publishes to npm

The tag should match the `package.json` version. The release workflow does not enforce this automatically — it is a manual convention.

### Pre-release channels

For pre-releases (e.g. `v2.0.0-beta.1`), publish to a dist-tag so it does not become the default `latest` install:

```yaml
- name: Publish pre-release to npm
  run: npm publish --tag beta
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Consumers opt in explicitly: `npm install react-sequent@beta`. The `latest` tag is untouched until a stable release is published without `--tag`.

---

## Current Status

- [ ] Core transition logic
- [ ] `useFlowInit` hook
- [ ] `useStep` hook
- [ ] `<FlowOutlet />` component
- [ ] Suspense / async step normalization
- [ ] TypeScript types
- [ ] Tests
- [ ] Build / publish setup
- [ ] README / docs

> Update this section as work progresses. It is the fastest way for an agent to orient itself at the start of a session.

---

## Open Questions

> Running list of unresolved design decisions. Add to this rather than making an arbitrary call.

- ~~**History / back-navigation**~~ — Resolved. See *On retreat and state persistence* in API Constraints.
- ~~**Async step loading**~~ — Resolved. Suspense at the outlet boundary; sync steps bypass it entirely.
- ~~**Hooks API shape**~~ — Resolved. `useFlowInit` + `useStep`, strictly compartmentalized.
- How does `useFlowInit` associate a flow with a specific `<FlowOutlet />`? (e.g. a ref, a `useId`-based key, or something else)
- What does `advance` look like when the next step is conditional? Does the step pass a loader directly, or a function that returns a loader?
- Should `resolve` and `abort` carry typed payloads, and if so, how does that interact with TypeScript generics on `useFlowInit`?
- How should multiple concurrent flows be handled — is that in scope for v1?
- What's the error boundary story for a step that throws?