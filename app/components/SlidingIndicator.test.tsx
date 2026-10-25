import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SlidingIndicator } from "./SlidingIndicator";

function Track({ value }: { value: string }) {
  return <div className="m3-selection-track"><SlidingIndicator value={value} />
    <span><button data-selection-value="first">First</button></span>
    <span><button data-selection-value="second">Second</button></span>
  </div>;
}

function layout(element: HTMLElement, values: Record<string, number | HTMLElement | null>) {
  Object.defineProperties(element, Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { configurable: true, value }])));
}

afterEach(() => vi.unstubAllGlobals());

describe("shared measured selection indicator", () => {
  it("adds nested offsets, keeps the same marker on selection, and preserves focus while scrolling", () => {
    const { container, rerender } = render(<Track value="first" />);
    const track = container.firstElementChild as HTMLElement;
    const marker = track.querySelector<HTMLElement>(".m3-sliding-indicator")!;
    const wrappers = track.querySelectorAll<HTMLElement>(":scope > span:not(.m3-sliding-indicator)");
    const [first, second] = track.querySelectorAll<HTMLButtonElement>("button");
    layout(wrappers[0], { offsetLeft: 8, offsetTop: 2, offsetParent: track });
    layout(wrappers[1], { offsetLeft: 80, offsetTop: 2, offsetParent: track });
    layout(first, { offsetLeft: 4, offsetTop: 3, offsetWidth: 48, offsetHeight: 48, offsetParent: wrappers[0] });
    layout(second, { offsetLeft: 6, offsetTop: 3, offsetWidth: 72, offsetHeight: 48, offsetParent: wrappers[1] });
    fireEvent(window, new Event("resize"));
    expect(marker.style.transform).toBe("translate(12px, 5px)");
    expect(marker).not.toHaveAttribute("data-animate");
    second.focus();
    rerender(<Track value="second" />);
    expect(track.querySelector(".m3-sliding-indicator")).toBe(marker);
    expect(marker.style.transform).toBe("translate(86px, 5px)");
    expect(marker.style.width).toBe("72px");
    expect(marker).toHaveAttribute("data-animate", "true");
    track.scrollLeft = 40;
    fireEvent(window, new Event("resize"));
    expect(marker.style.transform).toBe("translate(86px, 5px)");
    expect(second).toHaveFocus();
  });

  it("resets hidden or missing targets and places a newly visible marker without moving from its old position", () => {
    const { container, rerender } = render(<Track value="first" />);
    const track = container.firstElementChild as HTMLElement;
    const marker = track.querySelector<HTMLElement>(".m3-sliding-indicator")!;
    const first = track.querySelector<HTMLButtonElement>("button")!;
    expect(marker).not.toHaveAttribute("data-ready");
    layout(first, { offsetLeft: 10, offsetTop: 4, offsetWidth: 48, offsetHeight: 48, offsetParent: track });
    fireEvent(window, new Event("resize"));
    expect(marker).toHaveAttribute("data-ready", "true");
    layout(first, { offsetWidth: 0 });
    fireEvent(window, new Event("resize"));
    expect(marker).not.toHaveAttribute("data-ready");
    layout(first, { offsetWidth: 48 });
    fireEvent(window, new Event("resize"));
    expect(marker).not.toHaveAttribute("data-animate");
    rerender(<Track value="missing" />);
    expect(marker).not.toHaveAttribute("data-ready");
  });

  it("remeasures ResizeObserver changes and disconnects observers and resize listeners", () => {
    const disconnect = vi.fn();
    let notify: () => void = () => {};
    vi.stubGlobal("ResizeObserver", class { constructor(callback: () => void) { notify = callback; } observe() {} disconnect = disconnect; });
    const removeListener = vi.spyOn(window, "removeEventListener");
    const { container, unmount } = render(<Track value="first" />);
    const track = container.firstElementChild as HTMLElement;
    const first = track.querySelector<HTMLButtonElement>("button")!;
    layout(first, { offsetLeft: 24, offsetTop: 8, offsetWidth: 90, offsetHeight: 48, offsetParent: track });
    fireEvent(window, new Event("resize"));
    expect(track.querySelector<HTMLElement>(".m3-sliding-indicator")!.style.width).toBe("90px");
    layout(first, { offsetWidth: 108 });
    act(() => notify());
    expect(track.querySelector<HTMLElement>(".m3-sliding-indicator")!.style.width).toBe("108px");
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(removeListener).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(() => notify()).not.toThrow();
  });
});
