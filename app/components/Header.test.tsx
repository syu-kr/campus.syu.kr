import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDictionary } from "@/lib/i18n";
import { getRoommateText } from "@/lib/i18n/roommates";
import { Header } from "./Header";
import { LocaleProvider } from "./LocaleProvider";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ prefetch, ...props }: ComponentProps<"a"> & { prefetch?: boolean }) => {
    void prefetch;
    return <a {...props} />;
  },
  useLinkStatus: () => ({ pending: false }),
}));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));
vi.mock("./WeatherWidget", () => ({ WeatherWidget: () => null }));
vi.mock("./WeatherModal", () => ({ WeatherModal: () => null }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isPending: false, isError: false, refetch: vi.fn() }),
}));

const mockedUsePathname = vi.mocked(usePathname);

describe("Header navigation", () => {
  beforeEach(() => {
    mockedUsePathname.mockReturnValue("/");
  });

  it("keeps home without a back control", () => {
    render(<Header />);

    expect(screen.queryByRole("link", { name: /^뒤로가기/ })).not.toBeInTheDocument();
  });

  it("offers a home return on a top-level section", () => {
    mockedUsePathname.mockReturnValue("/academic");
    render(<Header />);

    expect(screen.getByRole("link", { name: "뒤로가기: 홈" })).toHaveAttribute("href", "/");
  });

  it("returns directly to the parent even without browser history", () => {
    mockedUsePathname.mockReturnValue("/campus/cafeteria");
    render(<Header />);

    expect(screen.getByRole("link", { name: "뒤로가기: 캠퍼스" })).toHaveAttribute("href", "/campus");
  });

  it.each([
    { locale: "ko", path: "/campus/roommates/new", parent: "/campus/roommates", labelKey: "title", label: "룸메이트 구하기" },
    { locale: "ko", path: "/campus/roommates/verify/finish", parent: "/campus/roommates/verify", labelKey: "verifyTitle", label: "학교 이메일로 시작하기" },
    { locale: "en", path: "/en/campus/roommates/new", parent: "/en/campus/roommates", labelKey: "title", label: "Find a roommate" },
    { locale: "en", path: "/en/campus/roommates/verify/finish", parent: "/en/campus/roommates/verify", labelKey: "verifyTitle", label: "Start with your school email" },
  ] as const)("preserves the $locale roommate $labelKey parent label", ({ locale, path, parent, labelKey, label }) => {
    mockedUsePathname.mockReturnValue(path);
    render(<LocaleProvider locale={locale}><Header /></LocaleProvider>);

    expect(getRoommateText(locale)[labelKey]).toBe(label);
    expect(screen.getByRole("link", {
      name: `${getDictionary(locale).navigation.back}: ${label}`,
    })).toHaveAttribute("href", parent);
  });

  it("keeps the language and accessible destination for a shared invitation", () => {
    mockedUsePathname.mockReturnValue("/en/more/meet/invitation");
    render(<LocaleProvider locale="en"><Header /></LocaleProvider>);

    const dictionary = getDictionary("en");
    expect(screen.getByRole("link", {
      name: `${dictionary.navigation.back}: ${dictionary.pages.meet.title}`,
    })).toHaveAttribute("href", "/en/more/meet");
    const navigation = screen.getByRole("navigation", { name: dictionary.navigation.mainNavigation });
    expect(within(navigation).getByRole("link", { name: dictionary.navigation.more })).toHaveAttribute("aria-current", "page");
  });
});
