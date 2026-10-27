import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PaginationControls } from "./PaginationControls";

it("shows the actual current page in the page selector", () => {
  const onPageChange = vi.fn();
  const { rerender } = render(
    <PaginationControls currentPage={1} totalPages={20} onPageChange={onPageChange} />,
  );
  expect(screen.getByRole("combobox")).toHaveTextContent(/^1$/);

  rerender(<PaginationControls currentPage={10} totalPages={20} onPageChange={onPageChange} />);
  expect(screen.getByRole("combobox")).toHaveTextContent(/^10$/);

  rerender(<PaginationControls currentPage={20} totalPages={20} onPageChange={onPageChange} />);
  expect(screen.getByRole("button", { name: "20" })).toHaveAttribute("aria-current", "page");
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
});

it.each([1, 10])("preserves the original jump options and reports the selected page from %i", async (currentPage) => {
  const onPageChange = vi.fn();
  render(<PaginationControls currentPage={currentPage} totalPages={20} onPageChange={onPageChange} />);
  const trigger = screen.getByRole("combobox", { name: "페이지 선택" });
  fireEvent.click(trigger);
  const options = await screen.findAllByRole("option");
  const endPage = currentPage === 1 ? 5 : 12;
  expect(options.map((option) => option.textContent)).toEqual([
    String(currentPage), ...Array.from({ length: 20 - endPage }, (_, index) => String(endPage + index + 1)),
  ]);
  expect(options[0]).toHaveAttribute("aria-selected", "true");
  const last = options.at(-1)!;
  fireEvent.pointerDown(last);
  fireEvent.click(last);
  expect(onPageChange).toHaveBeenCalledExactlyOnceWith(20);
});

it("keeps its hook order when pagination appears and restores focus after Escape", async () => {
  const onPageChange = vi.fn();
  const { rerender } = render(<PaginationControls currentPage={1} totalPages={1} onPageChange={onPageChange} />);
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  rerender(<PaginationControls currentPage={1} totalPages={531} onPageChange={onPageChange} />);
  const trigger = screen.getByRole("combobox", { name: "페이지 선택" });
  expect(trigger.querySelector(".m3-select-leading")).toHaveAttribute("aria-hidden", "true");
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  const options = await screen.findAllByRole("option");
  expect(options).toHaveLength(527);
  fireEvent.keyDown(options[0], { key: "Escape" });
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(onPageChange).not.toHaveBeenCalled();
  rerender(<PaginationControls currentPage={1} totalPages={1} onPageChange={onPageChange} />);
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
});

it("exposes crawlable page URLs and preserves modified-click navigation", () => {
  const onPageChange = vi.fn();
  render(<PaginationControls currentPage={1} totalPages={4} onPageChange={onPageChange} getPageHref={(page) => `/announcements?page=${page}&lang=en`} />);
  const link = screen.getByRole("link", { name: "2" });
  expect(link).toHaveAttribute("href", "/announcements?page=2&lang=en");
  expect(fireEvent.click(link, { ctrlKey: true })).toBe(true);
  expect(onPageChange).not.toHaveBeenCalled();
  expect(fireEvent.click(link)).toBe(false);
  expect(onPageChange).toHaveBeenCalledWith(2);
});
