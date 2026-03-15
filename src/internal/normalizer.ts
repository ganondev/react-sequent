/**
 * Normalizes step loaders so consumers can pass:
 * - A component directly (sync)
 * - () => import('./MyStep') (async, returns { default: Component })
 * - () => Promise<Component> (async, returns component directly)
 *
 * The output is always a React.lazy-compatible factory.
 */
export function normalizeStepLoader(
  _loader: unknown,
): React.LazyExoticComponent<React.ComponentType> {
  // TODO: implement
  throw new Error("normalizeStepLoader is not yet implemented");
}
