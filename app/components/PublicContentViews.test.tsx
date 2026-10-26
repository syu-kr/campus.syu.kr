import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { Announcement, CampusTip, CompetitionAnnouncement } from "@/types";
import type { ContentTranslationSource, PublicContentFields } from "@/lib/content-translation";
import { getDictionary } from "@/lib/i18n";
import { markdownTranslationFields } from "@/lib/markdown-translation";
import { ClientLocaleProvider } from "./LocaleContext";
import { AnnouncementCard } from "./AnnouncementCard";
import { SearchResultCard } from "./SearchResultCard";
import { ServiceNoticeCard } from "./HomeNoticeCard";
import { ManagedBanners } from "./ManagedBanners";
import { AnnouncementDetailArticle } from "@/app/announcements/AnnouncementDetailArticle";
import { ServiceNoticeRow } from "@/app/service/notices/ServiceNoticeRow";
import { ServiceNoticeArticle } from "@/app/service/notices/ServiceNoticeArticle";
import { CompetitionsPageClient } from "@/app/features/academic/CompetitionsPageClient";
import CampusTipsPage from "@/app/features/campus-tips/CampusTipsPageClient";

const state = vi.hoisted(() => ({ path: "/en/academic/competitions", fields: {} as PublicContentFields, calls: [] as { source: ContentTranslationSource; original: PublicContentFields }[], tips: [] as CampusTip[], competitions: [] as CompetitionAnnouncement[] }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => state.path, useSearchParams: () => new URLSearchParams() }));
vi.mock("@tanstack/react-query", () => ({ useQuery: ({ queryKey }: { queryKey: string[] }) => ({ data: queryKey[0] === "campus-tips" ? state.tips : { items: state.competitions, total: state.competitions.length, totalPages: 1 }, isLoading: false, isError: false, refetch: vi.fn() }) }));
vi.mock("@/app/features/campus-tips/CampusTipSuggestionForm", () => ({ CampusTipSuggestionForm: () => null }));
vi.mock("@/app/components/ContentTranslation", () => {
 const translate = (source: ContentTranslationSource, original: PublicContentFields) => {
  state.calls.push({ source, original });
  return { text: (field: string, fallback: string) => Object.hasOwn(original, field) ? state.fields[field] ?? fallback : fallback, lang: "en-x-mtfrom-ko", translated: true, controls: null };
 };
 return { useContentTranslation: translate, PublicContentTranslation: ({ source, content, children }: { source: ContentTranslationSource; content: PublicContentFields; children: (translation: ReturnType<typeof translate>) => ReactNode }) => children(translate(source, content)) };
});

const notice: Announcement = { id: "published-notice", category: "academic", title: "공지 제목", content: "공개 본문 123", date: "2026-10-26", author: "원래 작성자", views: 123, isImportant: false, url: "https://school.test/original?q=2026", aiSummary: { summary: "요약", target: "재학생", deadline: "2026-10-31", requiredAction: "제출", keywords: ["신청"], importance: "normal", confidence: "high", generatedAt: "2026-10-26", sourceHash: "hash" } };
function english(children: ReactNode) { return render(<ClientLocaleProvider locale="en" dictionary={getDictionary("en")}>{children}</ClientLocaleProvider>); }
beforeEach(() => { state.calls = [];state.tips = [];state.competitions = [];state.path = "/en/academic/competitions";state.fields = { title: "Translated title", excerpt: "Translated excerpt", "contentParts.0": "Public body 123", "aiSummary.summary": "Translated summary", "aiSummary.target": "Students", "aiSummary.requiredAction": "Submit", "aiSummary.keywords.0": "Application" }; });

it("replaces notice heading, accessible link name and AI fields in their original card positions", () => {
  const { container } = english(<AnnouncementCard announcement={notice} href={notice.url} external />);
  expect(screen.getByRole("heading", { name: "Translated title" })).toHaveAttribute("lang", "en-x-mtfrom-ko");
  expect(screen.getByRole("link", { name: /Translated title/ })).toHaveAttribute("href", notice.url);
  expect(screen.getByText("Translated summary")).toBeInTheDocument();expect(screen.getByText("Submit")).toBeInTheDocument();
  expect(screen.getByText("2026-10-31")).toBeInTheDocument();expect(screen.getByText("원래 작성자")).toBeInTheDocument();
  expect(screen.queryByText("공지 제목")).toBeNull();expect(screen.queryByRole("button", { name: /translate|original/i })).toBeNull();
  expect(container.querySelector(".m3-public-translation,.m3-translated-content")).toBeNull();
});

