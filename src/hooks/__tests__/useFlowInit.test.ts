import { describe, expect, it } from "vitest";
import { useFlowInit } from "../useFlowInit";

describe("useFlowInit", () => {
  it("should be a function", () => {
    expect(typeof useFlowInit).toBe("function");
  });

  // TODO: add hook-level unit tests once implementation exists
});
