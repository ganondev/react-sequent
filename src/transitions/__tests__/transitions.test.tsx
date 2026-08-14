import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { type CSSProperties, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TransitionSlotProps } from "../../components/FlowOutlet";
import type { SequentOutletProps } from "../../hooks/useSequentFlow";
import { crossfade, slide } from "../index";
import { transitionKeyframes } from "../styles";

// ── Test helpers ─────────────────────────────────────────────────────

function makeProps(overrides: Partial<TransitionSlotProps> = {}): TransitionSlotProps {
  return {
    previousStep: null,
    nextStep: <div>next</div>,
    phase: "exited",
    onExited: () => {},
    transitionKey: 1,
    ...overrides,
  };
}

/** Returns the element children of a rendered ReactNode, filtering non-elements. */
function elementChildren(node: ReactNode): ReactElement[] {
  if (!isValidElement(node)) return [];
  const children = (node.props as { children?: ReactNode }).children;
  if (children === null || children === undefined) return [];
  const list = Array.isArray(children) ? children : [children];
  return list.filter((item): item is ReactElement => isValidElement(item));
}

function styleOf(element: ReactElement): CSSProperties {
  return (element.props as { style: CSSProperties }).style;
}

/** Renders factory output (typed ReactNode, always an element in tests). */
function renderNode(node: ReactNode): ReturnType<typeof render> {
  return render(node as ReactElement);
}

/**
 * Dispatches an animationend event that reaches React's synthetic
 * `onAnimationEnd` handler.
 *
 * jsdom has no native `AnimationEvent`, so React registers a vendor-prefixed
 * event name (`webkitAnimationEnd`), and jsdom matches listener names
 * case-sensitively. Mirroring React's own prefix resolution keeps this test
 * correct across jsdom versions.
 */
function fireAnimationEnd(target: Element): void {
  const style = document.createElement("div").style;
  const eventName =
    "AnimationEvent" in window
      ? "animationend"
      : "WebkitAnimation" in style
        ? "webkitAnimationEnd"
        : "MozAnimation" in style
          ? "mozAnimationEnd"
          : "animationend";
  target.dispatchEvent(new window.Event(eventName, { bubbles: true }));
}

// ── crossfade ────────────────────────────────────────────────────────

describe("crossfade", () => {
  afterEach(() => {
    cleanup();
  });

  it("passes nextStep through bare when phase is exited", () => {
    const nextStep = <div>next</div>;
    const output = crossfade()(makeProps({ nextStep, phase: "exited" }));
    expect(output).toBe(nextStep);
  });

  it("renders both wrappers in a relative container during exiting", () => {
    const output = crossfade()(
      makeProps({
        previousStep: <div>prev</div>,
        nextStep: <div>next</div>,
        phase: "exiting",
        transitionKey: 42,
      }),
    );
    const { container } = renderNode(output);

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.position).toBe("relative");

    const styleTag = wrapper.querySelector("style");
    expect(styleTag?.textContent).toBe(transitionKeyframes);

    const children = elementChildren(output);
    expect(children).toHaveLength(3); // <style>, exit wrapper, enter wrapper
    expect(children[1].key).toBe("exit-42");
    expect(styleOf(children[1]).position).toBe("absolute");
    expect(styleOf(children[1]).animation).toBe("rs-crossfade-out 300ms ease forwards");
    expect(children[2].key).toBe("enter-42");
    expect(styleOf(children[2]).animation).toBe("rs-crossfade-in 300ms ease");
  });

  it("renders an empty exit wrapper during entering", () => {
    const output = crossfade()(makeProps({ previousStep: null, phase: "entering" }));
    const children = elementChildren(output);
    expect(children).toHaveLength(3);
    expect(children[1].key).toBe("exit-1");
    expect(children[2].key).toBe("enter-1");
  });

  it("uses duration and easing options in the animation shorthand", () => {
    const output = crossfade({ duration: 500, easing: "ease-in" })(
      makeProps({ previousStep: <div>prev</div>, phase: "exiting" }),
    );
    const children = elementChildren(output);
    expect(styleOf(children[1]).animation).toBe("rs-crossfade-out 500ms ease-in forwards");
    expect(styleOf(children[2]).animation).toBe("rs-crossfade-in 500ms ease-in");
  });

  it("keeps keyframe text constant regardless of options", () => {
    const output = crossfade({ duration: 999 })(
      makeProps({ previousStep: <div>prev</div>, phase: "exiting" }),
    );
    const children = elementChildren(output);
    expect((children[0].props as { children: string }).children).toBe(transitionKeyframes);
    expect(transitionKeyframes).not.toContain("999");
  });

  it("calls onExited only when the animation ends on the wrapper itself", () => {
    const onExited = vi.fn();
    const output = crossfade()(
      makeProps({
        previousStep: (
          <div>
            <span data-testid="nested-animation">nested</span>
          </div>
        ),
        phase: "exiting",
        onExited,
      }),
    );
    const { container } = renderNode(output);

    const wrapper = container.firstElementChild as HTMLElement;
    const exitWrapper = wrapper.children[1] as HTMLElement;

    fireAnimationEnd(screen.getByTestId("nested-animation"));
    expect(onExited).not.toHaveBeenCalled();

    fireAnimationEnd(exitWrapper);
    expect(onExited).toHaveBeenCalledTimes(1);
  });

  it("returns a fresh function per factory call", () => {
    expect(crossfade()).not.toBe(crossfade());
  });
});

