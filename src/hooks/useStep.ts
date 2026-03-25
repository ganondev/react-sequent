import { useSequentStep } from "./useSequentStep";

export function useStep<TResult = unknown>() {
  return useSequentStep<TResult>();
}
