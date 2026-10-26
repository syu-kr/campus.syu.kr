import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { getDictionary } from "@/lib/i18n";
import type { CampusTip } from "@/types";
import CampusTipsPage from "./CampusTipsPageClient";

const state = vi.hoisted(() => ({ tips: [] as CampusTip[] }));
const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/campus/campus-tips",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: state.tips, isLoading: false, isError: false, refetch: vi.fn() }) }));
vi.mock("./CampusTipSuggestionForm", () => ({ CampusTipSuggestionForm: () => null }));

function tip(id: string, category: CampusTip["category"], contentKind: CampusTip["contentKind"]): CampusTip {
  return { id, title: id, description: "needle", category, contentKind, url: `https://example.test/${id}`, tags: [], sourceType: "official", isExternal: true };
}

beforeEach(() => {
  window.history.replaceState(null, "", "/campus/campus-tips?lang=en#tips");
  const navigate = (href: string) => window.history.replaceState(null, "", href);
  navigation.push.mockReset().mockImplementation(navigate);
  navigation.replace.mockReset().mockImplementation(navigate);
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
  fireEvent.click(screen.getByRole("link", { name: "2" }));
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

it("restores category/page/search from URL and preserves hash and unrelated values across filter reset and back", () => {
  window.history.replaceState(null, "", "/campus/campus-tips?category=finance&search=needle&page=2&lang=en#tips");
  const { container, rerender } = render(<CampusTipsPage />);
  expect(screen.getByText("finance-13")).toBeInTheDocument();
  const first = screen.getByRole("link", { name: "1" });
  expect(first.getAttribute("href")).toContain("category=finance");
  expect(first.getAttribute("href")).toContain("search=needle");
  fireEvent.click(first);
  expect(window.location.search).not.toContain("page=");
  expect(window.location.hash).toBe("#tips");
  const view = container.querySelector<HTMLElement>('.m3-selection-track[data-selection-tone="primary"]')!;
  fireEvent.click(within(view).getByRole("button", { name: getDictionary("ko").pages.campusTips.views.study }));
  expect(window.location.search).toContain("view=study");
  expect(window.location.search).not.toContain("category=");
  expect(window.location.search).toContain("lang=en");
  window.history.replaceState(null, "", "/campus/campus-tips?category=finance&search=needle&page=2&lang=en#tips");
  rerender(<CampusTipsPage />);
  expect(screen.getByText("finance-13")).toBeInTheDocument();
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

it("keeps an available category marker and valid item range for an invalid direct URL", () => {
  window.history.replaceState(null, "", "/campus/campus-tips?view=study&category=finance&page=999&lang=en#tips");
  const { container } = render(<CampusTipsPage />);
  const categories = container.querySelector<HTMLElement>('.m3-selection-track[data-selection-tone="tonal"]')!;
  expect(within(categories).getByRole("button", { name: getDictionary("ko").pages.campusTips.categories.all })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("study-review")).toBeInTheDocument();
  expect(window.location.search).toContain("view=study");
  expect(window.location.search).not.toContain("category=");
  expect(window.location.search).not.toContain("page=");
  expect(window.location.search).toContain("lang=en");
  expect(window.location.hash).toBe("#tips");
  expect(container.textContent).not.toContain("11977");
});
