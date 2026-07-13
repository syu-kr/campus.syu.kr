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
});
