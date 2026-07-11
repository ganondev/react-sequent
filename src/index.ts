// react-sequent — public API

/** @deprecated Use the base hooks directly with manual type annotations instead. */
export {
  defineSequentFlow,
  type SequentFlowDefinition,
  type TypedUseContextReturn,
  type TypedUseFlowReturn,
  type TypedUseStepReturn,
} from "./defineSequentFlow";
export type { SequentContextReturn } from "./hooks/useSequentContext";
export { useSequentContext } from "./hooks/useSequentContext";
export type {
  SequentOutletProps,
  SequentResult,
  UseSequentFlowReturn,
} from "./hooks/useSequentFlow";
export { useSequentFlow } from "./hooks/useSequentFlow";
export { useSequentStep } from "./hooks/useSequentStep";
export type { ErrorStepContext } from "./internal/FlowErrorBoundary";
export type { StepLoader } from "./internal/normalizer";
