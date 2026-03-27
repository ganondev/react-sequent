/**
 * Internal flow contexts — implementation detail.
 * Consumers never interact with these directly.
 *
 * Two nested contexts enforce hook compartmentalization:
 *
 *   FlowContext (outer) — available to chrome components and idle children.
 *     Read by useSequentContext().
 *
 *   StepContext (inner) — only injected around the active step's subtree.
 *     Read by useSequentStep(). Absent outside that subtree so misuse throws eagerly.
 */
import { createContext } from "react";
import type { StepLoader } from "./normalizer";

/**
 * Outer context — wraps everything inside the outlet (idle children, chrome,
 * and the step slot). Provides flow-level access: consumer context, resolve,
 * and abort.
 */
export interface FlowContextValue<TResult = unknown> {
  /** Opaque consumer-owned context value carried through the flow. */
  consumerContext: unknown;
  /** Call when the flow completes successfully. */
  resolve: (value?: TResult) => void;
  /** Call when the flow exits without completing. */
  abort: (reason?: unknown) => void;
}

/**
 * Inner context — only present inside the active step's subtree (inside the
 * Suspense + error boundary wrapper). Provides step-only capabilities:
 * navigation functions and termination callbacks.
 */
export interface StepContextValue<TResult = unknown> {
  /** Push the current step to history and render the next step. */
  advance: (nextStep: StepLoader, contextPatch?: unknown) => void;
  /** Pop the last step from history and render it. */
  retreat: () => void;
  /** Call when the flow completes successfully. */
  resolve: (value?: TResult) => void;
  /** Call when the flow exits without completing. */
  abort: (reason?: unknown) => void;
  /** Opaque consumer-owned context value carried through the flow. */
  consumerContext: unknown;
}

export const FlowContext = createContext<FlowContextValue | null>(null);
export const StepContext = createContext<StepContextValue | null>(null);
