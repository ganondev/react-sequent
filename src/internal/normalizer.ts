import { type ComponentType, lazy } from "react";

/**
 * A step loader is always a zero-arg factory.
 * It may resolve synchronously to a component or asynchronously to a component/module.
 */
export type StepLoader = () =>
  | ComponentType
  | { default: ComponentType }
  | Promise<ComponentType | { default: ComponentType }>;

type LazyModule = { default: ComponentType };

function isThenable(value: unknown): value is Promise<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

function toLazyModule(value: ComponentType | { default: ComponentType }): LazyModule {
  if (typeof value === "object" && value !== null && "default" in value) {
    return value as LazyModule;
  }
  return { default: value as ComponentType };
}

/**
 * Resolves a factory step loader into a component suitable for rendering.
 * Sync factories return component-like values directly.
 * Async factories are wrapped with React.lazy.
 */
export function normalizeStepLoader(loader: StepLoader): ComponentType {
  const resolved = loader();
  if (isThenable(resolved)) {
    return lazy(() => resolved.then((value) => toLazyModule(value as ComponentType | LazyModule)));
  }
  return toLazyModule(resolved).default;
}
