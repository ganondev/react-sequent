import { useContext } from "react";
import { FlowContext } from "../internal/context";

export function useFlowContext(): unknown {
  const ctx = useContext(FlowContext);
  if (ctx === null) {
    throw new Error("useFlowContext must be used within a <FlowOutlet /> provider boundary");
  }
  return ctx.consumerContext;
}
