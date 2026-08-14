# Transition Shortcut Factories — Design

- **Date:** 2026-08-13
- **Status:** Approved for planning
- **Branch context:** `main` at `v1.1.0-pre` (transitions landed in #33)

## Goal

Provide officially supported transition "shortcut" factories for the basic
transition types demonstrated in the Docusaurus demos and Storybook. The goal
is to reduce boilerplate and up-front cognitive load: today a consumer who
wants an animated flow must hand-roll a transition harness from the docs
guide. The factories turn that into a one-liner.

## Scope

### In scope

- New `react-sequent/transitions` subpath module exporting two factories:
  - `crossfade(options?)` — concurrent fade-out over fade-in.
  - `slide(options?)` — sequential exit-left-then-enter-right, plain
    full-opacity slide by default with fade as an option.
- Both factories return a render-prop function assignable to
  `SequentOutlet`'s `transition` prop.
- Packaging: second build entry, `exports` map entry, type declarations for
  both ESM and CJS.
- Documentation and dogfooding (see §7).

### Out of scope (explicit non-goals)

- Motion-based transitions (the wizard demo's `motion` effect stays
  hand-rolled in docs; the library ships zero runtime dependencies).
- `direction` option on `slide` (deferred enhancement if requested).
- `prefers-reduced-motion` handling (deferred enhancement).
- Easing presets, spring physics, per-step config.

## Decision log

| Decision | Chosen | Alternatives rejected |
|---|---|---|
| Delivery shape | `react-sequent/transitions` subpath module | Root namespace object; root named exports; kind-parameter factory |
| Factory shape | Two standalone factories `crossfade` / `slide` | Pre-built constants without options; single `createTransition(kind, opts)` |
| Naming | `slide` short name; fade is an option (`slide({ fade: true })`) so the name stays short | `sequentialSlide` (verbose), `fadeSlide` (loses sequential semantics) |
| Style delivery | Per-outlet, React-rendered in-tree `<style>` | Imperative singleton injection into `document.head` |
| Option isolation | Static keyframes + inline CSS custom properties on wrappers | Option-baked keyframe text (would leak across outlets via shared `@keyframes` names) |
| Options | `duration`/`easing` on both; `fade`/`distance` on `slide` | Ultra-minimal (duration only); `direction` (YAGNI) |

### Why per-outlet in-tree `<style>` (both mechanisms matter)

1. **Per-outlet in-tree delivery** is chosen on its own merits: SSR-exact
   (keyframes are in the server HTML), lifecycle-correct (styles mount and
   unmount with the outlet — no forever-global styles), no `document` access
   or global mutation, trivially testable, and idiomatic for the React
   ecosystem. Trade-off accepted: each mounted outlet carries its own copy of
   the keyframes (a few hundred bytes of identical CSS). Simultaneously
   active outlets are rare, and identical `@keyframes` redefinitions are
   harmless in all browsers.
2. **Static keyframes + inline custom-property options** is the actual
   isolation guarantee: every customization (`duration`, `easing`, `distance`,
   fade opacity) resolves per wrapper element via inline `--rs-*` custom
   properties and the `animation` shorthand. Keyframe text never varies by
   options, so no cross-outlet or cross-flow leakage is possible. Baking
   options into per-outlet keyframes under shared names would make the
   last-mounted outlet's definition win for all outlets on the page — the
   exact leak this design prevents.

## 1. Architecture & packaging

- New module `src/transitions/` with public entry `src/transitions/index.ts`
  and internal styles/keyframes in a sibling (e.g. `styles.ts`).
- Root `src/index.ts` is **unchanged** — the factories are available only via
  the subpath, keeping the root API minimal.
- `package.json` gains:

  ```json
  "exports": {
    ".": { /* unchanged */ },
    "./transitions": {
      "import": {
        "types": "./dist/transitions.d.ts",
        "default": "./dist/transitions.js"
      },
      "require": {
        "types": "./dist/transitions.d.cts",
        "default": "./dist/transitions.cjs"
      }
    }
  }
  ```

- `vite.config.ts` lib build becomes multi-entry:

  ```ts
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        transitions: resolve(__dirname, "src/transitions/index.ts"),
      },
      formats: ["es", "cjs"],
      fileName: (format, entryName) =>
        `${entryName === "index" ? "react-sequent" : entryName}.${format === "es" ? "js" : "cjs"}`,
    },
    // rollupOptions.external unchanged: react, react-dom, react/jsx-runtime
  }
  ```

- **Build risk (flagged for the implementation plan):** `vite-plugin-dts`
  with `rollupTypes: true` and multiple entries. The plan must verify that
  `dist/transitions.d.ts` and `dist/transitions.d.cts` are emitted correctly.
  Fallback if `rollupTypes` conflicts with multi-entry: run a separate dts
  pass per entry or drop `rollupTypes` for this build.
  **Resolved (plan review 2026-08-13):** verification is automated — add a
  `publint` / `@arethetypeswrong` step to the existing CI `build` job
  (`ci.yml` already runs `yarn build`), asserting the `exports` map and dts
  for both entries. Verified locally that `ci.yml`'s docs job builds the
  library before docs, so the portal + `dist` ordering already holds.
- `"sideEffects": false` remains valid: the factories perform no side
  effects at import time or module scope; everything is declarative JSX.

## 2. API

```ts
// react-sequent/transitions

export type { TransitionSlotProps } from "../components/FlowOutlet"; // re-exported for self-sufficiency

export interface CrossfadeOptions {
  /** Animation duration in milliseconds. Default: 300. */
  duration?: number;
  /** CSS timing function. Default: "ease". */
  easing?: string;
}

export interface SlideOptions extends CrossfadeOptions {
  /** Fade the outgoing/incoming step while it slides.
   *  Default: false — a plain full-opacity slide. */
  fade?: boolean;
  /** Horizontal slide distance in px. Default: 24. */
  distance?: number;
}

export function crossfade(options?: CrossfadeOptions): (props: TransitionSlotProps) => ReactNode;
export function slide(options?: SlideOptions): (props: TransitionSlotProps) => ReactNode;
```

- Both factories return a fresh function per call. Docs recommend assigning
  to a module-level constant (`const transition = crossfade();`), though
  inline calls are safe because the keyframe names are static.
- The returned functions are plain components of the `transition` render
  prop: they receive `{ previousStep, nextStep, phase, onExited,
  transitionKey }` and return JSX.

### `crossfade` render behavior (mirrors the Storybook harness)

- `phase === "exited"` → return `nextStep` bare (no wrappers).
- Otherwise → `position: relative` container holding:
  - exit wrapper, key `` `exit-${transitionKey}` ``, `position: absolute;
    inset: 0`, animation `rs-crossfade-out ${duration}ms ${easing} forwards`,
    `onAnimationEnd={onExited}`;
  - enter wrapper, key `` `enter-${transitionKey}` ``, animation
    `rs-crossfade-in ${duration}ms ${easing}`.
- The `transitionKey` keys force remounts across back-to-back queued
  transitions (existing outlet contract).

### `slide` render behavior (sequential)

- Container `position: relative; overflow: hidden`.
- While `previousStep !== null`: render only the exit wrapper, key
  `` `exit-${transitionKey}` ``, animation `rs-slide-out-left ... forwards`,
  `onAnimationEnd={onExited}`.
- Once `previousStep === null`: render only the enter wrapper, key
  `` `enter-${transitionKey}` ``, animation `rs-slide-in-right ...`. The
  stable key mounts it exactly once at the `entering` phase and it stays
  mounted through `exited`.

## 3. Stylesheet strategy

Each render output includes a literal in-tree `<style>` element (SSR-exact,
no `document` access). The keyframe text is **constant per factory** — no
option value ever appears in it:

```css
@keyframes rs-crossfade-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}
@keyframes rs-crossfade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes rs-slide-out-left {
  from { opacity: var(--rs-from-opacity, 1); transform: translateX(0); }
  to   { opacity: var(--rs-to-opacity, 1); transform: translateX(calc(-1 * var(--rs-distance, 24px))); }
}
@keyframes rs-slide-in-right {
  from { opacity: var(--rs-from-opacity, 1); transform: translateX(var(--rs-distance, 24px)); }
  to   { opacity: var(--rs-to-opacity, 1); transform: translateX(0); }
}
```

- `duration` and `easing` ride the inline `animation` shorthand per wrapper.
- `distance` and fade opacity ride inline custom properties per wrapper:
  - exit wrapper: `--rs-distance: ${distance}px`; if `fade`, additionally
    `--rs-to-opacity: 0` (default stays `1`).
  - enter wrapper: `--rs-distance: ${distance}px`; if `fade`, additionally
    `--rs-from-opacity: 0`.
- Keyframe names are namespaced (`rs-`) and are an internal detail;
  consumers must not depend on them.
- Rendering/stability notes (validated during design): a `<style>` element
  produces no box and is a plain sibling in the container, so it does not
  affect the absolutely-positioned exit overlay; the CSS string is constant,
  so re-renders cause no DOM churn and no animation restarts; SSR output is
  exact with no hydration mismatch; StrictMode double-render is safe
  (no side effects).
- Implementation note: React's `CSSProperties` typing for `--*` custom
  properties may require a small type helper/cast.

## 4. Edge cases & error handling

- **`onExited` bubbling guard:** the exit wrapper's `onAnimationEnd` handler
  filters `event.target === event.currentTarget` before calling `onExited`,
  so nested step-content animations cannot prematurely end a transition.
  (This is a hardening over the raw demo harnesses.)
- **`previousStep === null`:** renders nothing in the exit slot. Harmless:
  the outlet never starts a transition without a previous step (existing
  invariant); even an empty animated wrapper would fire `onAnimationEnd`, so
  no deadlock is possible.
- **Factory identity:** functions are recreated per factory call. Because
  keyframe names are static, re-invoking inline is visually safe; docs still
  recommend a module-level constant.
- **Multiple outlets / flows:** isolation holds per §Decision log; identical
  duplicate style tags are accepted as bounded, harmless redundancy.
- **Out of scope:** `prefers-reduced-motion`, `direction` option.

## 5. Testing

- Unit tests in `src/transitions/__tests__/transitions.test.tsx`:
  - `crossfade`: bare `nextStep` at `exited`; both wrappers at
    `exiting`/`entering`; keys embed `transitionKey`; exit wrapper is
    absolutely positioned and wires `onAnimationEnd`; `duration`/`easing`
    appear in the `animation` shorthand; `onExited` fires only for
    non-bubbling events.
  - `slide`: only the exit wrapper while `previousStep` is non-null; only the
    enter wrapper once it is null; `fade` toggles the opacity custom
    properties; `distance` sets `--rs-distance`; shorthand reflects
    `duration`/`easing`.
  - In-tree `<style>` is present in the rendered output with the static
    keyframe text.
- ~~New BDD feature `src/features/transition-factories.feature` + spec~~ —
  **cut after plan review (2026-08-13).** jsdom never fires `animationEnd`, so
  factory-driven scenarios would need an artificial settle mechanism, and no
  consumer-visible regression was identified that the unit tests plus the
  existing harness-driven `transition.feature` don't already cover.
  Integration proof for the factories is the dogfooded Storybook stories and
  docs demos instead.
- Type-level: factories must be assignable to
  `SequentOutletProps["transition"]`. Verified through usage in the migrated
  stories — root `tsconfig.json` includes `src`, so `yarn typecheck` covers
  `src/stories/` in CI. Note: docs demos (MDX live code blocks) are
  transpiled but not type-checked by CI; the stories are the type gate.

## 6. Documentation & dogfooding

- New page `docs/docs/api/transitions.mdx`:
  - import from `react-sequent/transitions`;
  - signatures and options tables for both factories;
  - "Examples" links: `crossfade` → subsection-flow demo; `slide({ fade:
    true })` → modal demo; wizard demo referenced as the fully custom
    (Motion) harness example.
- `docs/docs/concepts.mdx` — "Animated Transitions" section:
  - main example switches to `crossfade()`;
  - new compact "Writing a custom transition" subsection preserves one
    minimal hand-rolled example so the raw-harness knowledge is not lost;
  - keep the phase lifecycle and `transitionKey` explanations.
- `docs/docs/getting-started.mdx`: one-liner pointing to the factories.
- `docs/docs/api/flow-outlet.mdx`: `transition` prop section gains a pointer
  to the transitions page.
- Dogfooding migrations:
  - `src/stories/TransitionFlow.stories.tsx` — both stories use the
    factories. `Crossfade` → `crossfade()` (defaults match the harness's
    300ms/ease exactly). `Sequential` → plain `slide()` — the story
    intentionally drops the harness's built-in opacity fade to showcase the
    default; the `fade: true` variant is demonstrated by the modal demo.
    (Intentional visual change, confirmed during plan review.)
  - `docs/docs/demos/modal.mdx` — replace hand-rolled `sequentialTransition`
    with `slide({ fade: true })`; the demo's 24px distance and 300ms duration
    match the factory defaults exactly.
  - `docs/docs/demos/subsection-flow.mdx` — replace hand-rolled crossfade
    with `crossfade()`.
  - `docs/docs/demos/wizard.mdx` — unchanged (Motion, custom reference).
- Consistency sweep (repo convention): `docs/static/llms.txt` public API
  surface section and root `README.md` "Animated transitions" section gain
  the `react-sequent/transitions` shortcut.
- No version/changelog action — ships with the in-flight `1.1.x` prerelease
  line.

## 7. Build & publish checklist (for the plan)

- `yarn build` emits `dist/react-sequent.{js,cjs}` (unchanged names) plus
  `dist/transitions.{js,cjs}` and `dist/transitions.d.{ts,cts}`.
- `yarn typecheck` passes with the new entry included.
- `yarn test`, `yarn lint` green.
- Docs build (`yarn docs:build`) resolves the subpath through the portal
  dependency and the demos render the factory-driven transitions.

## Review Notes (plan review, 2026-08-13)

Triage: Completeness 4/5, Feasibility 4/5, Scope 5/5, Testability 4/5,
Risk 4/5, Assumptions 4/5. Deep-dived testability, risk, feasibility.

Verified claims:
- modal.mdx slide keyframes use 24px / 300ms — match factory defaults.
- `crossfade` DOM shape (container → `<style>` sibling → absolute `inset: 0`
  exit wrapper → enter wrapper) matches the subsection-flow checkout harness;
  `.demo-checkout > :nth-child(2)` structural selectors survive migration.
- `docs/src/css/custom.css` contains no `@keyframes`/`animation` — all demo
  keyframes live in runtime `<style>` tags, so migrations leave no orphaned
  site CSS.
- Root `tsconfig.json` includes `src` → migrated stories are type-checked by
  `yarn typecheck` in CI.
- `ci.yml` docs job builds `react-sequent` before docs — dist/portal ordering
  already handled.

Noted for awareness:
- `slide` keeps its enter wrapper mounted through `exited` while `crossfade`
  returns bare `nextStep` — asymmetry mirrors the proven harnesses; fine.
- `slide`'s `overflow: hidden` container can clip step content
  (tooltips/dropdowns) — inherent to slide animations.
- `prefers-reduced-motion` stays deferred (out of scope).
- Docs demos (MDX live blocks) are not type-checked by CI.
