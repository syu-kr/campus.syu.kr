import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { CompetitionsPageClient } from "./CompetitionsPageClient";

const requests = vi.hoisted(() => [] as unknown[][]);
const state = vi.hoisted(() => ({ pending: false, error: false }));
vi.mock("@tanstack/react-query", () => ({ useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
  requests.push(queryKey);
  return { data: { items: [], total: 50, totalPages: 5 }, isLoading: false, isError: state.error,
    isPlaceholderData: state.pending && Number(queryKey[4]) > 1 };
} }));
vi.mock("@/lib/use-debounced-value", () => ({ useDebouncedValue: (value: string) => value }));

beforeEach(() => { requests.length = 0; state.pending = false; state.error = false; });

it("preserves source/status options, query values and page reset alongside moving selection markers", () => {
  const text = getDictionary("ko").pages.competitions;
  const { container } = render(<CompetitionsPageClient />);
  expect(container.querySelectorAll(".m3-sliding-indicator")).toHaveLength(3);
  expect(container.querySelectorAll('.m3-selection-track[data-selection-tone="tonal"]')).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "2" }));
  expect(requests.at(-1)).toEqual(["competition-page", "all", "open", "", 2]);
  fireEvent.click(screen.getByRole("button", { name: text.statuses.result }));
  expect(requests.at(-1)).toEqual(["competition-page", "all", "result", "", 1]);
  fireEvent.click(screen.getByRole("button", { name: text.sourceFilters.department }));
  expect(requests.at(-1)).toEqual(["competition-page", "department", "result", "", 1]);
  expect(screen.getByRole("button", { name: text.sourceFilters.department })).toHaveAttribute("aria-pressed", "true");
  expect(container.querySelectorAll('[data-selection-value="open"]')).toHaveLength(1);
  expect(container.querySelectorAll('[data-selection-value="scholarship"]')).toHaveLength(1);
});

it("preserves only page-loading list height and releases it on completion, filter changes or errors", () => {
  const { container, rerender } = render(<CompetitionsPageClient />);
  const results = container.querySelector<HTMLElement>(".space-y-3")!;
  vi.spyOn(results, "getBoundingClientRect").mockReturnValue({ height: 1800 } as DOMRect);
  state.pending = true;
  fireEvent.click(screen.getByRole("button", { name: "2" }));
  expect(results.style.minHeight).toBe("1800px");
  state.pending = false;
  rerender(<CompetitionsPageClient />);
  expect(results.style.minHeight).toBe("");
  state.pending = true;
  fireEvent.click(screen.getByRole("button", { name: "3" }));
  expect(results.style.minHeight).toBe("1800px");
  fireEvent.click(screen.getByRole("button", { name: getDictionary("ko").pages.competitions.statuses.result }));
  expect(results.style.minHeight).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "2" }));
  expect(results.style.minHeight).toBe("1800px");
  state.error = true;
  rerender(<CompetitionsPageClient />);
  expect(results.style.minHeight).toBe("");
  expect(container.querySelector(".m3-pagination")).toBeNull();
});
