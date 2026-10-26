import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import Page, { generateMetadata } from "./page";
import DetailPage, { generateMetadata as detailMetadata } from "./[slug]/page";
import { getAllServiceNotices, getServiceNoticeBySlug, type ServiceNotice } from "@/lib/serviceNotices";

const request = vi.hoisted(() => ({ locale: "ko" }));
vi.mock("next/headers", () => ({ headers: async () => ({ get: () => request.locale }) }));
vi.mock("@/lib/serviceNotices", () => ({ getAllServiceNotices: vi.fn(), getServiceNoticeBySlug: vi.fn() }));
vi.mock("./ServiceNoticePagination", () => ({ ServiceNoticePagination: ({ currentPage, totalPages }: { currentPage: number; totalPages: number }) =>
  totalPages > 1 ? <nav data-current={currentPage} data-total={totalPages} /> : null }));

const notices: ServiceNotice[] = Array.from({ length: 19 }, (_, index) => ({
  id: String(19 - index), slug: `notice-${19 - index}`, title: `서비스 소식 ${19 - index}`, date: `2026-10-${String(26 - index).padStart(2, "0")}`,
  author: "SYU KR", excerpt: `서비스 안내 ${19 - index}`,
}));

beforeEach(() => {
  request.locale = "ko";
  vi.mocked(getAllServiceNotices).mockReset().mockResolvedValue(notices);
  vi.mocked(getServiceNoticeBySlug).mockReset().mockResolvedValue({ ...notices[10], description: "공개 설명", content: "# 서비스 본문" });
});

it("renders ten newest notices in the existing order with meaningful headings, dates and detail destinations", async () => {
  const html = renderToStaticMarkup(await Page());
  const doc = new DOMParser().parseFromString(html, "text/html");
  const rows = [...doc.querySelectorAll(".service-notice-row")];
  expect(rows).toHaveLength(10);
  expect(rows[0].getAttribute("href")).toBe("/service/notices/notice-19");
  expect(rows[9].getAttribute("href")).toBe("/service/notices/notice-10");
  expect(doc.querySelector("h1")?.textContent).toBe("서비스 공지");
  expect(doc.querySelector("h2")?.getAttribute("lang")).toBe("ko");
  expect(doc.querySelector("time")?.getAttribute("datetime")).toBe("2026-10-26");
  expect(doc.querySelector('nav[data-current="1"][data-total="2"]')).not.toBeNull();
  expect(getAllServiceNotices).toHaveBeenCalledWith("ko");
});

it("renders the remaining nine notices on the English second page with list-return context", async () => {
  request.locale = "en";
  const doc = new DOMParser().parseFromString(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ page: "2" }) })), "text/html");
  const rows = [...doc.querySelectorAll(".service-notice-row")];
  expect(rows).toHaveLength(9);
  expect(rows[0].getAttribute("href")).toBe("/en/service/notices/notice-9?listPage=2");
  expect(rows[8].getAttribute("href")).toBe("/en/service/notices/notice-1?listPage=2");
  expect(doc.querySelector("h1")?.textContent).toBe("Service Notices");
  expect(doc.querySelector("h2")?.getAttribute("lang")).toBe("ko");
  expect(getAllServiceNotices).toHaveBeenCalledWith("en");
});

it.each(["0", "-1", "NaN", "Infinity", "1", "1.8"])("normalizes the invalid/noncanonical page %s without dropping unrelated repeated query", async page => {
  await expect(Page({ searchParams: Promise.resolve({ page, extra: ["a", "b"] }) }))
    .rejects.toMatchObject({ digest: expect.stringContaining("/service/notices?extra=a&extra=b") });
});

it("redirects past the last page to the actual last page and hides pagination for an empty list", async () => {
  request.locale = "en";
  await expect(Page({ searchParams: Promise.resolve({ page: "999", extra: "keep" }) }))
    .rejects.toMatchObject({ digest: expect.stringContaining("/en/service/notices?page=2&extra=keep") });
  vi.mocked(getAllServiceNotices).mockResolvedValue([]);
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain("There are no service notices yet.");
  expect(html).not.toContain("data-current");
});

it("keeps page-specific canonical, language alternates and OG/Twitter metadata", async () => {
  request.locale = "en";
  expect(await generateMetadata({ searchParams: Promise.resolve({ page: "2", extra: "ignored-for-canonical" }) })).toMatchObject({
    alternates: { canonical: "/en/service/notices?page=2", languages: { ko: "/service/notices?page=2" } },
    openGraph: { url: "https://campus.syu.kr/en/service/notices?page=2", title: "Service Notices", images: [expect.any(Object)] },
    twitter: { title: "Service Notices" },
  });
});

it("returns to page two from the detail while its canonical remains the unparameterized article", async () => {
  request.locale = "en";
  const props = { params: Promise.resolve({ slug: "notice-9" }), searchParams: Promise.resolve({ listPage: "2" }) };
  const doc = new DOMParser().parseFromString(renderToStaticMarkup(await DetailPage(props)), "text/html");
  expect([...doc.querySelectorAll("a")].find(a => a.textContent?.includes("Back to list"))?.getAttribute("href")).toBe("/en/service/notices?page=2");
  expect(doc.querySelector("h1")?.getAttribute("lang")).toBe("ko");
  expect(await detailMetadata(props)).toMatchObject({ openGraph: { url: "https://campus.syu.kr/en/service/notices/notice-9" } });
  expect(getServiceNoticeBySlug).toHaveBeenCalledWith("notice-9", "en");
  vi.mocked(getServiceNoticeBySlug).mockResolvedValue(null);
  await expect(DetailPage({ ...props, searchParams: Promise.resolve({ listPage: "https://example.test" }) })).rejects.toMatchObject({ digest: expect.stringContaining("404") });
});

it("uses the English notice's declared source language while keeping Korean navigation and list-return context", async () => {
  const english = { ...notices[0], slug: "012-english-version-beta", title: "English Version Now Available", excerpt: "Hello from SYU CAMPUS.", lang: "en" as const };
  vi.mocked(getAllServiceNotices).mockResolvedValue([english]);
  vi.mocked(getServiceNoticeBySlug).mockResolvedValue({ ...english, content: "Hello from SYU CAMPUS." });
  const list = new DOMParser().parseFromString(renderToStaticMarkup(await Page()), "text/html");
  expect(list.querySelector("h1")?.textContent).toBe("서비스 공지");
  expect(list.querySelector("h2")?.getAttribute("lang")).toBe("en");
  expect(list.querySelector(".service-notice-excerpt")?.getAttribute("lang")).toBe("en");
  const props = { params: Promise.resolve({ slug: english.slug }), searchParams: Promise.resolve({ listPage: "2" }) };
  const detail = new DOMParser().parseFromString(renderToStaticMarkup(await DetailPage(props)), "text/html");
  expect(detail.querySelector("h1")?.getAttribute("lang")).toBe("en");
  expect(detail.querySelector("div.prose")?.getAttribute("lang")).toBe("en");
  expect([...detail.querySelectorAll("a")].find(a => a.textContent?.includes("목록으로 돌아가기"))?.getAttribute("href")).toBe("/service/notices?page=2");
  expect(await detailMetadata(props)).toMatchObject({ openGraph: { locale: "en_US", url: "https://campus.syu.kr/service/notices/012-english-version-beta" }, twitter: { title: english.title } });
});
