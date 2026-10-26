import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ManagedBanners } from "./ManagedBanners";
import { LocaleProvider } from "./LocaleProvider";
import type { PublicBanner } from "@/types/managed-content";
const now = Date.parse("2026-10-26T10:00:00Z");
const banner: PublicBanner = { id: "banner-one", kind: "banner", category: "ad", placement: "home", title: "제휴 안내", description: "공개 내용", imageDesktop: "/api/content-media/11111111-1111-4111-8111-111111111111", imageMobile: "/api/content-media/22222222-2222-4222-8222-222222222222", imageAlt: "배너 이미지 설명", link: "https://example.com/event", priority: 1, dismissible: true, startsAt: null, endsAt: new Date(now + 30000).toISOString(), revision: 1 };
const view = (item = banner) => <LocaleProvider locale="ko"><ManagedBanners initialBanners={[item]} placement="home" initialNow={now} /></LocaleProvider>;
beforeEach(() => { vi.useFakeTimers();vi.setSystemTime(now);localStorage.clear();vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ banners: [] }))); });
afterEach(() => { vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks(); });

it("uses responsive media, an accessible description, and sponsored external links without nesting controls", () => {
  const { container } = render(view());
  expect(screen.getByRole("img", { name: banner.imageAlt })).toHaveAttribute("src", banner.imageDesktop);
  expect(container.querySelector("source")).toHaveAttribute("srcset", banner.imageMobile);
  const link = screen.getByRole("link");expect(link).toHaveAttribute("rel", "sponsored nofollow noopener noreferrer");
  expect(link.querySelector("button")).toBeNull();expect(screen.getByText("광고")).toBeVisible();
});
it("hides until the next Korean midnight and a new published revision appears again", () => {
  const { unmount } = render(view());fireEvent.click(screen.getByRole("button", { name: "오늘 그만 보기" }));
  expect(screen.queryByText(banner.title)).not.toBeInTheDocument();
  expect(Number(localStorage.getItem("campus-banner:banner-one:1"))).toBe(Date.parse("2026-10-26T15:00:00Z"));
  unmount();render(view({ ...banner, revision: 2 }));expect(screen.getByText(banner.title)).toBeVisible();
});
it("expires an open banner without waiting for another page load", async () => {
  render(view({ ...banner, endsAt: new Date(now + 1000).toISOString() }));
  await act(async () => vi.advanceTimersByTimeAsync(1011));expect(screen.queryByText(banner.title)).not.toBeInTheDocument();
});
it("keeps dismissal usable when browser storage is unavailable", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage disabled"); });
  render(view());fireEvent.click(screen.getByRole("button", { name: "오늘 그만 보기" }));expect(screen.queryByText(banner.title)).not.toBeInTheDocument();
});
it("does not execute unsafe URLs and preserves the locale on internal links", () => {
  const { unmount } = render(view({ ...banner, link: "javascript:alert(1)" }));expect(screen.queryByRole("link")).not.toBeInTheDocument();unmount();
  render(<LocaleProvider locale="en"><ManagedBanners initialBanners={[{ ...banner, link: "/service/notices" }]} placement="home" initialNow={now} /></LocaleProvider>);
  expect(screen.getByRole("link")).toHaveAttribute("href", "/en/service/notices");
});
