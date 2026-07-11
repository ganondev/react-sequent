/**
 * @deprecated `defineSequentFlow` is deprecated and will be removed in a future release.
 * The typing was weak, and in retrospect the strategy defeated the purpose of flow outlets being reusable.
 * Consumers should type context and results manually on the base hooks.
 */
import { type FunctionComponent, useCallback } from "react";
import { type SequentContextReturn, useSequentContext } from "./hooks/useSequentContext";
import {
  type SequentOutletProps,
  type SequentResult,
  useSequentFlow,
} from "./hooks/useSequentFlow";
import { useSequentStep } from "./hooks/useSequentStep";
import type { StepLoader } from "./internal/normalizer";

/** @deprecated Use the base hooks directly with manual type annotations instead. */
type InvalidTypedContextArgs<TContext extends object> = TContext extends readonly unknown[]
  ? [message: "Typed flow context must be a plain object."]
  : TContext extends (...args: never[]) => unknown
    ? [message: "Typed flow context must be a plain object."]
    : [];

/** @deprecated Use the base hooks directly with manual type annotations instead. */
export interface TypedUseFlowReturn<TContext extends object, TResult = unknown> {
  init: (stepLoader: StepLoader, initialContext: TContext) => void;
  status: "idle" | "active";
  result: SequentResult<TResult> | null;
  SequentOutlet: FunctionComponent<SequentOutletProps>;
}

/** @deprecated Use the base hooks directly with manual type annotations instead. */
export interface TypedUseStepReturn<TContext extends object, TResult = unknown> {
  advance: (nextStep: StepLoader, contextPatch?: Partial<TContext>) => void;
  retreat: () => void;
  resolve: (value?: TResult) => void;
  abort: (reason?: unknown) => void;
  context: TContext;
}

/** @deprecated Use the base hooks directly with manual type annotations instead. */
export interface TypedUseContextReturn<TContext extends object, TResult = unknown> {
  context: TContext | undefined;
  resolve: (value?: TResult) => void;
  abort: (reason?: unknown) => void;
}

/** @deprecated Use the base hooks directly with manual type annotations instead. */
export interface SequentFlowDefinition<TContext extends object, TResult = unknown> {
  useSequentFlow(): TypedUseFlowReturn<TContext, TResult>;
  useSequentStep(): TypedUseStepReturn<TContext, TResult>;
  useSequentContext(): TypedUseContextReturn<TContext, TResult>;
}

/** @deprecated Use the base hooks directly with manual type annotations instead. */
export function defineSequentFlow<
  TContext extends object = Record<string, never>,
  TResult = unknown,
>(..._invalidContext: InvalidTypedContextArgs<TContext>): SequentFlowDefinition<TContext, TResult> {
  return {
    useSequentFlow(): TypedUseFlowReturn<TContext, TResult> {
      const { init, status, result, SequentOutlet } = useSequentFlow<TResult>();

      const typedInit = useCallback(
        (stepLoader: StepLoader, initialContext: TContext) => init(stepLoader, initialContext),
        [init],
      );

      return {
        init: typedInit,
        status,
        result,
        SequentOutlet,
      };
    },

    useSequentStep(): TypedUseStepReturn<TContext, TResult> {
      const { advance, retreat, resolve, abort, context } = useSequentStep<TResult>();

      const typedAdvance = useCallback(
        (nextStep: StepLoader, contextPatch?: Partial<TContext>) => advance(nextStep, contextPatch),
        [advance],
      );

      return {
        advance: typedAdvance,
        retreat,
        resolve,
        abort,
        context: context as TContext,
      };
    },

    useSequentContext(): TypedUseContextReturn<TContext, TResult> {
      const { context, resolve, abort } = useSequentContext<
        TContext | undefined
      >() as SequentContextReturn<TContext | undefined>;

      return {
        context,
        resolve: resolve as (value?: TResult) => void,
        abort,
      };
    },
  };
}