it("replaces search excerpts without AI while keeping the original destination and byline", () => {
  english(<SearchResultCard item={{ ...notice, aiSummary: undefined }} />);
  expect(screen.getByRole("heading", { name: "Translated title" })).toBeInTheDocument();expect(screen.getByText("Public body 123")).toBeInTheDocument();
  expect(screen.queryByText("공개 본문 123")).toBeNull();expect(screen.getByRole("link")).toHaveAttribute("href", notice.url);
  expect(state.calls[0].original.author).toBeUndefined();expect(state.calls[0].original.date).toBeUndefined();
});

it("replaces schedule and phone descriptions but preserves dates and telephone values", () => {
  state.fields = { title: "Midterm exams", description: "Public description", department: "Academic Affairs" };
  english(<><SearchResultCard item={{ id: "exam", title: "중간고사", description: "설명", startDate: "2026-10-20", endDate: "2026-10-26", category: "exam" }} /><SearchResultCard item={{ department: "학사지원팀", description: "설명", phone: "02-3399-1234" }} /></>);
  expect(screen.getByRole("heading", { name: "Midterm exams" })).toBeInTheDocument();expect(screen.getByRole("heading", { name: "Academic Affairs" })).toBeInTheDocument();
  expect(screen.getByText("02-3399-1234")).toBeInTheDocument();expect(screen.getByRole("link", { name: /Midterm exams/ })).toHaveAttribute("href", "/en/academic/schedule");
  expect(screen.queryByText("학사지원팀")).toBeNull();
});

it("replaces service notice copy inside its existing link and skips reviewed English", () => {
  const service = { id: "019", slug: "019-source", title: "공지 제목", excerpt: "서비스 소개", date: "2026-10-26", author: "원래 작성자", lang: "ko" as const };
  const { rerender } = english(<ServiceNoticeCard notice={service} />);
  expect(screen.getByRole("heading", { name: "Translated title" })).toBeInTheDocument();expect(screen.getByText("Translated excerpt")).toBeInTheDocument();expect(screen.getByRole("link")).toHaveAttribute("href", "/en/service/notices/019-source");
  rerender(<ClientLocaleProvider locale="en" dictionary={getDictionary("en")}><ServiceNoticeCard notice={{ ...service, lang: "en", title: "Reviewed English", excerpt: "Reviewed introduction" }} /></ClientLocaleProvider>);
  expect(screen.getByRole("heading", { name: "Reviewed English" })).toHaveAttribute("lang", "en");expect(state.calls.at(-1)?.original).toEqual({});
});

it("keeps service row date, author and list-return URL while replacing its two text fields", () => {
  english(<ol><ServiceNoticeRow notice={{ id: "019", slug: "019-source", title: "공지 제목", excerpt: "서비스 소개", date: "2026-10-26", author: "원래 작성자" }} href="/en/service/notices/019-source?listPage=2" date="10/26/2026" dateLabel="Date" /></ol>);
  expect(screen.getByRole("heading", { name: "Translated title" })).toBeInTheDocument();expect(screen.getByText("Translated excerpt")).toBeInTheDocument();expect(screen.getByText("원래 작성자")).toHaveAttribute("translate", "no");
  expect(screen.getByRole("link")).toHaveAttribute("href", "/en/service/notices/019-source?listPage=2");expect(screen.getByText("10/26/2026")).toHaveAttribute("datetime", "2026-10-26");
});

it("replaces Markdown text leaves while preserving code, emphasis, links and server metadata", () => {
  const content = "# 안내\n\n**중요** [원문](https://school.test/원본?year=2026) `원래코드`";
  const fields = markdownTranslationFields(content);
  for (const [field, original] of Object.entries(fields)) state.fields[field] = original === "안내" ? "Guide" : original === "중요" ? "Important" : original === "원문" ? "Source" : original;
  const { container } = english(<ServiceNoticeArticle notice={{ id: "019", slug: "019-source", title: "공지 제목", date: "2026-10-26", author: "작성자", content }} locale="en"><p>Original metadata 2026</p></ServiceNoticeArticle>);
  expect(screen.getByRole("heading", { level: 1, name: "Translated title" })).toBeInTheDocument();expect(screen.getByRole("heading", { level: 2, name: "Guide" })).toBeInTheDocument();
  expect(decodeURI(screen.getByRole("link", { name: "Source" }).getAttribute("href") ?? "")).toBe("https://school.test/원본?year=2026");expect(container.querySelector("strong")?.textContent).toBe("Important");expect(container.querySelector("code")?.textContent).toBe("원래코드");
  expect(screen.getByText("Original metadata 2026")).toBeInTheDocument();expect(Object.values(state.calls.at(-1)!.original).join(" ")).not.toMatch(/school\.test|원래코드|Original metadata/);
});

