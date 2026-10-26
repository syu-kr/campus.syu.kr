import type { ComponentProps } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { LocaleProvider } from "./LocaleProvider";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ prefetch, ...props }: ComponentProps<"a"> & { prefetch?: boolean }) => { void prefetch; return <a {...props} />; },
  useLinkStatus: () => ({ pending: false }),
}));
vi.mock("./WeatherWidget", () => ({ WeatherWidget: () => null }));
vi.mock("./WeatherModal", () => ({ WeatherModal: () => null }));
vi.mock("./SearchDialog", () => ({
  default: ({ onClose }: { onClose: () => void }) => <div role="dialog" aria-label="Test search"><button onClick={onClose}>Close search</button></div>,
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isPending: false, isError: false, refetch: vi.fn() }),
}));

const mockedUsePathname = vi.mocked(usePathname);
const breakpointListeners = new Set<(event: MediaQueryListEvent) => void>();
beforeEach(() => {
  mockedUsePathname.mockReturnValue("/");
  vi.stubGlobal("matchMedia", () => ({
    matches: false, media: "(max-width:899px)",
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => breakpointListeners.add(listener),
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => breakpointListeners.delete(listener),
  }));
});
afterEach(() => { breakpointListeners.clear(); vi.unstubAllGlobals(); });

