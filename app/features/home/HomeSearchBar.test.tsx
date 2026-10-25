import { fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientLocaleProvider } from "@/app/components/LocaleContext";
import { HomePageSkeleton } from "@/app/components/PageLoadingSkeletons";
import { getDictionary } from "@/lib/i18n";
import { HomeSearchBar } from "./HomeSearchBar";

const navigation = vi.hoisted(() => ({
  push: vi.fn(), pathname: "/", params: new URLSearchParams(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.params,
}));

beforeEach(() => {
  navigation.push.mockReset();
  navigation.params = new URLSearchParams();
});

describe.each(["ko", "en"] as const)("independent home search for %s", (locale) => {
  it("shows matching service links before submitting a notice search", () => {
    navigation.pathname = locale === "en" ? "/en" : "/";
    render(<ClientLocaleProvider locale={locale} dictionary={getDictionary(locale)}><HomeSearchBar /></ClientLocaleProvider>);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "시간표" } });
    expect(screen.getByRole("link", { name: /시간표|Timetable/ })).toHaveAttribute("href", `${locale === "en" ? "/en" : ""}/academic/timetable`);
    expect(navigation.push).not.toHaveBeenCalled();
    fireEvent.submit(screen.getByRole("search"));
    expect(navigation.push).toHaveBeenCalledOnce();
  });
  it("renders and submits while the dashboard is still loading without a query provider", () => {
    navigation.pathname = locale === "en" ? "/en" : "/";
    navigation.params = new URLSearchParams("mode=preview&tag=a&tag=b");
    const dictionary = getDictionary(locale);
    render(
      <ClientLocaleProvider locale={locale} dictionary={dictionary}>
        <HomeSearchBar />
        <HomePageSkeleton />
      </ClientLocaleProvider>,
    );

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getByText("SYU CAMPUS")).toHaveClass("sr-only");
    fireEvent.change(screen.getByRole("textbox", { name: dictionary.search.label }), { target: { value: "  library  " } });
    fireEvent.submit(screen.getByRole("search"));
    expect(navigation.push).toHaveBeenLastCalledWith(`${navigation.pathname}?mode=preview&tag=a&tag=b&search=library`);
    fireEvent.click(screen.getByRole("button", { name: dictionary.search.clear }));
    expect(navigation.push).toHaveBeenLastCalledWith(`${navigation.pathname}?mode=preview&tag=a&tag=b`);
  });

  it("server renders the search before any dashboard data is available", () => {
    navigation.pathname = locale === "en" ? "/en" : "/";
    const html = renderToString(
      <ClientLocaleProvider locale={locale} dictionary={getDictionary(locale)}>
        <HomeSearchBar />
      </ClientLocaleProvider>,
    );
    expect(html).toContain('role="search"');
    expect(html).toContain("SYU CAMPUS");
    expect(html).toContain(getDictionary(locale).search.defaultPlaceholder);
  });

  it("leaves the results search to the dashboard and returns after clearing or navigating back", () => {
    navigation.params = new URLSearchParams("search=library&mode=preview");
    const view = (
      <ClientLocaleProvider locale={locale} dictionary={getDictionary(locale)}>
        <HomeSearchBar />
      </ClientLocaleProvider>
    );
    const { rerender } = render(view);
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();

    navigation.params = new URLSearchParams("mode=preview");
    rerender(
      <ClientLocaleProvider locale={locale} dictionary={getDictionary(locale)}>
        <HomeSearchBar />
      </ClientLocaleProvider>,
    );
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(navigation.push).not.toHaveBeenCalled();
  });
});
