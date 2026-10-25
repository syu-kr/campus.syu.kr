import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { getDictionary } from "@/lib/i18n";
import type { CampusTip } from "@/types";
import CampusTipsPage from "./CampusTipsPageClient";

const state = vi.hoisted(() => ({ tips: [] as CampusTip[] }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: state.tips, isLoading: false, isError: false, refetch: vi.fn() }) }));
vi.mock("./CampusTipSuggestionForm", () => ({ CampusTipSuggestionForm: () => null }));

function tip(id: string, category: CampusTip["category"], contentKind: CampusTip["contentKind"]): CampusTip {
  return { id, title: id, description: "needle", category, contentKind, url: `https://example.test/${id}`, tags: [], sourceType: "official", isExternal: true };
}

beforeEach(() => {
  state.tips = [
    ...Array.from({ length: 13 }, (_, i) => tip(`school-${String(i + 1).padStart(2, "0")}`, "school", "official-link")),
    ...Array.from({ length: 13 }, (_, i) => tip(`finance-${String(i + 1).padStart(2, "0")}`, "finance", "public-link")),
    tip("study-review", "reference", "study-review"),
    tip("external-career", "career", "external-directory"),
  ];
});

it("preserves search and page/category reset rules while view changes replace available categories", () => {
  const text = getDictionary("ko").pages.campusTips;
  const { container } = render(<CampusTipsPage />);
  const view = container.querySelector<HTMLElement>('.m3-selection-track[data-selection-tone="primary"]')!;
  const categories = container.querySelector<HTMLElement>('.m3-selection-track[data-selection-tone="tonal"]')!;
  const viewMarker = view.querySelector(".m3-sliding-indicator");
  const categoryMarker = categories.querySelector(".m3-sliding-indicator");
  expect(view.querySelectorAll("button[data-selection-value]")).toHaveLength(7);
  expect(categories.querySelectorAll("button[data-selection-value]")).toHaveLength(3);
  fireEvent.change(screen.getByRole("textbox", { name: getDictionary("ko").search.label }), { target: { value: "needle" } });
  fireEvent.click(within(categories).getByRole("button", { name: text.categories.finance }));
  fireEvent.click(screen.getByRole("button", { name: "2" }));
  expect(screen.getByText("finance-13")).toBeInTheDocument();
  fireEvent.click(within(view).getByRole("button", { name: text.views.study }));
  expect(screen.getByText("study-review")).toBeInTheDocument();
  expect(screen.queryByText("finance-13")).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: getDictionary("ko").search.label })).toHaveValue("needle");
  expect(within(categories).getByRole("button", { name: text.categories.all })).toHaveAttribute("aria-pressed", "true");
  expect(categories.querySelector('[data-selection-value="finance"]')).toBeNull();
  expect(categories.querySelector('[data-selection-value="reference"]')).toBeInTheDocument();
  expect(container.querySelector(".m3-pagination")).toBeNull();
  expect(view.querySelector(".m3-sliding-indicator")).toBe(viewMarker);
  expect(categories.querySelector(".m3-sliding-indicator")).toBe(categoryMarker);
});

it("keeps the selected view and all-category marker when refreshed data adds an available category", () => {
  const { container, rerender } = render(<CampusTipsPage />);
  const categories = container.querySelector<HTMLElement>('.m3-selection-track[data-selection-tone="tonal"]')!;
  const marker = categories.querySelector(".m3-sliding-indicator");
  state.tips = [...state.tips, tip("local-place", "local", "local-life")];
  rerender(<CampusTipsPage />);
  expect(categories.querySelector('[data-selection-value="local"]')).toBeInTheDocument();
  expect(categories.querySelector('[data-selection-value="all"]')).toHaveAttribute("aria-pressed", "true");
  expect(container.querySelector('[data-selection-value="campus-tips"]')).toHaveAttribute("aria-pressed", "true");
  expect(categories.querySelector(".m3-sliding-indicator")).toBe(marker);
});
