import { renderToStaticMarkup } from "react-dom/server";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ServiceNoticePagination } from "./ServiceNoticePagination";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/en/service/notices", useSearchParams: () => new URLSearchParams(window.location.search), useRouter: () => navigation }));
beforeEach(() => {
  window.history.replaceState(null, "", "/en/service/notices?extra=a&extra=b#notices");
  navigation.push.mockReset();
});

it("provides crawlable SSR page links and keeps locale, repeated extras and the hydrated hash", () => {
  const html = renderToStaticMarkup(<ServiceNoticePagination currentPage={1} totalPages={2} />);
  expect(html).toContain('href="/en/service/notices?extra=a&amp;extra=b&amp;page=2"');
  render(<ServiceNoticePagination currentPage={1} totalPages={2} />);
  const pageTwo = screen.getByRole("link", { name: "2" });
  expect(pageTwo).toHaveAttribute("href", "/en/service/notices?extra=a&extra=b&page=2#notices");
  const cancelNative = (event: Event) => event.preventDefault();
  pageTwo.addEventListener("click", cancelNative);
  fireEvent.click(pageTwo, { ctrlKey: true });
  pageTwo.removeEventListener("click", cancelNative);
  expect(navigation.push).not.toHaveBeenCalled();
  fireEvent.click(pageTwo);
  expect(navigation.push).toHaveBeenCalledWith("/en/service/notices?extra=a&extra=b&page=2#notices", { scroll: false });
});

it("marks the incoming page active, removes page=1 from back links and renders no empty pager", () => {
  window.history.replaceState(null, "", "/en/service/notices?page=2&extra=keep#notices");
  const { rerender, container } = render(<ServiceNoticePagination currentPage={2} totalPages={2} />);
  expect(screen.getByRole("link", { name: "2" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "1" })).toHaveAttribute("href", "/en/service/notices?extra=keep#notices");
  rerender(<ServiceNoticePagination currentPage={1} totalPages={1} />);
  expect(container).toBeEmptyDOMElement();
});
