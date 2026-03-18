import { type ComponentType, lazy } from "react";

/**
 * A step can be provided as:
 * - A React component (sync)
 * - A factory returning a dynamic import / promise (async)
 */
export type StepLoader =
  | ComponentType
  | (() => Promise<{ default: ComponentType } | ComponentType>);

/**
 * Normalizes step loaders so consumers can pass:
 * - A component directly (sync)
 * - () => import('./MyStep') (async, returns { default: Component })
 * - () => Promise<Component> (async, returns component directly)
 *
 * Sync components are returned as-is (no lazy wrapper, no Suspense flash).
 * Async factories are wrapped with React.lazy.
 */
export function normalizeStepLoader(loader: StepLoader): ComponentType {
  // If it's a plain component (function or class), return as-is.
  // Async factories are distinguishable because they return a Promise when called,
  // but we detect the simpler heuristic: components have a .prototype with render
  // (class) or are named functions that don't look like arrow factories.
  // The key insight: if calling `loader()` would produce JSX, it's a component.
  // If it produces a Promise, it's a factory. We use a lightweight check:
  // React components either have $$typeof (memo/forwardRef) or .prototype.isReactComponent (class).
  // Plain function components are just functions. But so are loader factories.
  // The distinguishing feature: loader factories return a Promise.
  // We try calling it and checking the result — but that has side effects.
  //
  // The practical approach: check for React internal markers first, then fall
  // back to treating non-marked functions as async factories. Consumers who
  // pass a plain component directly will have it detected by the markers OR
  // because it's not a function (e.g., memo() result is an object).
  //
  // Actually, the simplest reliable approach from the spec:
  // - If it has $$typeof, it's a wrapped component (memo/forwardRef) → sync
  // - If it has prototype.isReactComponent, it's a class component → sync
  // - If it's a function with length === 0 and no $$typeof, treat as factory
  //   (React function components typically accept props, length >= 0, so this
  //    is ambiguous). Instead: let the consumer type system guide it. The
  //    StepLoader type ensures only valid values arrive here.
  //
  // Definitive strategy: we check if the value is "component-like" via known
  // React markers. For everything else that's a function, we treat it as a factory.

  if (typeof loader !== "function") {
    // It's an object like React.memo() result — already a ComponentType
    return loader;
  }

  // Class component
  if (loader.prototype && loader.prototype.isReactComponent) {
    return loader;
  }

  // React internals mark memo/forwardRef/lazy with $$typeof
  if ("$$typeof" in loader) {
    return loader;
  }

  // At this point it's a plain function. It could be a function component
  // or an async factory. We use a heuristic: React function components
  // typically accept 0-2 args (props, ref). Async factories also accept 0 args.
  // Since we can't distinguish purely by signature, we rely on the type system.
  // The StepLoader type ensures that if it's "just a function" without React
  // markers, it's an async factory. But for safety, we try calling it and
  // checking if it returns a thenable.

  // Try calling and detect Promise
  try {
    const result = (loader as () => unknown)();
    if (result && typeof result === "object" && "then" in result) {
      // It's an async factory — wrap with React.lazy, reusing the already-started promise
      const promise = (result as Promise<{ default: ComponentType } | ComponentType>).then(
        (mod) => {
          if (mod && typeof mod === "object" && "default" in mod) {
            return mod as { default: ComponentType };
          }
          return { default: mod as ComponentType };
        },
      );
      return lazy(() => promise);
    }
  } catch {
    // If calling it throws, it's likely a component that expected to be
    // rendered inside React (e.g., uses hooks). Treat as sync component.
  }

  // Fall back: treat as a sync component
  return loader as ComponentType;
}
