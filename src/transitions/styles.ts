import type { CSSProperties } from "react";

/**
 * Static keyframes shared by the transition factories.
 *
 * The text is constant — no option value ever appears in it. Options ride
 * inline CSS custom properties (`--rs-*`) and the `animation` shorthand on
 * each wrapper, so keyframe definitions can never leak across outlets or
 * flows.
 */
export const transitionKeyframes = `
@keyframes rs-crossfade-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}
@keyframes rs-crossfade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes rs-slide-out-left {
  from { opacity: var(--rs-from-opacity, 1); transform: translateX(0); }
  to   { opacity: var(--rs-to-opacity, 1); transform: translateX(calc(-1 * var(--rs-distance, 24px))); }
}
@keyframes rs-slide-in-right {
  from { opacity: var(--rs-from-opacity, 1); transform: translateX(var(--rs-distance, 24px)); }
  to   { opacity: var(--rs-to-opacity, 1); transform: translateX(0); }
}
`;

/**
 * Casts a CSS custom-property object for use as a React inline style.
 * React's `CSSProperties` does not model `--*` properties.
 */
export function cssVars(vars: Record<`--${string}`, string | number>): CSSProperties {
  return vars as CSSProperties;
}
