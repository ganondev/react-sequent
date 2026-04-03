import { type ComponentType, isValidElement, lazy, type ReactElement } from "react";

/**
 * A step loader is always a zero-arg factory.
 * It may resolve synchronously to a component or asynchronously to a component/module.
 */
type LazyModule = { default: ComponentType };

type StepValue = ComponentType | LazyModule | ReactElement;

export type StepLoader = () => StepValue | Promise<StepValue>;

function wrapElementAsComponent(element: ReactElement): ComponentType {
  return function ElementStep() {
    return element;
  };
}

function isThenable(value: unknown): value is Promise<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

function toLazyModule(value: StepValue): LazyModule {
  if (isValidElement(value)) {
    return { default: wrapElementAsComponent(value) };
  }
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
    return lazy(() => resolved.then((value) => toLazyModule(value as StepValue)));
  }
  return toLazyModule(resolved).default;
}
