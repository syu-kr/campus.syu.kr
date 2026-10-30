import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ManagedBanners } from "./ManagedBanners";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "./LocaleProvider";
import { Modal } from "./Modal";
import { PageTranslationStatus, PublicContentTranslation } from "./ContentTranslation";
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

function translationView(id: string) {
  return <LocaleProvider locale="en"><PageTranslationStatus />
    <PublicContentTranslation source={{ kind: "announcement", id, category: "academic" }} content={{ title: "공개 공지" }}>{translation => <h2>{translation.text("title", "공개 공지")}</h2>}</PublicContentTranslation>
    <ManagedBanners initialBanners={[{ ...popup, id }]} placement="popup" initialNow={now} />
  </LocaleProvider>;
}
function translatedBanner(request: { fields: string[] }) {
  const originals = { title: banner.title, description: banner.description, imageAlt: banner.imageAlt };
  return { ok: true, result: { originals: Object.fromEntries(request.fields.map(field => [field, originals[field as keyof typeof originals]])), translations: Object.fromEntries(request.fields.map(field => [field, field === "title" ? "Banner notice" : "Public banner text"])), target: "en", provider: "google" } };
}

it("keeps an unrelated page translation failure out of a successfully translated popup", async () => {
  vi.mocked(fetch).mockImplementation(async (_url, options) => Response.json({ results: JSON.parse(options!.body as string).requests.map((request: { source: { kind: string }; fields: string[] }) => request.source.kind === "banner" ? translatedBanner(request) : { ok: false, status: 503, code: "TRANSLATION_FAILED" }) }));
  render(translationView("popup-independent-status"));
  await act(async () => vi.advanceTimersByTimeAsync(100));
  const dialog = screen.getByRole("dialog", { name: "Banner notice" });
  expect(within(dialog).getByRole("status")).toHaveTextContent("Automatic translation");
  expect(within(dialog).queryByRole("button", { name: "Retry translation" })).toBeNull();
  expect(screen.getByRole("heading", { name: "공개 공지" })).toBeVisible();
  expect(screen.getAllByRole("status").some(status => status.textContent?.includes("currently unavailable"))).toBe(true);
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  expect(screen.getByRole("button", { name: "Retry translation" })).toBeVisible();
});

