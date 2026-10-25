import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import SearchDialog from "./SearchDialog";
import { getDictionary } from "@/lib/i18n";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
beforeEach(() => { navigation.push.mockClear(); window.history.replaceState(null, "", "/"); });
it("keeps the dialog named and supports input focus, Escape and outside dismissal without a close button", async () => {
  const onClose = vi.fn(), dictionary = getDictionary("ko");
  render(<SearchDialog onClose={onClose} />);
  expect(screen.getByRole("dialog", { name: dictionary.search.label })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("textbox", { name: dictionary.search.label })).toHaveFocus());
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalledOnce();
  onClose.mockClear();
  expect(screen.queryByRole("button", { name: dictionary.labels.closeModal })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("dialog", { name: dictionary.search.label }));
  expect(onClose).toHaveBeenCalledOnce();
});
it("offers menu links while typing and searches only after submission", () => {
  const onClose = vi.fn();
  render(<SearchDialog onClose={onClose} />);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "시간" } });
  expect(screen.getByRole("link", { name: /시간표/ })).toHaveAttribute("href", "/academic/timetable");
  expect(navigation.push).not.toHaveBeenCalled();
  fireEvent.submit(screen.getByRole("search"));
  expect(navigation.push).toHaveBeenCalledExactlyOnceWith("/?search=%EC%8B%9C%EA%B0%84");
  expect(onClose).toHaveBeenCalledOnce();
});
it("closes for a quick link, including the current page, while preserving modified clicks", () => {
  const onClose = vi.fn();
  render(<SearchDialog onClose={onClose} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "졸업" } });
  const link = screen.getByRole("link", { name: /졸업요건/ });
  fireEvent.click(link, { ctrlKey: true });
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(link);
  expect(onClose).toHaveBeenCalledOnce();
  expect(navigation.push).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: getDictionary("ko").search.clear }));
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
