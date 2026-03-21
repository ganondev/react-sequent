import type { ComponentType } from "react";
import { Component, forwardRef, memo } from "react";
import { describe, expect, it, vi } from "vitest";
import { normalizeStepLoader } from "../normalizer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SyncComponent() {
  return null;
}

class ClassComponent extends Component {
  render() {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Basic / happy-path
// ---------------------------------------------------------------------------

describe("normalizeStepLoader – happy path", () => {
  it("returns a plain function component as-is", () => {
    expect(normalizeStepLoader(SyncComponent)).toBe(SyncComponent);
  });

  it("returns a class component as-is", () => {
    expect(normalizeStepLoader(ClassComponent as unknown as ComponentType)).toBe(ClassComponent);
  });

  it("returns a React.memo component as-is", () => {
    const Memoized = memo(SyncComponent);
    expect(normalizeStepLoader(Memoized as unknown as ComponentType)).toBe(Memoized);
  });

  it("returns a React.forwardRef component as-is", () => {
    const Forwarded = forwardRef((_props, _ref) => null);
    expect(normalizeStepLoader(Forwarded as unknown as ComponentType)).toBe(Forwarded);
  });

  it("wraps a standard async factory { default: Component } with React.lazy", () => {
    const factory = () => Promise.resolve({ default: SyncComponent });
    const result = normalizeStepLoader(factory);
    // React.lazy returns an object with $$typeof === REACT_LAZY_TYPE
    expect(result).not.toBe(factory);
    expect(result).toHaveProperty("$$typeof");
  });

  it("wraps an async factory that resolves to a component directly with React.lazy", () => {
    const factory = () => Promise.resolve(SyncComponent);
    const result = normalizeStepLoader(factory);
    expect(result).not.toBe(factory);
    expect(result).toHaveProperty("$$typeof");
  });
});

// ---------------------------------------------------------------------------
// Torture tests – nonsense / adversarial inputs
// ---------------------------------------------------------------------------

describe("normalizeStepLoader – torture tests", () => {
  // ---- non-function inputs that are not React components ----

  it("handles a non-function, non-object value (null coerced to ComponentType) without throwing", () => {
    // null has no $$typeof and no prototype.isReactComponent; it is not a
    // function, so it falls into the 'return loader' branch.
    expect(() => normalizeStepLoader(null as unknown as ComponentType)).not.toThrow();
  });

  it("handles undefined without throwing", () => {
    expect(() => normalizeStepLoader(undefined as unknown as ComponentType)).not.toThrow();
  });

  it("handles a plain object without throwing", () => {
    expect(() => normalizeStepLoader({} as unknown as ComponentType)).not.toThrow();
  });

  it("returns a non-function value as-is (passthrough for object-like components)", () => {
    const fakeComponent = { $$typeof: Symbol("react.memo") } as unknown as ComponentType;
    expect(normalizeStepLoader(fakeComponent)).toBe(fakeComponent);
  });

  // ---- factory throws synchronously ----

  it("treats a factory that throws synchronously as a sync component (silent recovery)", () => {
    const throwingFactory = () => {
      throw new Error("boom");
    };
    // Should NOT propagate the error
    expect(() => normalizeStepLoader(throwingFactory as unknown as ComponentType)).not.toThrow();
    // Falls back to returning the function itself
    expect(normalizeStepLoader(throwingFactory as unknown as ComponentType)).toBe(throwingFactory);
  });

  // ---- factory returns non-thenable values ----

  it("treats a factory returning null as a sync component", () => {
    const nullFactory = () => null as unknown as Promise<ComponentType>;
    expect(normalizeStepLoader(nullFactory)).toBe(nullFactory);
  });

  it("treats a factory returning a number as a sync component", () => {
    const numFactory = () => 42 as unknown as Promise<ComponentType>;
    expect(normalizeStepLoader(numFactory)).toBe(numFactory);
  });

  it("treats a factory returning a string as a sync component", () => {
    const strFactory = () => "not a component" as unknown as Promise<ComponentType>;
    expect(normalizeStepLoader(strFactory)).toBe(strFactory);
  });

  it("treats a factory returning a boolean as a sync component", () => {
    const boolFactory = () => false as unknown as Promise<ComponentType>;
    expect(normalizeStepLoader(boolFactory)).toBe(boolFactory);
  });

  it("treats a factory returning a plain object (no 'then') as a sync component", () => {
    const objFactory = () => ({ notAPromise: true }) as unknown as Promise<ComponentType>;
    expect(normalizeStepLoader(objFactory)).toBe(objFactory);
  });

  // ---- exotic / adversarial thenable ----

  it("wraps a factory returning a non-standard thenable with React.lazy", () => {
    // A fake thenable: has a 'then' property but it's not a real Promise
    // biome-ignore lint/suspicious/noThenProperty: intentional — testing thenable detection
    const fakeThenable = { then: vi.fn() };
    const thenableFactory = () => fakeThenable as unknown as Promise<ComponentType>;
    const result = normalizeStepLoader(thenableFactory);
    expect(result).toHaveProperty("$$typeof");
  });

  it("wraps a factory returning a promise (pending/rejected) without throwing during normalization", () => {
    // Use a never-settling promise so no unhandled rejection noise occurs while
    // still validating that normalizeStepLoader does not throw synchronously.
    const pending = new Promise<{ default: ComponentType }>(() => {
      /* never settles */
    });
    const pendingFactory = () => pending;
    expect(() => normalizeStepLoader(pendingFactory)).not.toThrow();
    const result = normalizeStepLoader(pendingFactory);
    expect(result).toHaveProperty("$$typeof");
  });

  // ---- factory has React internal markers ----

  it("returns as-is a function decorated with $$typeof (mimics memo/forwardRef)", () => {
    const fakeWrapped = Object.assign(() => null, {
      $$typeof: Symbol("react.memo"),
    }) as unknown as ComponentType;
    expect(normalizeStepLoader(fakeWrapped)).toBe(fakeWrapped);
  });

  // ---- extreme argument counts ----

  it("treats a function with many declared parameters as a sync component when it throws", () => {
    // Functions with many params are unusual for React components but should
    // be handled gracefully: calling it with 0 args may throw, which is caught.
    function weirdFn(_a: unknown, _b: unknown, _c: unknown, _d: unknown, _e: unknown) {
      throw new Error("need more args");
    }
    expect(() => normalizeStepLoader(weirdFn as unknown as ComponentType)).not.toThrow();
  });

  // ---- class component without isReactComponent marker ----

  it("treats a class without isReactComponent as a factory (calls it, catches error)", () => {
    class PlainClass {}
    // When called as a function without `new`, a class throws a TypeError.
    // normalizeStepLoader should catch and fall back to sync component.
    expect(() => normalizeStepLoader(PlainClass as unknown as ComponentType)).not.toThrow();
  });

  // ---- circular / recursive oddities ----

  it("handles a factory whose 'then' property is not a function (non-standard thenable)", () => {
    // biome-ignore lint/suspicious/noThenProperty: intentional — testing non-standard thenable
    const weirdObj = { then: 42 };
    const factory = () => weirdObj as unknown as Promise<ComponentType>;
    // 'then' in result is true, so the code tries result.then(...) which throws
    // because 42 is not callable. The catch block handles it and falls back to
    // treating the factory as a sync component.
    expect(() => normalizeStepLoader(factory)).not.toThrow();
    expect(normalizeStepLoader(factory)).toBe(factory);
  });

  // ---- arrow function vs named function component ----

  it("wraps an arrow function that returns a Promise with React.lazy", () => {
    const arrowFactory = () => Promise.resolve({ default: SyncComponent });
    const result = normalizeStepLoader(arrowFactory);
    expect(result).toHaveProperty("$$typeof");
    expect(result).not.toBe(arrowFactory);
  });

  it("falls back to sync component for an arrow function that returns JSX (null)", () => {
    // Arrow functions that look like components (return non-Promise)
    const arrowComponent = () => null as unknown as Promise<ComponentType>;
    const result = normalizeStepLoader(arrowComponent);
    // null is not a thenable, so it is treated as sync
    expect(result).toBe(arrowComponent);
  });

  // ---- idempotency check ----

  it("wrapping the result of normalizeStepLoader again does not double-wrap lazy", () => {
    const factory = () => Promise.resolve({ default: SyncComponent });
    const firstResult = normalizeStepLoader(factory);
    // firstResult has $$typeof so it's not a function... actually lazy() returns
    // an object, not a function, so the second call returns it as-is.
    const secondResult = normalizeStepLoader(firstResult);
    expect(secondResult).toBe(firstResult);
  });
});