it("retries only a failed popup and preserves its focus and the page recovery control", async () => {
  const payloads: { source: { kind: string }; fields: string[] }[][] = [];
  vi.mocked(fetch).mockImplementation(async (_url, options) => {
    const requests = JSON.parse(options!.body as string).requests;payloads.push(requests);
    return Response.json({ results: requests.map((request: { fields: string[] }) => payloads.length === 1 ? { ok: false, status: 503, code: "TRANSLATION_FAILED" } : translatedBanner(request)) });
  });
  render(translationView("popup-independent-retry"));
  await act(async () => vi.advanceTimersByTimeAsync(100));
  const dialog = screen.getByRole("dialog", { name: popup.title }), status = within(dialog).getByRole("status");
  expect(status).toHaveTextContent("currently unavailable");
  const retry = within(dialog).getByRole("button", { name: "Retry translation" });retry.focus();fireEvent.click(retry);
  expect(status).toHaveFocus();
  await act(async () => vi.advanceTimersByTimeAsync(100));
  expect(payloads).toHaveLength(2);expect(payloads[1].map(request => request.source.kind)).toEqual(["banner"]);
  expect(screen.getByRole("dialog", { name: "Banner notice" })).toBeVisible();
  expect(within(dialog).getByRole("status")).toHaveFocus();
  expect(within(dialog).getByRole("status")).toHaveTextContent("Automatic translation");
  expect(within(dialog).queryByRole("button", { name: "Retry translation" })).toBeNull();
  expect(screen.getByRole("heading", { name: "공개 공지" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Retry translation" })).toBeVisible();
});

it("uses responsive media, an accessible description, and sponsored external links without nesting controls", () => {
  const { container } = render(view());
  expect(screen.getByRole("img", { name: banner.imageAlt })).toHaveAttribute("src", banner.imageDesktop);
  expect(container.querySelector("source")).toHaveAttribute("srcset", banner.imageMobile);
  const link = screen.getByRole("link");expect(link).toHaveAttribute("rel", "sponsored nofollow noopener noreferrer");
  expect(link.querySelector("button")).toBeNull();expect(screen.getByText("광고")).toBeVisible();
});
it("prioritizes only the displayed popup image while preserving responsive media and dismissal", () => {
  const current = render(popupView());
  const image = screen.getByRole("img", { name: popup.imageAlt });
  expect(image).toHaveAttribute("loading", "eager");
  expect(image).toHaveAttribute("fetchpriority", "high");
  expect(image.closest("picture")?.querySelector("source")).toHaveAttribute("srcset", popup.imageMobile);
  fireEvent.click(screen.getByRole("button", { name: "닫기" }));
  expect(screen.queryByRole("img")).toBeNull();
  current.unmount();
  const dismissed = render(popupView());
  expect(screen.queryByRole("img")).toBeNull();
  dismissed.unmount();
  render(view());
  expect(screen.getByRole("img", { name: banner.imageAlt })).toHaveAttribute("loading", "lazy");
  expect(screen.getByRole("img", { name: banner.imageAlt })).not.toHaveAttribute("fetchpriority", "high");
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

it("recovers a failed empty snapshot with bounded early retries instead of waiting thirty seconds", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({}, { status: 503 })).mockRejectedValueOnce(new Error("offline")).mockResolvedValue(Response.json({ banners: [popup] }));
  render(popupView([]));
  await act(async () => vi.advanceTimersByTimeAsync(3011));
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(screen.getByRole("dialog", { name: popup.title })).toBeVisible();
});

it("accepts a successful empty response and keeps polling for newly published banners", async () => {
  vi.mocked(fetch).mockImplementation(async () => Response.json({ banners: [] }));
  const current = render(popupView([]));
  await act(async () => vi.advanceTimersByTimeAsync(10000));
  expect(fetch).toHaveBeenCalledTimes(1);
  vi.mocked(fetch).mockResolvedValue(Response.json({ banners: [popup] }));
  await act(async () => vi.advanceTimersByTimeAsync(20000));
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("dialog", { name: popup.title })).toBeVisible();
  vi.mocked(fetch).mockResolvedValue(Response.json({ banners: [] }));
  await act(async () => vi.advanceTimersByTimeAsync(30000));
  expect(screen.queryByRole("dialog")).toBeNull();
  current.unmount();
  await act(async () => vi.advanceTimersByTimeAsync(30000));
  expect(fetch).toHaveBeenCalledTimes(3);
});

it("does not accept malformed successful responses as recovery", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ banners: [null] })).mockResolvedValue(Response.json({ banners: [] }));
  render(popupView([]));
  await act(async () => vi.advanceTimersByTimeAsync(10000));
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("does not overlap an unfinished read when the tab becomes visible", async () => {
  let finish!: (response: Response) => void;
  vi.mocked(fetch).mockReturnValue(new Promise<Response>(resolve => { finish = resolve; }));
  render(popupView([]));fireEvent(document, new Event("visibilitychange"));
  expect(fetch).toHaveBeenCalledTimes(1);
  await act(async () => finish(Response.json({ banners: [popup] })));
  expect(screen.getByRole("dialog", { name: popup.title })).toBeVisible();
});

