import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { M3Select } from "./M3Select";
import { Modal } from "./Modal";

describe("M3 Select focus recovery", () => {
  it.each([false, true])("returns Escape focus to its trigger with parent modal=%s", async (inModal) => {
    const onValueChange = vi.fn();
    const onClose = vi.fn();
    const field = <div><label id="department-label" htmlFor="department">학과</label><M3Select id="department" value="" onValueChange={onValueChange} options={[{ value: "", label: "전체 학과" }, { value: "computer", label: "컴퓨터공학부" }]} /></div>;
    render(inModal ? <Modal isOpen title="강의 추가" onClose={onClose}>{field}</Modal> : field);
    const trigger = screen.getByRole("combobox", { name: "학과" });
    act(() => trigger.focus());
    fireEvent.click(trigger);
    const listbox = await screen.findByRole("listbox");
    fireEvent.keyDown(listbox, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute("data-value", "");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    if (inModal) expect(screen.getByRole("dialog", { name: "강의 추가" })).toBeVisible();
  });
});
