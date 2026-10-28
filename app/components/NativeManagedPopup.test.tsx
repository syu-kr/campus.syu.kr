import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NativeManagedPopup } from "./NativeManagedPopup";

const now = Date.parse("2026-10-28T08:00:00Z");
const defaultProps = { title: "운영 안내", ready: true, storageKey: "campus-banner:sample:1", startsAt: null, endsAt: null, onClose: vi.fn() };
const children = <><p>안내 본문</p><div className="m3-managed-popup-actions"><button data-popup-action="today">오늘 그만 보기</button><button data-popup-action="close">닫기</button></div></>;
const showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute("open", ""); });
const close = vi.fn(function (this: HTMLDialogElement) { this.removeAttribute("open"); });

const originalDialogMethods = Object.fromEntries(["showModal", "close"].map(name => [name, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name)]));
beforeEach(() => {
  vi.useFakeTimers();vi.setSystemTime(now);defaultProps.onClose.mockClear();showModal.mockClear();close.mockClear();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: showModal });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: close });
});
afterEach(() => {
  cleanup();vi.useRealTimers();vi.restoreAllMocks();
  for (const [name, descriptor] of Object.entries(originalDialogMethods)) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});

it("server-renders a closed labeled dialog and adjacent nonce bootstrap without exposing it unconditionally", () => {
  const html = renderToStaticMarkup(<NativeManagedPopup {...defaultProps} ready={false} nonce="request-nonce" startsAt={new Date(now - 1000).toISOString()} endsAt={new Date(now + 1000).toISOString()}>{children}</NativeManagedPopup>);
  const document = new DOMParser().parseFromString(html, "text/html");
  const dialog = document.querySelector("dialog")!;
  expect(dialog.hasAttribute("open")).toBe(false);
  expect(dialog.dataset.managedPopup).toBe(defaultProps.storageKey);
  expect(dialog.dataset.startsAt).toBe(String(now - 1000));expect(dialog.dataset.endsAt).toBe(String(now + 1000));
  expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent).toBe(defaultProps.title);
  expect(dialog.nextElementSibling?.tagName).toBe("SCRIPT");
  expect(dialog.nextElementSibling?.getAttribute("nonce")).toBe("request-nonce");
});

it("waits for ready before React opens the native dialog, focuses close and cleans up on unmount", () => {
  const view = render(<NativeManagedPopup {...defaultProps} ready={false}>{children}</NativeManagedPopup>);
  const dialog = view.container.querySelector("dialog")!;
  expect(showModal).not.toHaveBeenCalled();
  const cleanup = vi.fn();Object.assign(dialog, { __campusPopupCleanup: cleanup });
  view.rerender(<NativeManagedPopup {...defaultProps}>{children}</NativeManagedPopup>);
  expect(cleanup).toHaveBeenCalledOnce();expect(dialog.dataset.hydrated).toBe("true");
  expect(showModal).toHaveBeenCalledOnce();expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();
  view.unmount();expect(close).toHaveBeenCalledOnce();
});

it("hands an already open popup to React without reopening it or moving a user's focus", () => {
  const view = render(<NativeManagedPopup {...defaultProps} ready={false}>{children}</NativeManagedPopup>);
  const dialog = view.container.querySelector("dialog")!;
  dialog.setAttribute("open", "");
  const today = screen.getByRole("button", { name: "오늘 그만 보기" });today.focus();
  view.rerender(<NativeManagedPopup {...defaultProps}>{children}</NativeManagedPopup>);
  expect(showModal).not.toHaveBeenCalled();expect(today).toHaveFocus();
});

it.each(["closed", String(now + 1000)])("does not reopen an early dismissal marker %s after hydration", marker => {
  const view = render(<NativeManagedPopup {...defaultProps} ready={false}>{children}</NativeManagedPopup>);
  const dialog = view.container.querySelector("dialog")!;dialog.dataset.dismissedUntil = marker;
  view.rerender(<NativeManagedPopup {...defaultProps}>{children}</NativeManagedPopup>);
  expect(showModal).not.toHaveBeenCalled();
});

it("allows a hide-today marker to expire instead of suppressing the next Korean day", () => {
  const view = render(<NativeManagedPopup {...defaultProps} ready={false}>{children}</NativeManagedPopup>);
  view.container.querySelector("dialog")!.dataset.dismissedUntil = String(now - 1);
  view.rerender(<NativeManagedPopup {...defaultProps}>{children}</NativeManagedPopup>);
  expect(showModal).toHaveBeenCalledOnce();
});

