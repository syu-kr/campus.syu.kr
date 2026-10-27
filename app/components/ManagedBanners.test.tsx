import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ManagedBanners } from "./ManagedBanners";
import { LocaleProvider } from "./LocaleProvider";
import type { PublicBanner } from "@/types/managed-content";
const now = Date.parse("2026-10-26T10:00:00Z");
const banner: PublicBanner = { id: "banner-one", kind: "banner", category: "ad", placement: "home", title: "제휴 안내", description: "공개 내용", imageDesktop: "/api/content-media/11111111-1111-4111-8111-111111111111", imageMobile: "/api/content-media/22222222-2222-4222-8222-222222222222", imageAlt: "배너 이미지 설명", link: "https://example.com/event", priority: 1, dismissible: true, startsAt: null, endsAt: new Date(now + 30000).toISOString(), revision: 1 };
const view = (item = banner) => <LocaleProvider locale="ko"><ManagedBanners initialBanners={[item]} placement="home" initialNow={now} /></LocaleProvider>;
const route = vi.hoisted(() => ({ path: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.path }));
const popup = { ...banner, placement: "popup" as const, endsAt: null };
const popupView = (items = [popup]) => <LocaleProvider locale="ko"><ManagedBanners initialBanners={items} placement="popup" initialNow={Date.now()} /></LocaleProvider>;
beforeEach(() => { vi.useFakeTimers();vi.setSystemTime(now);route.path = "/";localStorage.clear();sessionStorage.clear();vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ banners: [] }))); });
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
it("recovers an empty server snapshot immediately instead of waiting for the polling interval", async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json({ banners: [banner] }));
  render(<LocaleProvider locale="ko"><ManagedBanners initialBanners={[]} placement="home" initialNow={now} /></LocaleProvider>);
  await act(async () => { await Promise.resolve(); });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("heading", { name: banner.title })).toBeVisible();
  expect(Date.now()).toBe(now);
});
it("uses a populated server snapshot without an extra initial request", () => {
  render(view());
  expect(screen.getByRole("heading", { name: banner.title })).toBeVisible();
  expect(fetch).not.toHaveBeenCalled();
});

it("opens a modal with focus and scroll lock, and Escape restores the previous focus", () => {
  render(<button>Return target</button>);
  const trigger = screen.getByRole("button", { name: "Return target" });trigger.focus();
  render(popupView());
  expect(screen.getByRole("dialog", { name: popup.title })).toHaveAttribute("aria-modal", "true");
  expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();expect(document.body.style.overflow).not.toBe("hidden");expect(trigger).toHaveFocus();
});

it("keeps normal popup dismissal for this tab and shows a new published revision", () => {
  const first = render(popupView());fireEvent.click(screen.getByRole("button", { name: "닫기" }));first.unmount();
  const second = render(popupView());expect(screen.queryByRole("dialog")).toBeNull();second.unmount();
  render(popupView([{ ...popup, revision: 2 }]));expect(screen.getByRole("dialog")).toBeVisible();
});

it("waits for stored dismissal before opening, and allows the popup after Korean midnight", () => {
  const first = render(popupView());fireEvent.click(screen.getByRole("button", { name: "오늘 그만 보기" }));first.unmount();
  expect(localStorage.getItem("campus-banner:banner-one:1")).toBe(String(Date.parse("2026-10-26T15:00:00Z")));
  const second = render(popupView());expect(screen.queryByRole("dialog")).toBeNull();second.unmount();
  vi.setSystemTime(Date.parse("2026-10-26T15:00:00Z"));render(popupView());expect(screen.getByRole("dialog")).toBeVisible();
});

it("shows at most one popup at a time and keeps the next one dismissible", () => {
  render(popupView([popup, { ...popup, id: "second", title: "두 번째 공지" }]));
  expect(screen.getAllByRole("dialog")).toHaveLength(1);expect(screen.queryByText("두 번째 공지")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "닫기" }));expect(screen.getByRole("dialog", { name: "두 번째 공지" })).toBeVisible();
  fireEvent.click(screen.getByRole("dialog"));expect(screen.queryByRole("dialog")).toBeNull();
});

it("keeps popups out of private routes during client navigation and returns on public routes", () => {
  const current = render(popupView());expect(screen.getByRole("dialog")).toBeVisible();
  for (const path of ["/en/admin", "/campus/roommates/new", "/en/more/meet/private-room"]) {
    route.path = path;current.rerender(popupView());expect(screen.queryByRole("dialog")).toBeNull();expect(document.body.style.overflow).not.toBe("hidden");
  }
  route.path = "/academic";current.rerender(popupView());expect(screen.getByRole("dialog")).toBeVisible();
});

it("opens and closes even when local and session storage are unavailable", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("unavailable"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("unavailable"); });
  render(popupView());expect(screen.getByRole("dialog")).toBeVisible();fireEvent.click(screen.getByRole("button", { name: "오늘 그만 보기" }));expect(screen.queryByRole("dialog")).toBeNull();
});
