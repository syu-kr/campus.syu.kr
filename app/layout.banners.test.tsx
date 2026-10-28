import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { PublicBanner } from "@/types/managed-content";

const request = vi.hoisted(() => ({ pathname: "/", read: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-syu-pathname": request.pathname, "x-syu-locale": "ko" }) }));
vi.mock("@/lib/server/public-managed-content", () => ({ getPublicBanners: request.read }));
vi.mock("./components/ManagedBanners", () => ({ ManagedBanners: ({ initialBanners }: { initialBanners: PublicBanner[] }) => initialBanners.map(item => <aside key={item.id}>{item.title}</aside>) }));
vi.mock("./components/Header", () => ({ Header: () => <header /> }));
vi.mock("./components/Footer", () => ({ Footer: () => <footer><button>Locale</button></footer> }));
vi.mock("./components/BottomNav", () => ({ BottomNav: () => null }));
vi.mock("./components/NotificationPermissionPrompt", () => ({ NotificationPermissionPrompt: () => <section className="m3-notification-prompt">Notification setup</section> }));
vi.mock("./components/ContentTranslation", () => ({ PageTranslationStatus: () => null }));
vi.mock("./components/LocaleProvider", () => ({ LocaleProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("./components/SiteContent", () => ({ SiteContent: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("./providers", () => ({ Providers: ({ children }: { children: ReactNode }) => children }));
vi.mock("next/script", () => ({ default: () => null }));

import RootLayout from "./layout";

beforeEach(() => { request.pathname = "/";request.read.mockReset().mockResolvedValue([]); });

it("includes a resolved site banner before content in the initial document", async () => {
  let publish!: (value: PublicBanner[]) => void;
  request.read.mockReturnValue(new Promise<PublicBanner[]>(resolve => { publish = resolve; }));
  let completed = false;
  const layout = RootLayout({ children: <p>Campus content</p> }).then(value => { completed = true;return value; });
  await vi.waitFor(() => expect(request.read).toHaveBeenCalledWith("site-top", expect.any(Number)));
  expect(completed).toBe(false);
  publish([{ id: "public-maintenance", title: "Maintenance notice" } as PublicBanner]);
  const html = renderToStaticMarkup(await layout);
  expect(html).toContain("Maintenance notice");
  expect(html.indexOf("Maintenance notice")).toBeLessThan(html.indexOf("<main>"));
});

it("keeps the delayed notification prompt after the footer so its controls do not move on first interaction", async () => {
  request.pathname = "/more";
  const document = new DOMParser().parseFromString(renderToStaticMarkup(await RootLayout({ children: <p>Campus content</p> })), "text/html");
  const prompt = document.querySelector(".m3-notification-prompt");
  expect(prompt).not.toBeNull();
  expect(document.querySelector("main")?.contains(prompt)).toBe(false);
  expect(document.querySelector("footer")?.nextElementSibling).toBe(prompt);
});

it.each(["/admin", "/en/admin", "/campus/roommates", "/en/campus/roommates/new", "/more/meet/private-room", "/en/more/meet/private-room"])("keeps banners and their reads out of excluded route %s", async pathname => {
  request.pathname = pathname;
  const html = renderToStaticMarkup(await RootLayout({ children: <p>Private content</p> }));
  expect(request.read).not.toHaveBeenCalled();
  expect(html).not.toContain("<aside");
  expect(html).toContain("Private content");
});
