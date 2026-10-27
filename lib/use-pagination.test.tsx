import { renderToStaticMarkup } from "react-dom/server";
import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { usePagination } from "./use-pagination";

afterEach(() => vi.unstubAllGlobals());

it("uses a stable server page range without consulting the viewport", () => {
  const matchMedia = vi.fn(() => { throw new Error("SSR viewport access"); });
  vi.stubGlobal("matchMedia", matchMedia);
  function List() {
    const state = usePagination([1, 2, 3, 4], 2, { initialPage: 2, mobilePageRange: 5, desktopPageRange: 7 });
    return <span>{state.pageRange}:{state.paginatedItems.join(",")}</span>;
  }
  expect(renderToStaticMarkup(<List />)).toBe("<span>7:3,4</span>");
  expect(matchMedia).not.toHaveBeenCalled();
});

it("keeps the requested page while responsive page ranges change and cleans up the subscription", () => {
  const callbacks = new Set<() => void>();
  const media = { matches: false, addEventListener: (_: string, callback: () => void) => callbacks.add(callback),
    removeEventListener: (_: string, callback: () => void) => callbacks.delete(callback) };
  vi.stubGlobal("matchMedia", () => media);
  const { result, unmount } = renderHook(() => usePagination([1, 2, 3, 4], 2, { initialPage: 2, mobilePageRange: 5, desktopPageRange: 7 }));
  expect(result.current.currentPage).toBe(2);
  expect(result.current.pageRange).toBe(7);
  act(() => { media.matches = true; callbacks.forEach(callback => callback()); });
  expect(result.current.pageRange).toBe(5);
  expect(result.current.paginatedItems).toEqual([3, 4]);
  unmount();
  expect(callbacks.size).toBe(0);
});

it("clamps the visible page when a direct URL or changed data exceeds the last page", () => {
  const { result, rerender } = renderHook(({ items }) => usePagination(items, 2, { initialPage: 999 }), { initialProps: { items: [1, 2, 3] } });
  expect(result.current.currentPage).toBe(2);
  expect(result.current.paginatedItems).toEqual([3]);
  rerender({ items: [] });
  expect(result.current.currentPage).toBe(1);
  expect(result.current.totalPages).toBe(0);
  expect(result.current.paginatedItems).toEqual([]);
});