describe("M3 Header and BottomNav", () => {
  it("keeps sticky content below the header when enlarged text wraps its tools", () => {
    let height = 128;
    const callbacks: (() => void)[] = [];
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { callbacks.push(callback); }
      observe() {}
      disconnect = disconnect;
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return new DOMRect(0, 0, 320, this.tagName === "HEADER" ? height : 0);
    });
    const previous = document.documentElement.style.getPropertyValue("--header-height");
    const { unmount } = render(<Header />);
    expect(document.documentElement.style.getPropertyValue("--header-height")).toBe("128px");
    height = 64;
    act(() => callbacks.forEach(callback => callback()));
    expect(document.documentElement.style.getPropertyValue("--header-height")).toBe("64px");
    unmount();
    expect(document.documentElement.style.getPropertyValue("--header-height")).toBe(previous);
    expect(disconnect).toHaveBeenCalled();
  });

  it.each(["/", "/academic", "/campus/cafeteria", "/campus/roommates/verify/finish", "/en/more/meet/invitation"])(
    "keeps the logo first with no redundant parent back control at %s", (path) => {
      mockedUsePathname.mockReturnValue(path);
      const locale = path.startsWith("/en") ? "en" : "ko";
      const dictionary = getDictionary(locale);
      render(<LocaleProvider locale={locale}><Header /></LocaleProvider>);
      expect(screen.queryByRole("link", { name: new RegExp("^" + dictionary.navigation.back) })).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: dictionary.navigation.homepageTitle })).toHaveAttribute("href", locale === "en" ? "/en" : "/");
    },
  );

  it("opens submenus on hover while each top-level destination remains a direct link", () => {
    const dictionary = getDictionary("ko");
    const { container } = render(<Header />);
    const academic = screen.getByRole("link", { name: dictionary.navigation.academic });
    expect(academic).toHaveAttribute("href", "/academic");
    expect(academic).toHaveAttribute("aria-expanded", "false");
    fireEvent.mouseEnter(academic.closest(".m3-nav-group")!);
    const menu = container.querySelector(".m3-menu")!;
    expect(academic).toHaveAttribute("aria-expanded", "true");
    expect(within(menu as HTMLElement).getByRole("link", { name: dictionary.academic.menus.timetableTitle })).toHaveAttribute("href", "/academic/timetable");
    const external = within(menu as HTMLElement).getByRole("link", { name: dictionary.academic.menus.mockSugangTitle });
    expect(external).toHaveAttribute("href", "https://sugang.syu.kr/testLogin");
    expect(external).toHaveAttribute("rel", "noopener noreferrer");
    fireEvent.mouseLeave(academic.closest(".m3-nav-group")!);
    expect(container.querySelector(".m3-menu")).toBeNull();
    fireEvent.click(academic);
    expect(academic).toHaveAttribute("href", "/academic");
  });

  it("shows decorative destination icons without changing submenu links or accessible names", () => {
    const dictionary = getDictionary("ko");
    const { container } = render(<Header />);
    for (const [label, destinations] of [
      [dictionary.navigation.academic, ["/academic/announcements", "/academic/schedule", "/academic/sw-notices", "/academic/competitions", "/academic/scholarship", "/academic/graduation", "/academic/timetable", "https://sugang.syu.kr/testLogin", "https://sugang.syu.kr/basket"]],
      [dictionary.navigation.campus, ["/campus/announcements", "/campus/cafeteria", "/campus/bus-info", "/campus/library", "/campus/map", "/campus/phone", "/campus/campus-tips", "/campus/gym", "/campus/health-center"]],
      [dictionary.navigation.more, ["/service/notices", "/more/meet", "/more/privacy"]],
    ] as const) {
      fireEvent.mouseEnter(screen.getByRole("link", { name: label }).closest(".m3-nav-group")!);
      const links = within(container.querySelector<HTMLElement>(".m3-menu")!).getAllByRole("link");
      expect(links.map(link => link.getAttribute("href"))).toEqual(destinations);
      for (const link of links) {
        expect(link.querySelector(".m3-menu-icon svg")).not.toBeNull();
        expect(link.querySelector(".m3-menu-icon")).toHaveAttribute("aria-hidden", "true");
        expect(link).toHaveAccessibleName();
      }
    }
  });

  it("moves the same indicator between variable-width destinations and remeasures resizing", () => {
    const dictionary = getDictionary("ko");
    let campusOffset = 0;
    const linkRects: Record<string, [number, number]> = { "/": [100, 48], "/academic": [154, 76], "/campus": [236, 80], "/more": [322, 72] };
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("m3-desktop-navigation")) return new DOMRect(100, 20, 400, 48);
      if (this.matches("a[data-primary-destination]")) {
        const href = this.getAttribute("href")!;
        const [left, width] = linkRects[href] ?? [0, 0];
        return new DOMRect(left + (href === "/campus" ? campusOffset : 0), 20, width, 48);
      }
      return new DOMRect();
    });
    const { container } = render(<Header />);
    const navigation = container.querySelector(".m3-desktop-navigation")!;
    const indicator = navigation.querySelector<HTMLElement>(".m3-header-active-indicator")!;
    expect(navigation).toHaveAttribute("data-indicator-ready", "true");
    expect(indicator.style.transform).toBe("translate(0px, 0px)");
    expect(indicator.style.width).toBe("48px");
    expect(indicator).toHaveAttribute("data-animate", "false");
    mockedUsePathname.mockReturnValue("/campus/cafeteria");
    fireEvent.mouseEnter(screen.getByRole("link", { name: dictionary.navigation.campus }).closest(".m3-nav-group")!);
    expect(navigation.querySelector(".m3-header-active-indicator")).toBe(indicator);
    expect(indicator.style.transform).toBe("translate(136px, 0px)");
    expect(indicator.style.width).toBe("80px");
    expect(indicator).toHaveAttribute("data-animate", "true");
    campusOffset = 30;
    fireEvent(window, new Event("resize"));
    expect(indicator.style.transform).toBe("translate(166px, 0px)");
  });

  it("supports ArrowDown entry, Escape recovery and localized submenu destinations", async () => {
    mockedUsePathname.mockReturnValue("/en/campus/cafeteria");
    const dictionary = getDictionary("en");
    const { container } = render(<LocaleProvider locale="en"><Header /></LocaleProvider>);
    const academic = screen.getByRole("link", { name: dictionary.navigation.academic });
    act(() => academic.focus());
    fireEvent.keyDown(academic, { key: "ArrowDown" });
    const first = container.querySelector<HTMLAnchorElement>(".m3-menu a")!;
    await waitFor(() => expect(first).toHaveFocus());
    expect(first).toHaveAttribute("href", "/en/academic/announcements");
    fireEvent.keyDown(first, { key: "Escape" });
    expect(academic).toHaveFocus();
    expect(academic).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector(".m3-menu")).toBeNull();
    expect(screen.getByRole("link", { name: dictionary.navigation.campus })).toHaveAttribute("aria-current", "page");
  });

  it("uses the same menu treatment for More and closes when focus leaves the group", () => {
    const dictionary = getDictionary("ko");
    const { container } = render(<Header />);
    const more = screen.getByRole("link", { name: dictionary.navigation.more });
    act(() => more.focus());
    const group = more.closest(".m3-nav-group")!;
    expect(container.querySelector(".m3-menu")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: dictionary.more.menus.meetTitle })).toHaveAttribute("href", "/more/meet");
    fireEvent.blur(group, { relatedTarget: screen.getByRole("link", { name: dictionary.navigation.homepageTitle }) });
    expect(container.querySelector(".m3-menu")).toBeNull();
  });

  it("opens search only on activation and returns focus to the magnifier after closing", async () => {
    const dictionary = getDictionary("ko");
    render(<Header />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: dictionary.search.label });
    fireEvent.click(trigger);
    expect(await screen.findByRole("dialog", { name: "Test search" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close search" }));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps four direct bottom destinations and matches the campus category notice route", () => {
    mockedUsePathname.mockReturnValue("/en/announcements/campus/123");
    const dictionary = getDictionary("en");
    render(<LocaleProvider locale="en"><BottomNav /></LocaleProvider>);
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    const campus = screen.getByRole("link", { name: dictionary.navigation.campus });
    expect(campus).toHaveAttribute("href", "/en/campus");
    expect(campus).toHaveAttribute("aria-current", "page");
    expect(campus.querySelector(".m3-nav-indicator")).toBeInTheDocument();
  });

  it("moves keyboard focus to the matching destination across the 900px navigation breakpoint", async () => {
    const dictionary = getDictionary("ko");
    const { container } = render(<><Header /><BottomNav /></>);
    const desktop = container.querySelector(".m3-desktop-navigation")!;
    const mobile = container.querySelector(".m3-bottom-nav")!;
    const academic = within(desktop as HTMLElement).getByRole("link", { name: dictionary.navigation.academic });
    act(() => academic.focus());
    act(() => breakpointListeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent)));
    await waitFor(() => expect(within(mobile as HTMLElement).getByRole("link", { name: dictionary.navigation.academic })).toHaveFocus());
  });
});
