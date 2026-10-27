import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SiteContent } from "./SiteContent";
import { getDictionary } from "@/lib/i18n";

const route = vi.hoisted(() => ({ pathname: "/academic/timetable", query: "", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useSearchParams: () => new URLSearchParams(route.query),
  useRouter: () => ({ push: route.push }),
}));
const context = { url: "/?search=time", result: "/academic/timetable", scrollY: 240 };
beforeEach(() => {
  route.pathname = context.result; route.query = ""; route.push.mockReset();
  window.history.replaceState(null, "", context.result);
  sessionStorage.setItem("syu-campus-search-return", JSON.stringify(context));
});
afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });

it("places contextual search return after the content and preserves its original destination", async () => {
  render(<SiteContent initialPathname={route.pathname}><h1>시간표</h1></SiteContent>);
  const link = await screen.findByRole("link", { name: getDictionary("ko").m3.searchReturn });
  expect(screen.getByRole("heading").compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(link);
  expect(route.push).toHaveBeenCalledExactlyOnceWith(context.url, { scroll: false });
  expect(JSON.parse(sessionStorage.getItem("syu-campus-search-return")!)).toEqual(context);
});

it("still restores the search-result scroll and focus after returning", async () => {
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const { rerender } = render(<SiteContent initialPathname={route.pathname}><h1>시간표</h1></SiteContent>);
  await screen.findByRole("link", { name: getDictionary("ko").m3.searchReturn });
  route.pathname = "/"; route.query = "search=time";
  window.history.replaceState(null, "", context.url);
  rerender(<SiteContent initialPathname="/"><a href={context.result}>시간표 검색 결과</a></SiteContent>);
  await waitFor(() => expect(screen.getByRole("link", { name: "시간표 검색 결과" })).toHaveFocus());
  expect(scroll).toHaveBeenLastCalledWith({ top: context.scrollY, behavior: "instant" });
  expect(screen.queryByRole("link", { name: getDictionary("ko").m3.searchReturn })).not.toBeInTheDocument();
});