it("replaces the announcement detail title, body and AI while keeping original source and numbers", () => {
  english(<AnnouncementDetailArticle announcement={notice} locale="en" />);
  expect(screen.getByRole("heading", { level: 1, name: "Translated title" })).toBeInTheDocument();expect(screen.getByText("Public body 123")).toBeInTheDocument();expect(screen.getByText("Translated summary")).toBeInTheDocument();
  expect(screen.getByText("Students")).toBeInTheDocument();expect(screen.getByText("Submit")).toBeInTheDocument();expect(screen.getByRole("link", { name: getDictionary("en").pages.announcements.originalLink })).toHaveAttribute("href", notice.url);
  expect(screen.getByText("원래 작성자")).toBeInTheDocument();expect(screen.getByText("123")).toBeInTheDocument();expect(screen.queryByText("공지 제목")).toBeNull();
});

it("replaces banner heading, description and alt in place without changing its sponsored link", () => {
  state.fields = { title: "Campus event", description: "Join the event", imageAlt: "Event poster" };
  english(<ManagedBanners initialNow={Date.now()} placement="home" initialBanners={[{ kind: "banner", id: "banner-public", revision: 2, category: "ad", placement: "home", title: "행사", description: "참여하세요", imageAlt: "행사 포스터", imageDesktop: "/api/content-media/11111111-1111-4111-8111-111111111111", imageMobile: "", link: "https://school.test/event?q=2026", priority: 1, dismissible: true, startsAt: null, endsAt: null }]} />);
  expect(screen.getByRole("heading", { name: "Campus event" })).toBeInTheDocument();expect(screen.getByText("Join the event")).toBeInTheDocument();expect(screen.getByAltText("Event poster")).toBeInTheDocument();
  expect(screen.getByRole("link")).toHaveAttribute("href", "https://school.test/event?q=2026");expect(screen.getByRole("link")).toHaveAttribute("rel", expect.stringContaining("sponsored"));expect(screen.queryByText("행사")).toBeNull();
});

it("replaces competition preview inside the existing card without changing source labels or URL", () => {
  state.competitions = [{ ...notice, id: "competition", sourceCategory: "event", competitionStatus: "open", competitionKind: "contest", matchedKeywords: [] }];
  const { container } = english(<CompetitionsPageClient />);
  expect(screen.getByRole("heading", { name: "Translated title" })).toBeInTheDocument();expect(screen.getByText("Public body 123")).toBeInTheDocument();expect(screen.getByText("Translated summary")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Translated title/ })).toHaveAttribute("href", notice.url);expect(screen.getByText("원래 작성자")).toBeInTheDocument();expect(container.querySelector(".m3-public-translation")).toBeNull();
});

it("replaces tip title, explanation, note, tags and link label inside the original card", () => {
  state.path = "/en/campus/campus-tips";state.fields = { title: "Tip title", description: "Tip explanation", note: "Check first", "tags.0": "Campus", urlLabel: "Open guide" };
  state.tips = [{ id: "tip-public", title: "꿀팁", description: "설명", note: "확인하세요", category: "school", contentKind: "official-link", url: "https://school.test/guide?q=2026", urlLabel: "안내 보기", tags: ["학교"], sourceType: "official", isExternal: true }];
  const { container } = english(<CampusTipsPage />);
  expect(screen.getByRole("heading", { name: "Tip title" })).toBeInTheDocument();expect(screen.getByText("Tip explanation")).toBeInTheDocument();expect(screen.getByText("Check first")).toBeInTheDocument();expect(screen.getByText("#Campus")).toBeInTheDocument();expect(screen.getByText("Open guide")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Tip title/ })).toHaveAttribute("href", "https://school.test/guide?q=2026");expect(screen.queryByText("꿀팁")).toBeNull();expect(container.querySelector(".m3-public-translation,.m3-translated-content")).toBeNull();
});
