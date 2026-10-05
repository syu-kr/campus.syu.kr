import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/app/components/LocaleProvider";
import PhonePageClient from "@/app/features/phone/PhonePageClient";
import CampusTipsPageClient from "@/app/features/campus-tips/CampusTipsPageClient";
import { getDictionary, type Locale } from "@/lib/i18n";
import type { CampusTip, PhoneNumber } from "@/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/campus/phone", useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/api", () => ({ fetchPhoneNumbers: vi.fn(), fetchCampusTips: vi.fn() }));

const phones: PhoneNumber[] = Array.from({ length: 25 }, (_, index) => ({
  department: `부서${index + 1}`, phone: "02-3399-0000",
}));
const tips: CampusTip[] = Array.from({ length: 25 }, (_, index) => ({
  id: `tip-${index + 1}`, title: `정보${index + 1}`, category: "school",
  contentKind: "official-link", visibility: "default", sortPriority: index,
  url: "https://example.com", tags: [], sourceType: "official", isExternal: true,
}));

describe.each(["ko", "en"] as Locale[])("shared page pagination (%s)", (locale) => {
  it.each(["phone", "campus-tips"])("preserves %s navigation, boundary buttons, active page, and filter reset", (page) => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    client.setQueryData(["campus-tips"], tips);
    const dictionary = getDictionary(locale);
    const { unmount } = render(
      <QueryClientProvider client={client}>
        <LocaleProvider locale={locale}>
          {page === "phone" ? <PhonePageClient initialPhoneNumbers={phones} /> : <CampusTipsPageClient />}
        </LocaleProvider>
      </QueryClientProvider>,
    );
    const navigation = screen.getByRole("navigation", { name: dictionary.pagination.label });
    expect(within(navigation).getByRole("button", { name: dictionary.pagination.previous })).toBeDisabled();
    expect(within(navigation).getByRole("button", { name: "1" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(within(navigation).getByRole("button", { name: "3" }));
    expect(within(navigation).getByRole("button", { name: "3" })).toHaveAttribute("aria-current", "page");
    expect(within(navigation).getByRole("button", { name: dictionary.pagination.next })).toBeDisabled();
    const lastTitle = page === "phone" ? "부서25" : "정보25";
    expect(screen.getByRole("heading", { name: lastTitle })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: dictionary.search.label }), { target: { value: lastTitle } });
    expect(screen.getByRole("heading", { name: lastTitle })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: dictionary.pagination.label })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: dictionary.search.clear }));
    expect(within(screen.getByRole("navigation", { name: dictionary.pagination.label })).getByRole("button", { name: "1" })).toHaveAttribute("aria-current", "page");
    unmount();
    client.clear();
  });
});
