import { beforeEach, expect, it, vi } from "vitest";
import CompetitionsPage, { generateMetadata as competitionMetadata } from "./academic/competitions/page";
import CampusTipsPage, { generateMetadata as tipsMetadata } from "./campus/campus-tips/page";
import { getCompetitionPage } from "@/lib/server/competitions";
import { readFile } from "node:fs/promises";

vi.mock("next/headers", () => ({ headers: async () => ({ get: () => "en" }) }));
vi.mock("@/lib/server/competitions", () => ({ getCompetitionPage: vi.fn() }));
vi.mock("node:fs/promises", async importOriginal => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  const readFile = vi.fn();
  return { ...actual, readFile, default: { ...actual, readFile } };
});

beforeEach(() => {
  vi.mocked(getCompetitionPage).mockReset().mockResolvedValue({ items: [], page: 2, limit: 10, total: 21, totalPages: 3 });
  vi.mocked(readFile).mockReset().mockResolvedValue("[]");
});

it("loads competition data directly from its existing server reader using only validated original filters", async () => {
  const page = await CompetitionsPage({ searchParams: Promise.resolve({ source: "department", status: "result", search: "장학", page: "2" }) });
  expect(getCompetitionPage).toHaveBeenCalledWith({ source: "department", status: "result", query: "장학", page: 2, limit: 10 });
  expect(page.props.initialPage.page).toBe(2);
  expect(page.props.initialQuery).toEqual({ source: "department", status: "result", query: "장학", page: 2 });
});

it("keeps the original API's 100-code-unit search limit while retaining the full input for restoration", async () => {
  const search = "학".repeat(101);
  const page = await CompetitionsPage({ searchParams: Promise.resolve({ search, page: "2" }) });
  expect(getCompetitionPage).toHaveBeenCalledWith({ source: "all", status: "open", query: search.slice(0, 100), page: 2, limit: 10 });
  expect(page.props.initialQuery.query).toBe(search);
});

it("passes the existing local tips snapshot and retains browser retry when the source is unreadable", async () => {
  expect((await CampusTipsPage()).props.initialTips).toEqual([]);
  expect(readFile).toHaveBeenCalledWith(expect.stringMatching(/public[\\/]data[\\/]campus-tips\.json$/), "utf8");
  vi.mocked(readFile).mockRejectedValueOnce(new Error("unavailable"));
  expect((await CampusTipsPage()).props.initialTips).toBeUndefined();
});

it("keeps default page metadata self-canonical including OG while search/filter variants are noindex", async () => {
  const defaultPage = await competitionMetadata({ searchParams: Promise.resolve({ status: "open", source: "all", page: "2" }) });
  expect(defaultPage.alternates?.canonical).toBe("/en/academic/competitions?page=2");
  expect(defaultPage.openGraph?.url).toBe("https://campus.syu.kr/en/academic/competitions?page=2");
  expect(defaultPage.robots).toBeUndefined();
  expect(await competitionMetadata({ searchParams: Promise.resolve({ source: "department", page: "2" }) }))
    .toMatchObject({ robots: { index: false, follow: true }, alternates: { canonical: "/en/academic/competitions" } });
  expect(await tipsMetadata({ searchParams: Promise.resolve({ search: "기숙사", page: "2" }) }))
    .toMatchObject({ robots: { index: false, follow: true }, alternates: { canonical: "/en/campus/campus-tips" } });
  expect(await tipsMetadata({ searchParams: Promise.resolve({ view: "campus-tips", category: "all", page: "3" }) }))
    .toMatchObject({ alternates: { canonical: "/en/campus/campus-tips?page=3" } });
});

it("redirects an out-of-range competition page to the last valid page with the same filters and unrelated query", async () => {
  await expect(CompetitionsPage({ searchParams: Promise.resolve({ source: "department", status: "result", search: "장학", page: "999", lang: "en", extra: ["a", "b"] }) }))
    .rejects.toMatchObject({ digest: expect.stringContaining("/en/academic/competitions?source=department&status=result&search=%EC%9E%A5%ED%95%99&page=3&lang=en&extra=a&extra=b") });
});

it("normalizes unavailable tip categories and page bounds with the same filtering rules before SSR", async () => {
  vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify([{ id: "study", title: "후기", category: "reference", contentKind: "study-review",
    sourceType: "official", url: "https://example.test/study", tags: [], isExternal: true }]));
  await expect(CampusTipsPage({ searchParams: Promise.resolve({ view: "study", category: "finance", page: "999", lang: "en" }) }))
    .rejects.toMatchObject({ digest: expect.stringContaining("/en/campus/campus-tips?view=study&lang=en") });
  await expect(CampusTipsPage({ searchParams: Promise.resolve({ search: "no-results", page: "999", extra: "keep" }) }))
    .rejects.toMatchObject({ digest: expect.stringContaining("/en/campus/campus-tips?search=no-results&extra=keep") });
});
