import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TimeRow } from "./availability-grid";

const slot = "2026-07-25T09:00:00+09:00";

function renderTimeRow(overrides: { selected?: boolean } = {}) {
  const onPointerDown = vi.fn();
  const onPointerEnter = vi.fn();
  const onToggle = vi.fn();

  render(
    <TimeRow
      time="09:00"
      dates={["2026-07-25"]}
      availability={new Set(overrides.selected ? [slot] : [])}
      participantBySlot={new Map()}
      selectableTitle="Selectable"
      selectedTitle="Selected"
      locale="en"
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onToggle={onToggle}
    />,
  );

  return { onPointerDown, onToggle };
}

describe("TimeRow", () => {
  it("announces the date, time, and selected state", () => {
    renderTimeRow({ selected: true });

    expect(
      screen.getByRole("button", {
        name: /Jul 25.*09:00, Selected/,
      }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles from a keyboard-generated click", () => {
    const { onToggle } = renderTimeRow();
    const button = screen.getByRole("button");

    fireEvent.click(button, { detail: 0 });

    expect(onToggle).toHaveBeenCalledWith(slot);
  });

  it("does not toggle twice after a pointer interaction", () => {
    const { onPointerDown, onToggle } = renderTimeRow();
    const button = screen.getByRole("button");

    fireEvent.pointerDown(button);
    fireEvent.click(button, { detail: 1 });

    expect(onPointerDown).toHaveBeenCalledOnce();
    expect(onToggle).not.toHaveBeenCalled();
  });
});
