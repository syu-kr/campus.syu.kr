import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen title="Test dialog" onClose={onClose}>
        <button type="button">Action</button>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("restores focus after closing", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(
      <Modal isOpen title="Test dialog" onClose={() => undefined}>
        Content
      </Modal>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerender(
      <Modal isOpen={false} title="Test dialog" onClose={() => undefined}>
        Content
      </Modal>,
    );

    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it("keeps input focus across rerenders and uses the latest close callback", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const previousClose = vi.fn();
    const latestClose = vi.fn();
    const { rerender } = render(
      <Modal isOpen title="Search courses" onClose={previousClose}>
        <input aria-label="Course search" />
      </Modal>,
    );
    const input = screen.getByRole("textbox", { name: "Course search" });
    input.focus();
    fireEvent.change(input, { target: { value: "컴퓨터" } });

    rerender(
      <Modal isOpen title="Search courses" onClose={latestClose}>
        <input aria-label="Course search" />
      </Modal>,
    );

    expect(input).toHaveFocus();
    expect(input).toHaveValue("컴퓨터");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(latestClose).toHaveBeenCalledOnce();
    expect(previousClose).not.toHaveBeenCalled();

    rerender(
      <Modal isOpen={false} title="Search courses" onClose={latestClose}>
        <input aria-label="Course search" />
      </Modal>,
    );
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
