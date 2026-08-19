---
name: use-react-sequent
description: 'Consumer-facing guidance for adopting and using react-sequent (pinned to v1.1.0) in React apps. Use when answering questions about multi-step forms, onboarding flows, modal flows, wizards, checkout flows, animated step transitions, or when choosing between useSequentFlow, useSequentStep, and useSequentContext. Prefer a light overview first, then point to the hosted docs and llms.txt as a fallback for deeper API and edge-case details.'
argument-hint: 'Describe the flow you want to build or the react-sequent API question you want answered.'
---

# Use react-sequent

> **Version pin:** This skill targets **react-sequent v1.1.0** (the current package version). It is written to stand on its own. If the API surface or behavior seems stale — for example the published docs or `llms.txt` still reference an older version, or you are on a newer/npm-installed release — verify against the hosted docs and the published `llms.txt` as a fallback (see [Checking for Staleness](#checking-for-staleness)).

## What This Skill Produces

- Consumer-oriented explanations of react-sequent's philosophy and API.
- Small implementation sketches for common UX flows such as onboarding, checkout, and modal wizards.
- Hook-selection guidance grounded in the library's actual public surface.
- Guidance for adopting the library into an existing React app and structuring steps, context, chrome, async loading, and animated transitions.
- Pointers to the hosted documentation, with the published `llms.txt` used as a fallback for deeper or updated detail.

## When to Use

- The user wants to build a step-based UX flow with react-sequent.
- The user asks how react-sequent differs from a centralized state machine.
- The user needs to choose between `useSequentFlow()`, `useSequentStep()`, and `useSequentContext()`.
- The user wants a minimal example, a migration path, or help structuring a flow around steps, context, chrome, async loading, animated transitions, or typed scopes.
- The user is adopting react-sequent into an existing React app (React ^16.14.0 || ^17 || ^18 || ^19).

## Core Framing

- Lead with the defining idea: the current step decides what comes next.
- Treat flows as implicit. Do not introduce or require a centralized transition map.
- Keep the API surface small in explanations. Prefer the minimal pattern that solves the user's problem.
- Present context as consumer-owned data carried through the flow, not as a state management system.
- Mention that `retreat()` navigates backward but does not restore step-local component state.
- Keep chrome outside step components. Chrome and idle children should read flow data with `useSequentContext()`, not `useSequentStep()`.
- By default the outlet swaps steps immediately. Animated transitions are opt-in via the `transition` prop and the `react-sequent/transitions` factories (`crossfade()`, `slide()`).

## API Selection Guide

- Use `useSequentFlow()` at the flow host. It provides `init()`, `status`, `result`, and the bound `SequentOutlet`.
- Use `useSequentStep()` inside active step components. It provides `advance()`, `retreat()`, `resolve()`, `abort()`, and the current flow context.
- Use `useSequentContext()` in chrome, idle children, or any flow-level consumer component that needs context or termination controls but not navigation.
- Explain `SequentOutlet` as the render target for the active flow, with optional idle children, async fallback, stable chrome, and error handling. It also accepts a `transition` render prop to enable animated step transitions.
- For animated transitions, mention `react-sequent/transitions` (subpath export) with `crossfade()` and `slide()` factories. Assign the factory result to a module-level constant and pass it to `SequentOutlet`'s `transition` prop.
- The `SequentOutlet` component accepts an `onFlowStarted` prop that receives a callback with controls (retreat, abort, getHistoryDepth) when the flow begins. This callback fires once per flow activation and returns a cleanup function that runs when the flow settles.

## Procedure

1. Identify the flow shape the user is building: onboarding, modal, wizard, checkout, async branch, or typed reusable flow.
2. Start with a short, high-level explanation of the paradigm before giving code.
3. Choose the smallest relevant API surface using the guide above.
4. Sketch a minimal host plus two or three steps. Keep branching in step code with normal conditionals.
5. Add context only when the user needs cross-step data, persistent values across retreat, or chrome state.
6. Add animated transitions only if the user asks for them; default to the immediate swap for simplicity.
7. If the user asks for full signatures, prop details, or edge cases, consult the hosted docs and `llms.txt` instead of guessing.

## Implementation Guardrails

- Prefer one `useSequentFlow()` host per rendered flow instance.
- Ensure `SequentOutlet` is rendered before calling `init()`.
- For async steps, prefer a step loader such as `() => import("./MyStep")` and let the outlet's fallback handle loading.
- If state must survive a retreat, write it into flow context before advancing.
- Do not place `useSequentStep()` in chrome or idle children.
- Do not over-design the flow with extra wrappers or machine-style config unless the user explicitly asks for them.
- For transitions, attach the `transitionKey` from `TransitionSlotProps` as a React `key` on animation wrapper elements so React restarts animations on repeated exits.

## Checking for Staleness

This skill is self-contained, but two things can drift:

- **Package version:** this skill targets `1.1.0`. Check the `version` field of the installed `react-sequent` package (`yarn why react-sequent` / `npm ls react-sequent`, or the `package.json`). If it differs from `1.1.0`, treat this skill's API details as potentially outdated.
- **Published docs / llms.txt:** the published `llms.txt` is generated from the repo and can reference an older version than the latest release. If the local `docs/static/llms.txt`, the hosted docs, or this skill disagree, trust the hosted docs and the latest `llms.txt` for the source of truth on current behavior.

## Escalate to Deeper References

This skill covers adoption and the common patterns on its own. Use these sources as a fallback when the request moves beyond a light overview or when you are verifying staleness:

- Hosted docs: https://ganondev.github.io/react-sequent/
- API reference: https://ganondev.github.io/react-sequent/docs/api/use-sequent-flow
- LLMS index (fallback / staleness check): https://ganondev.github.io/react-sequent/llms.txt

Reach for the hosted docs first when you need exact examples or page-level guidance. Reach for `llms.txt` when you need a compact, high-signal summary of philosophy, vocabulary, API shape, and behavioral constraints — and always use it to double-check when this skill's pinned version looks stale.