// ── slide ────────────────────────────────────────────────────────────

describe("slide", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders only the exit wrapper while previousStep is present", () => {
    const output = slide()(
      makeProps({ previousStep: <div>prev</div>, phase: "exiting", transitionKey: 7 }),
    );
    const { container } = renderNode(output);

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.position).toBe("relative");
    expect(wrapper.style.overflow).toBe("hidden");
    expect(wrapper.querySelector("style")?.textContent).toBe(transitionKeyframes);

    const children = elementChildren(output);
    expect(children).toHaveLength(2); // <style>, exit wrapper
    expect(children[1].key).toBe("exit-7");
    expect(styleOf(children[1]).animation).toBe("rs-slide-out-left 300ms ease forwards");
  });

  it("renders only the enter wrapper once previousStep is gone and keeps it through exited", () => {
    for (const phase of ["entering", "exited"] as const) {
      const output = slide()(makeProps({ previousStep: null, phase, transitionKey: 7 }));
      const children = elementChildren(output);
      expect(children).toHaveLength(2); // <style>, enter wrapper
      expect(children[1].key).toBe("enter-7");
      expect(styleOf(children[1]).animation).toBe("rs-slide-in-right 300ms ease");
    }
  });

  it("uses duration and easing options in the animation shorthand", () => {
    const output = slide({ duration: 400, easing: "linear" })(
      makeProps({ previousStep: <div>prev</div>, phase: "exiting" }),
    );
    const children = elementChildren(output);
    expect(styleOf(children[1]).animation).toBe("rs-slide-out-left 400ms linear forwards");
  });

  it("sets --rs-distance on the exit wrapper (default 24px)", () => {
    const output = slide()(makeProps({ previousStep: <div>prev</div>, phase: "exiting" }));
    const { container } = renderNode(output);
    const wrapper = container.firstElementChild as HTMLElement;
    const exitWrapper = wrapper.children[1] as HTMLElement;
    expect(exitWrapper.style.getPropertyValue("--rs-distance")).toBe("24px");
  });

  it("sets --rs-distance from the distance option on the enter wrapper", () => {
    const output = slide({ distance: 48 })(makeProps({ previousStep: null, phase: "entering" }));
    const { container } = renderNode(output);
    const wrapper = container.firstElementChild as HTMLElement;
    const enterWrapper = wrapper.children[1] as HTMLElement;
    expect(enterWrapper.style.getPropertyValue("--rs-distance")).toBe("48px");
  });

  it("leaves opacity custom properties unset by default", () => {
    const output = slide()(makeProps({ previousStep: <div>prev</div>, phase: "exiting" }));
    const { container } = renderNode(output);
    const wrapper = container.firstElementChild as HTMLElement;
    const exitWrapper = wrapper.children[1] as HTMLElement;
    expect(exitWrapper.style.getPropertyValue("--rs-to-opacity")).toBe("");
    expect(exitWrapper.style.getPropertyValue("--rs-from-opacity")).toBe("");
  });

  it("fades out the exit wrapper when fade is enabled", () => {
    const output = slide({ fade: true })(
      makeProps({ previousStep: <div>prev</div>, phase: "exiting" }),
    );
    const { container } = renderNode(output);
    const wrapper = container.firstElementChild as HTMLElement;
    const exitWrapper = wrapper.children[1] as HTMLElement;
    expect(exitWrapper.style.getPropertyValue("--rs-to-opacity")).toBe("0");
    expect(exitWrapper.style.getPropertyValue("--rs-from-opacity")).toBe("");
  });

  it("fades in the enter wrapper when fade is enabled", () => {
    const output = slide({ fade: true })(makeProps({ previousStep: null, phase: "entering" }));
    const { container } = renderNode(output);
    const wrapper = container.firstElementChild as HTMLElement;
    const enterWrapper = wrapper.children[1] as HTMLElement;
    expect(enterWrapper.style.getPropertyValue("--rs-from-opacity")).toBe("0");
    expect(enterWrapper.style.getPropertyValue("--rs-to-opacity")).toBe("");
  });

  it("calls onExited only when the animation ends on the exit wrapper itself", () => {
    const onExited = vi.fn();
    const output = slide()(
      makeProps({
        previousStep: (
          <div>
            <span data-testid="nested-animation">nested</span>
          </div>
        ),
        phase: "exiting",
        onExited,
      }),
    );
    const { container } = renderNode(output);

    const wrapper = container.firstElementChild as HTMLElement;
    const exitWrapper = wrapper.children[1] as HTMLElement;

    fireAnimationEnd(screen.getByTestId("nested-animation"));
    expect(onExited).not.toHaveBeenCalled();

    fireAnimationEnd(exitWrapper);
    expect(onExited).toHaveBeenCalledTimes(1);
  });

  it("returns a fresh function per factory call", () => {
    expect(slide()).not.toBe(slide());
  });
});

// ── Type compatibility ───────────────────────────────────────────────

describe("type compatibility", () => {
  it("is assignable to SequentOutlet's transition prop", () => {
    const crossfadeTransition: SequentOutletProps["transition"] = crossfade();
    const slideTransition: SequentOutletProps["transition"] = slide();
    expect(typeof crossfadeTransition).toBe("function");
    expect(typeof slideTransition).toBe("function");
  });
});