it("aborts a stalled read after eight seconds and recovers with a fresh request", async () => {
  const signals: AbortSignal[] = [];
  const startedTimeouts = vi.spyOn(window, "setTimeout"), clearedTimeouts = vi.spyOn(window, "clearTimeout");
  vi.mocked(fetch).mockImplementationOnce((_input, init) => new Promise<Response>((_resolve, reject) => {
    const signal = init!.signal!;signals.push(signal);
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  })).mockImplementationOnce(async (_input, init) => { signals.push(init!.signal!);return Response.json({ banners: [popup] }); })
    .mockImplementationOnce((_input, init) => new Promise<Response>((_resolve, reject) => {
      const signal = init!.signal!;signals.push(signal);
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
  const current = render(popupView([]));
  await act(async () => vi.advanceTimersByTimeAsync(7999));expect(signals[0].aborted).toBe(false);
  await act(async () => vi.advanceTimersByTimeAsync(1));expect(signals[0].aborted).toBe(true);
  await act(async () => vi.advanceTimersByTimeAsync(1001));
  expect(fetch).toHaveBeenCalledTimes(2);expect(signals[1]).not.toBe(signals[0]);expect(signals[1].aborted).toBe(false);
  expect(screen.getByRole("dialog", { name: popup.title })).toBeVisible();
  fireEvent(document, new Event("visibilitychange"));expect(signals[2].aborted).toBe(false);
  await act(async () => current.unmount());expect(signals[2].aborted).toBe(true);
  const requestTimers = startedTimeouts.mock.calls.flatMap(([, delay], index) => delay === 8000 ? [startedTimeouts.mock.results[index].value] : []);
  expect(requestTimers).toHaveLength(3);for (const timer of requestTimers) expect(clearedTimeouts).toHaveBeenCalledWith(timer);
});

it("starts a known scheduled popup at its boundary without waiting for polling", async () => {
  render(popupView([{ ...popup, startsAt: new Date(now + 1000).toISOString() }]));
  expect(screen.queryByRole("dialog")).toBeNull();
  await act(async () => vi.advanceTimersByTimeAsync(1011));
  expect(screen.getByRole("dialog", { name: popup.title })).toBeVisible();
});

it("ends today's dismissal at Korean midnight while the page remains open", async () => {
  vi.setSystemTime(Date.parse("2026-10-26T14:59:59Z"));
  render(popupView());fireEvent.click(screen.getByRole("button", { name: "오늘 그만 보기" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  await act(async () => vi.advanceTimersByTimeAsync(1011));
  expect(screen.getByRole("dialog", { name: popup.title })).toBeVisible();
});

it("waits for an existing dialog to close before opening an automatic popup", async () => {
  const active = render(<LocaleProvider locale="ko"><Modal isOpen title="입력 중" onClose={() => undefined}><input aria-label="작성 중" /></Modal></LocaleProvider>);
  const input = screen.getByRole("textbox", { name: "작성 중" });input.focus();
  render(popupView());
  expect(screen.queryByRole("dialog", { name: popup.title })).toBeNull();expect(input).toHaveFocus();
  active.rerender(<LocaleProvider locale="ko"><Modal isOpen={false} title="입력 중" onClose={() => undefined}>Content</Modal></LocaleProvider>);
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByRole("dialog", { name: popup.title })).toBeVisible();
});


it("ships a closed popup without requesting media before the dismissal check", () => {
  const html = renderToStaticMarkup(<LocaleProvider locale="ko"><ManagedBanners initialBanners={[popup]} placement="popup" initialNow={now} nonce="test-nonce" /></LocaleProvider>);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const dialog = doc.querySelector("dialog");
  expect(dialog?.hasAttribute("open")).toBe(false);
  expect(dialog?.getAttribute("data-managed-popup")).toBe("campus-banner:banner-one:1");
  expect(dialog?.nextElementSibling?.getAttribute("nonce")).toBe("test-nonce");
  expect(doc.querySelector("img")?.getAttribute("data-src")).toBe(popup.imageDesktop);
  expect(doc.querySelector("img")?.getAttribute("src")).toMatch(/^data:image/);
  expect(doc.querySelector("source")?.hasAttribute("srcset")).toBe(false);
});

it("preserves a pre-hydration dismissal marker when browser storage is unavailable", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("storage disabled"); });
  const early = document.createElement("dialog");
  early.dataset.managedPopup = "campus-banner:banner-one:1";
  early.dataset.dismissedUntil = "closed";
  document.body.append(early);
  try {
    render(popupView());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  } finally { early.remove(); }
});

it("does not translate a popup that is already dismissed", async () => {
  sessionStorage.setItem("campus-banner:banner-one:1", "closed");
  render(<LocaleProvider locale="en"><ManagedBanners initialBanners={[popup]} placement="popup" initialNow={now} /></LocaleProvider>);
  await act(async () => vi.advanceTimersByTimeAsync(100));
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
});
