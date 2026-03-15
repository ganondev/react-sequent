/**
 * Internal flow context — implementation detail.
 * Consumers never interact with this directly.
 */
import { createContext } from "react";

// biome-ignore lint/complexity/noBannedTypes: stub — will be replaced with real shape during implementation
export type FlowContextValue = {};

export const FlowContext = createContext<FlowContextValue | null>(null);
