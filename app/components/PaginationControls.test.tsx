import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PaginationControls } from "./PaginationControls";

it("shows the actual current page in the page selector", () => {
  const onPageChange = vi.fn();
  const { rerender } = render(
    <PaginationControls currentPage={1} totalPages={20} onPageChange={onPageChange} />,
  );
  expect(screen.getByRole("combobox")).toHaveValue("1");

  rerender(<PaginationControls currentPage={10} totalPages={20} onPageChange={onPageChange} />);
  expect(screen.getByRole("combobox")).toHaveValue("10");

  rerender(<PaginationControls currentPage={20} totalPages={20} onPageChange={onPageChange} />);
  expect(screen.getByRole("button", { name: "20" })).toHaveAttribute("aria-current", "page");
});
