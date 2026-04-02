import { type FunctionComponent, useCallback } from "react";
import { type SequentContextReturn, useSequentContext } from "./hooks/useSequentContext";
import { type SequentOutletProps, useSequentFlow } from "./hooks/useSequentFlow";
import { useSequentStep } from "./hooks/useSequentStep";
import type { StepLoader } from "./internal/normalizer";

type InvalidTypedContextArgs<TContext extends object> = TContext extends readonly unknown[]
  ? [message: "Typed flow context must be a plain object."]
  : TContext extends (...args: never[]) => unknown
    ? [message: "Typed flow context must be a plain object."]
    : [];

export interface TypedUseFlowReturn<TContext extends object, TResult = unknown> {
  init: (stepLoader: StepLoader, initialContext: TContext) => Promise<TResult>;
  SequentOutlet: FunctionComponent<SequentOutletProps>;
}

export interface TypedUseStepReturn<TContext extends object, TResult = unknown> {
  advance: (nextStep: StepLoader, contextPatch?: Partial<TContext>) => void;
  retreat: () => void;
  resolve: (value?: TResult) => void;
  abort: (reason?: unknown) => void;
  context: TContext;
}

export interface TypedUseContextReturn<TContext extends object, TResult = unknown> {
  context: TContext | undefined;
  resolve: (value?: TResult) => void;
  abort: (reason?: unknown) => void;
}

export interface SequentFlowDefinition<TContext extends object, TResult = unknown> {
  useSequentFlow(): TypedUseFlowReturn<TContext, TResult>;
  useSequentStep(): TypedUseStepReturn<TContext, TResult>;
  useSequentContext(): TypedUseContextReturn<TContext, TResult>;
}

export function defineSequentFlow<
  TContext extends object = Record<string, never>,
  TResult = unknown,
>(..._invalidContext: InvalidTypedContextArgs<TContext>): SequentFlowDefinition<TContext, TResult> {
  return {
    useSequentFlow(): TypedUseFlowReturn<TContext, TResult> {
      const { init, SequentOutlet } = useSequentFlow<TResult>();

      const typedInit = useCallback(
        (stepLoader: StepLoader, initialContext: TContext) => init(stepLoader, initialContext),
        [init],
      );

      return {
        init: typedInit,
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
