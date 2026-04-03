import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { normalizeStepLoader } from "../normalizer";

function SyncComponent() {
  return null;
}

function OtherComponent() {
  return null;
}

describe("normalizeStepLoader", () => {
  it("returns the sync component produced by a sync factory", () => {
    const loader = () => SyncComponent;
    const result = normalizeStepLoader(loader);
    expect(result).toBe(SyncComponent);
  });

  it("unwraps sync module-like return values", () => {
    const loader = () => ({ default: SyncComponent });
    const result = normalizeStepLoader(loader);
    expect(result).toBe(SyncComponent);
  });

  it("wraps sync element return values in a component", () => {
    const loader = () => createElement("div", null, "Element Step");
    const result = normalizeStepLoader(loader);

    render(createElement(result));

    expect(screen.getByText("Element Step")).toBeInTheDocument();
  });

  it("wraps async module factories with React.lazy", () => {
    const loader = () => Promise.resolve({ default: SyncComponent });
    const result = normalizeStepLoader(loader);
    expect(result).toHaveProperty("$$typeof");
    expect(result).not.toBe(loader);
  });

  it("wraps async component factories with React.lazy", () => {
    const loader = () => Promise.resolve(SyncComponent);
    const result = normalizeStepLoader(loader);
    expect(result).toHaveProperty("$$typeof");
    expect(result).not.toBe(loader);
  });

  it("wraps async element factories with React.lazy", () => {
    const loader = () => Promise.resolve(createElement("div", null, "Async Element Step"));
    const result = normalizeStepLoader(loader);
    expect(result).toHaveProperty("$$typeof");
    expect(result).not.toBe(loader);
  });

  it("invokes the loader exactly once per normalization", () => {
    const loader = vi.fn(() => OtherComponent);
    const result = normalizeStepLoader(loader);
    expect(result).toBe(OtherComponent);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("surfaces synchronous loader errors", () => {
    const loader = () => {
      throw new Error("boom");
    };
    expect(() => normalizeStepLoader(loader)).toThrowError("boom");
  });
});