it.each([{ startsAt: new Date(now + 1000).toISOString() }, { endsAt: new Date(now).toISOString() }])("checks actual time at hydration for %o", boundary => {
  render(<NativeManagedPopup {...defaultProps} {...boundary}>{children}</NativeManagedPopup>);
  expect(showModal).not.toHaveBeenCalled();
});

it("uses native cancel and backdrop clicks while leaving content clicks alone", () => {
  const view = render(<NativeManagedPopup {...defaultProps}>{children}</NativeManagedPopup>);
  const dialog = view.container.querySelector("dialog")!;
  fireEvent.click(screen.getByText("안내 본문"));expect(defaultProps.onClose).not.toHaveBeenCalled();
  fireEvent.click(dialog);expect(defaultProps.onClose).toHaveBeenCalledOnce();
  const cancel = new Event("cancel", { bubbles: false, cancelable: true });
  act(() => dialog.dispatchEvent(cancel));expect(cancel.defaultPrevented).toBe(true);expect(defaultProps.onClose).toHaveBeenCalledTimes(2);
});

it("falls back to the existing modal when showModal is unavailable and keeps its focus/scroll contract", () => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: undefined });
  const view = render(<NativeManagedPopup {...defaultProps}>{children}</NativeManagedPopup>);
  expect(view.container.querySelector("dialog")).toBeNull();
  expect(screen.getByRole("dialog", { name: defaultProps.title })).toHaveAttribute("aria-modal", "true");
  expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();expect(document.body.style.overflow).toBe("hidden");
  fireEvent.keyDown(document, { key: "Escape" });expect(defaultProps.onClose).toHaveBeenCalledOnce();
  view.unmount();
});

it("defers to another open dialog at ready handoff without stealing focus", () => {
  render(<div role="dialog" aria-modal="true"><input aria-label="작성 중" /></div>);
  const input = screen.getByRole("textbox", { name: "작성 중" });input.focus();
  render(<NativeManagedPopup {...defaultProps}>{children}</NativeManagedPopup>);
  expect(showModal).not.toHaveBeenCalled();expect(input).toHaveFocus();
});

it("recovers a native showModal failure through the existing modal instead of failing the page", () => {
  showModal.mockImplementationOnce(() => { throw new DOMException("Document is not active", "InvalidStateError"); });
  const view = render(<NativeManagedPopup {...defaultProps}>{children}</NativeManagedPopup>);
  expect(view.container.querySelector("dialog")).toBeNull();
  expect(screen.getByRole("dialog", { name: defaultProps.title })).toBeVisible();
  expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();
});
it("preserves the existing first/last Tab cycle after handoff instead of leaving to browser chrome", () => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  const view = render(<NativeManagedPopup {...defaultProps}>{children}</NativeManagedPopup>);
  const first = screen.getByRole("button", { name: "오늘 그만 보기" }), last = screen.getByRole("button", { name: "닫기" });
  fireEvent.keyDown(last, { key: "Tab" });expect(first).toHaveFocus();
  fireEvent.keyDown(first, { key: "Tab", shiftKey: true });expect(last).toHaveFocus();
  const outside = document.createElement("button");document.body.append(outside);outside.focus();
  fireEvent.keyDown(view.container.querySelector("dialog")!, { key: "Tab" });expect(first).toHaveFocus();
  outside.focus();fireEvent.keyDown(view.container.querySelector("dialog")!, { key: "Tab", shiftKey: true });expect(last).toHaveFocus();outside.remove();
});

it("focuses the dialog when no visible controls are available", () => {
  const view = render(<NativeManagedPopup {...defaultProps}><p>Only content</p><button disabled>Unavailable</button></NativeManagedPopup>);
  const dialog = view.container.querySelector("dialog")!;
  const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
  fireEvent(dialog, event);expect(event.defaultPrevented).toBe(true);expect(dialog).toHaveFocus();
});

it("keeps prehydration keyboard ownership and respects a previously prevented Tab event", () => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  const view = render(<NativeManagedPopup {...defaultProps} ready={false}>{children}</NativeManagedPopup>);
  const last = view.container.querySelector<HTMLButtonElement>('button[data-popup-action="close"]')!;
  const early = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
  fireEvent(last, early);expect(early.defaultPrevented).toBe(false);
  view.rerender(<NativeManagedPopup {...defaultProps}>{children}</NativeManagedPopup>);
  const prevented = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });prevented.preventDefault();
  fireEvent(last, prevented);expect(last).toHaveFocus();
});
