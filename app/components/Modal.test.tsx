import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContactModal } from "./ContactModal";
import { CampusTipSuggestionForm } from "@/app/features/campus-tips/CampusTipSuggestionForm";
import { getDictionary } from "@/lib/i18n";
import { useState } from "react";
import { Modal } from "./Modal";

describe("Modal", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it.each(["contact", "campus-tip"])("unlocks scrolling and returns to the trigger when %s success closes both dialogs", async (formType) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ success: true })));
    const dictionary = getDictionary("ko");
    const text = formType === "contact" ? dictionary.pages.contactForm : dictionary.pages.campusTipsSuggest;
    function FormFlow() {
      const [open, setOpen] = useState(false);
      return <>
        <button onClick={() => setOpen(true)}>Open form</button>
        {formType === "contact"
          ? <ContactModal isOpen={open} onClose={() => setOpen(false)} />
          : <Modal isOpen={open} title="생활 정보 제안" onClose={() => setOpen(false)}>
              <CampusTipSuggestionForm onSuccessConfirm={() => setOpen(false)} />
            </Modal>}
      </>;
    }
    document.body.style.overflow = "auto";
    const { container } = render(<FormFlow />);
    const trigger = screen.getByRole("button", { name: "Open form" });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.change(container.querySelector(formType === "contact" ? "#inquiry-title" : "#tip-title")!, { target: { value: "제안 제목" } });
    fireEvent.change(container.querySelector(formType === "contact" ? "#inquiry-message" : "#tip-description")!, { target: { value: "제안 내용입니다." } });
    fireEvent.submit(container.querySelector("form")!);
    const result = await screen.findByRole("dialog", { name: text.successTitle });
    fireEvent.click(within(result).getByRole("button", { name: dictionary.submissionResult.confirm }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("auto");
    expect(trigger).toHaveFocus();
    document.body.style.overflow = "";
  });

  it.each(["contact", "campus-tip"])("confines keyboard handling to the %s result dialog and preserves its parent form", (formType) => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    const onParentClose = vi.fn();
    const dictionary = getDictionary("ko");
    const text = formType === "contact" ? dictionary.pages.contactForm : dictionary.pages.campusTipsSuggest;
    const { container } = render(formType === "contact"
      ? <ContactModal isOpen onClose={onParentClose} />
      : <Modal isOpen title="생활 정보 제안" onClose={onParentClose}><CampusTipSuggestionForm /></Modal>);
    const titleInput = container.querySelector<HTMLInputElement>(formType === "contact" ? "#inquiry-title" : "#tip-title")!;
    fireEvent.change(titleInput, { target: { value: "입력 중인 제목" } });
    fireEvent.submit(container.querySelector("form")!);
    const resultDialog = screen.getByRole("dialog", { name: text.validationTitle });
    const buttons = within(resultDialog).getAllByRole("button");
    buttons.at(-1)!.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(resultDialog).toContainElement(document.activeElement as HTMLElement);
    expect(buttons[0]).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(buttons.at(-1)).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: text.validationTitle })).not.toBeInTheDocument();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(onParentClose).not.toHaveBeenCalled();
    expect(titleInput).toHaveValue("입력 중인 제목");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onParentClose).toHaveBeenCalledOnce();
  });

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
