import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { lookupSeat } from "@/lib/chapel-seats/lookup";
import { SeatMap } from "./SeatMap";

function setup(section = "na", number = "53") {
  const result = lookupSeat(section, number);
  if (result.status !== "found") throw new Error("Missing reviewed seat");
  render(<SeatMap selected={result.seat} />);
  const svg = screen.getByRole("img", { name: /좌석 위치/ });
  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 320, bottom: 288, width: 320, height: 288, toJSON: () => ({}),
  });
  const capture = vi.fn();
  Object.defineProperties(svg, {
    setPointerCapture: { configurable: true, value: capture },
    releasePointerCapture: { configurable: true, value: vi.fn() },
    hasPointerCapture: { configurable: true, value: () => true },
  });
  return { svg, capture };
}

function pointer(svg: HTMLElement, type: string, x: number, y: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
  Object.defineProperties(event, {
    pointerId: { value: 1 }, isPrimary: { value: true }, pointerType: { value: "mouse" },
  });
  fireEvent(svg, event);
}

function viewBox(svg: HTMLElement) {
  return svg.getAttribute("viewBox")!.split(" ").map(Number);
}

describe("chapel map movement", () => {
  it("leaves the complete map stationary so normal page scrolling is available", () => {
    const { svg, capture } = setup();
    pointer(svg, "pointerdown", 100, 100);
    pointer(svg, "pointermove", 140, 120);
    pointer(svg, "pointerup", 140, 120);
    expect(viewBox(svg)).toEqual([0, 0, 1000, 900]);
    expect(capture).not.toHaveBeenCalled();
  });

  it("moves with a scaled drag, stops after cancellation, and clamps at all map edges", () => {
    const { svg, capture } = setup();
    fireEvent.click(screen.getByRole("button", { name: "좌석 확대" }));
    expect(viewBox(svg)).toEqual([250, 214, 160, 144]);
    pointer(svg, "pointerdown", 100, 100);
    pointer(svg, "pointermove", 140, 120);
    expect(capture).toHaveBeenCalledWith(1);
    expect(viewBox(svg)).toEqual([230, 204, 160, 144]);
    pointer(svg, "pointercancel", 140, 120);
    pointer(svg, "pointermove", 200, 200);
    expect(viewBox(svg)).toEqual([230, 204, 160, 144]);

    pointer(svg, "pointerdown", 100, 100);
    pointer(svg, "pointermove", -100000, -100000);
    pointer(svg, "pointerup", -100000, -100000);
    expect(viewBox(svg)).toEqual([840, 756, 160, 144]);
    expect(screen.getByRole("button", { name: "지도 오른쪽으로 이동" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "지도 아래로 이동" })).toBeDisabled();

    pointer(svg, "pointerdown", 100, 100);
    pointer(svg, "pointermove", 100000, 100000);
    pointer(svg, "pointerup", 100000, 100000);
    expect(viewBox(svg)).toEqual([0, 0, 160, 144]);
    expect(screen.getByRole("button", { name: "지도 왼쪽으로 이동" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "지도 위로 이동" })).toBeDisabled();
  });

  it("provides button movement, preserves the viewed centre on zoom, and returns to the seat or full map", () => {
    const { svg } = setup();
    fireEvent.click(screen.getByRole("button", { name: "좌석 확대" }));
    fireEvent.click(screen.getByRole("button", { name: "지도 오른쪽으로 이동" }));
    fireEvent.click(screen.getByRole("button", { name: "지도 아래로 이동" }));
    expect(viewBox(svg)).toEqual([290, 250, 160, 144]);
    fireEvent.click(screen.getByRole("button", { name: "확대" }));
    expect(viewBox(svg)).toEqual([330, 286, 80, 72]);
    fireEvent.click(screen.getByRole("button", { name: "축소" }));
    expect(viewBox(svg)).toEqual([290, 250, 160, 144]);
    fireEvent.click(screen.getByRole("button", { name: "좌석 확대" }));
    expect(viewBox(svg)).toEqual([250, 214, 160, 144]);
    fireEvent.click(screen.getByRole("button", { name: "전체 보기" }));
    expect(viewBox(svg)).toEqual([0, 0, 1000, 900]);
    fireEvent.click(screen.getByRole("button", { name: "좌석 확대" }));
    expect(viewBox(svg)).toEqual([250, 214, 160, 144]);
  });

  it("moves the focused map with arrow keys without using a drag", () => {
    const { svg } = setup();
    fireEvent.click(screen.getByRole("button", { name: "좌석 확대" }));
    const viewport = screen.getByRole("group", { name: "지도 이동" });
    expect(viewport).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(viewport, { key: "ArrowRight" });
    fireEvent.keyDown(viewport, { key: "ArrowUp" });
    expect(viewBox(svg)).toEqual([290, 178, 160, 144]);
    fireEvent.keyDown(viewport, { key: "Enter" });
    expect(viewBox(svg)).toEqual([290, 178, 160, 144]);
  });

  it("aligns row labels with the seats in view after moving from a sloping outer block to the centre", () => {
    const { svg } = setup("ga", "361");
    fireEvent.click(screen.getByRole("button", { name: "좌석 확대" }));
    for (let step = 0; step < 5; step++) fireEvent.click(screen.getByRole("button", { name: "지도 오른쪽으로 이동" }));
    const [, y, , height] = viewBox(svg);
    const label = Array.from(svg.parentElement!.querySelectorAll('[aria-hidden="true"] span')).find((node) => node.textContent === "26") as HTMLElement;
    const centralSeat = lookupSeat("na", "338");
    expect(centralSeat.status).toBe("found");
    if (centralSeat.status === "found") expect(y + parseFloat(label.style.top) / 100 * height).toBeCloseTo(centralSeat.seat.y);
  });
});
