import type { ReactNode } from "react";
import type { TransitionSlotProps } from "../components/FlowOutlet";
import { cssVars, transitionKeyframes } from "./styles";

export type { TransitionSlotProps } from "../components/FlowOutlet";

/** Shared default animation values. */
const DEFAULT_DURATION_MS = 300;
const DEFAULT_EASING = "ease";
const DEFAULT_SLIDE_DISTANCE_PX = 24;

export interface CrossfadeOptions {
  /** Animation duration in milliseconds. Default: 300. */
  duration?: number;
  /** CSS timing function. Default: "ease". */
  easing?: string;
}

export interface SlideOptions extends CrossfadeOptions {
  /** Fade the outgoing/incoming step while it slides.
   *  Default: false — a plain full-opacity slide. */
  fade?: boolean;
  /** Horizontal slide distance in px. Default: 24. */
  distance?: number;
}

/**
 * Creates a crossfade transition: the outgoing step fades out while the
 * incoming step fades in on top of it.
 *
 * Assign the result to a module-level constant and pass it to
 * `SequentOutlet`'s `transition` prop, e.g. `const transition = crossfade();`.
 */
export function crossfade(
  options: CrossfadeOptions = {},
): (props: TransitionSlotProps) => ReactNode {
  const duration = options.duration ?? DEFAULT_DURATION_MS;
  const easing = options.easing ?? DEFAULT_EASING;

  return (props: TransitionSlotProps): ReactNode => {
    const { previousStep, nextStep, phase, onExited, transitionKey } = props;

    if (phase === "exited") return nextStep;

    return (
      <div style={{ position: "relative" }}>
        <style>{transitionKeyframes}</style>
        <div
          key={`exit-${transitionKey}`}
          style={{
            position: "absolute",
            inset: 0,
            // Match the container's padding so the outgoing step keeps the
            // exact geometry of the in-flow incoming step while fading out.
            padding: "inherit",
            animation: `rs-crossfade-out ${duration}ms ${easing} forwards`,
          }}
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) onExited();
          }}
        >
          {previousStep}
        </div>
        <div
          key={`enter-${transitionKey}`}
          style={{ animation: `rs-crossfade-in ${duration}ms ${easing}` }}
        >
          {nextStep}
        </div>
      </div>
    );
  };
}

/**
 * Creates a sequential slide transition: the outgoing step slides out to the
 * left, then the incoming step slides in from the right.
 *
 * Assign the result to a module-level constant and pass it to
 * `SequentOutlet`'s `transition` prop, e.g. `const transition = slide({ fade: true });`.
 */
export function slide(options: SlideOptions = {}): (props: TransitionSlotProps) => ReactNode {
  const duration = options.duration ?? DEFAULT_DURATION_MS;
  const easing = options.easing ?? DEFAULT_EASING;
  const distance = options.distance ?? DEFAULT_SLIDE_DISTANCE_PX;
  const fade = options.fade ?? false;

  const distanceVars = { "--rs-distance": `${distance}px` };
  const exitVars = cssVars(fade ? { ...distanceVars, "--rs-to-opacity": 0 } : distanceVars);
  const enterVars = cssVars(fade ? { ...distanceVars, "--rs-from-opacity": 0 } : distanceVars);

  return (props: TransitionSlotProps): ReactNode => {
    const { previousStep, nextStep, onExited, transitionKey } = props;

    return (
      <div style={{ position: "relative", overflow: "hidden" }}>
        <style>{transitionKeyframes}</style>
        {previousStep !== null && (
          <div
            key={`exit-${transitionKey}`}
            style={{
              ...exitVars,
              animation: `rs-slide-out-left ${duration}ms ${easing} forwards`,
            }}
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget) onExited();
            }}
          >
            {previousStep}
          </div>
        )}
        {previousStep === null && (
          <div
            key={`enter-${transitionKey}`}
            style={{
              ...enterVars,
              animation: `rs-slide-in-right ${duration}ms ${easing}`,
            }}
          >
            {nextStep}
          </div>
        )}
      </div>
    );
  };
}
