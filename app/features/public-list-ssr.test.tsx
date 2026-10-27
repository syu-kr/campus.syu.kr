import { renderToStaticMarkup } from "react-dom/server";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CompetitionsPageClient } from "./academic/CompetitionsPageClient";
import CampusTipsPage from "./campus-tips/CampusTipsPageClient";
import { fetchCampusTips, fetchCompetitionPage } from "@/lib/api";
import { getCompetitionListQuery } from "@/lib/public-list-query";
import type { CampusTip, CompetitionPageResponse } from "@/types";

const route = vi.hoisted(() => ({ pathname: "/academic/competitions" }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/api", () => ({ fetchCompetitionPage: vi.fn(), fetchCampusTips: vi.fn() }));
vi.mock("./campus-tips/CampusTipSuggestionForm", () => ({ CampusTipSuggestionForm: () => null }));

const competitionPage: CompetitionPageResponse = {
  items: [{ id: "server-competition", title: "서버 공모전", content: "본문", category: "academic", sourceCategory: "academic",
    competitionStatus: "open", competitionKind: "contest", matchedKeywords: [], date: "2026-10-26", author: "학교", views: 0,
    isImportant: false, url: "https://example.test/competition" }],
  page: 2, limit: 10, total: 21, totalPages: 3,
};
const tips: CampusTip[] = Array.from({ length: 13 }, (_, index) => ({
  id: `tip-${index}`, title: `서버 꿀팁 ${index}`, category: "school", contentKind: "official-link", sourceType: "official",
  url: `https://example.test/tip-${index}`, tags: [], isExternal: true,
}));
let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(fetchCompetitionPage).mockReset().mockImplementation(() => new Promise(() => {}));
  vi.mocked(fetchCampusTips).mockReset().mockImplementation(() => new Promise(() => {}));
});
afterEach(() => client.clear());

it("SSR-renders the exact competition page, original destination and crawlable pages without a duplicate browser request", () => {
  route.pathname = "/academic/competitions";
  window.history.replaceState(null, "", `${route.pathname}?page=2`);
  const page = <QueryClientProvider client={client}><CompetitionsPageClient initialPage={competitionPage} initialQuery={getCompetitionListQuery({ page: "2" })} /></QueryClientProvider>;
  const html = renderToStaticMarkup(page);
  expect(html).toContain("서버 공모전");
  expect(html).toContain('href="https://example.test/competition"');
  expect(html).toContain('href="/academic/competitions?page=3"');
  render(page);
  expect(screen.getByText("서버 공모전")).toBeInTheDocument();
  expect(fetchCompetitionPage).not.toHaveBeenCalled();
});

it("SSR-renders the filtered tip page using original options and does not immediately refetch its fresh snapshot", () => {
  route.pathname = "/campus/campus-tips";
  window.history.replaceState(null, "", `${route.pathname}?category=school&page=2`);
  const page = <QueryClientProvider client={client}><CampusTipsPage initialTips={tips} /></QueryClientProvider>;
  const html = renderToStaticMarkup(page);
  expect(html).toContain("서버 꿀팁");
  expect(html).toContain('href="/campus/campus-tips?category=school"');
  render(page);
  expect(screen.getAllByRole("link").some(link => link.getAttribute("href")?.startsWith("https://example.test/tip-"))).toBe(true);
  expect(fetchCampusTips).not.toHaveBeenCalled();
});
