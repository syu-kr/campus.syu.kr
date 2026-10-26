import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { ClientLocaleProvider } from "./components/LocaleContext";

const request = vi.hoisted(() => ({ locale: "ko", pathname: "/" }));
const announcement = vi.hoisted(() => ({
  id: "example", category: "academic", title: "졸업 서류 제출", content: "원문 본문입니다.", author: "학사지원팀",
  date: "2026-10-24", views: 1, isImportant: false, url: "https://www.syu.ac.kr/example",
  aiSummary: { summary: "졸업 서류를 제출하세요.", target: "졸업 예정자", deadline: "unknown", requiredAction: "서류 제출", keywords: ["졸업"], importance: "normal" },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-syu-locale": request.locale, "x-syu-pathname": request.pathname }) }));
vi.mock("@/lib/server/announcements", () => ({ getAnnouncementById: vi.fn(async () => announcement) }));
vi.mock("@/lib/serviceNotices", () => ({ getAllServiceNotices: vi.fn(async () => []), getServiceNoticeBySlug: vi.fn(async () => ({ title: "서비스 변경", description: "변경 설명" })) }));

beforeEach(() => { request.locale = "ko"; request.pathname = "/"; });

describe("route metadata exports", () => {
  it.each([
    ["/academic", () => import("./academic/page")],
    ["/campus", () => import("./campus/page")],
    ["/announcements", () => import("./announcements/layout")],
    ["/academic/announcements", () => import("./academic/announcements/layout")],
    ["/academic/scholarship", () => import("./academic/scholarship/layout")],
    ["/academic/sw-notices", () => import("./academic/sw-notices/layout")],
    ["/academic/timetable", () => import("./academic/timetable/layout")],
    ["/academic/graduation", () => import("./academic/graduation/layout")],
    ["/academic/competitions", () => import("./academic/competitions/layout")],
    ["/academic/schedule", () => import("./academic/schedule/layout")],
    ["/campus/announcements", () => import("./campus/announcements/layout")],
    ["/campus/bus-info", () => import("./campus/bus-info/layout")],
    ["/campus/cafeteria", () => import("./campus/cafeteria/layout")],
    ["/campus/library", () => import("./campus/library/layout")],
    ["/campus/map", () => import("./campus/map/layout")],
    ["/campus/phone", () => import("./campus/phone/layout")],
    ["/campus/campus-tips", () => import("./campus/campus-tips/layout")],
    ["/campus/gym", () => import("./campus/gym/layout")],
    ["/campus/health-center", () => import("./campus/health-center/layout")],
    ["/more", () => import("./more/layout")],
    ["/more/meet", () => import("./more/meet/layout")],
    ["/more/privacy", () => import("./more/privacy/layout")],
    ["/privacy", () => import("./privacy/page")],
    ["/terms", () => import("./terms/page")],
    ["/service/notices", () => import("./service/notices/page")],
  ] as const)("shares the actual %s page title, description, image and locale", async (pathname, load) => {
    const route = await load();
    for (const locale of ["ko", "en"] as const) {
      request.locale = locale;
      const metadata = await route.generateMetadata();
      expect(metadata.openGraph).toMatchObject({ title: metadata.title, description: metadata.description, url: `https://campus.syu.kr${locale === "en" ? "/en" : ""}${pathname}`, images: [expect.objectContaining({ url: "/images/syu-campus-app-icon-512-m3-smile.png" })] });
      expect(metadata.twitter).toMatchObject({ title: metadata.title, description: metadata.description, images: ["/images/syu-campus-app-icon-512-m3-smile.png"] });
    }
  });

  it("keeps private pages noindex and avoids private room details in social URLs", async () => {
    request.locale = "en";
    const room = await (await import("./more/meet/[roomId]/layout")).generateMetadata();
    expect(room).toMatchObject({ robots: { index: false, follow: false, nocache: true }, openGraph: { url: "https://campus.syu.kr/en/more/meet" } });
    const suggestion = await (await import("./campus/campus-tips/suggest/layout")).generateMetadata();
    expect(suggestion).toMatchObject({ robots: { index: false, follow: true }, openGraph: { images: [expect.any(Object)] } });
  });

  it("keeps Korean announcement source text and schema independent of English UI", async () => {
    request.locale = "en";
    const route = await import("./announcements/[category]/[id]/page");
    const props = { params: Promise.resolve({ category: "academic", id: "example" }) };
    const metadata = await route.generateMetadata(props);
    expect(metadata).toMatchObject({ alternates: { canonical: "/en/announcements/academic/example" }, openGraph: { type: "article", title: `${announcement.title} | SYU CAMPUS`, url: "https://campus.syu.kr/en/announcements/academic/example", images: [expect.any(Object)] }, twitter: { title: `${announcement.title} | SYU CAMPUS` } });
    const element = route.default(props).props.children;
    const document = new DOMParser().parseFromString(renderToStaticMarkup(<ClientLocaleProvider locale="en" dictionary={getDictionary("en")}>{await element.type(element.props)}</ClientLocaleProvider>), "text/html");
    expect(document.querySelector("h1")?.lang).toBe("ko");
    expect(document.querySelector("h1")?.textContent).toBe(announcement.title);
    expect(document.querySelector('div.whitespace-pre-wrap')?.getAttribute("lang")).toBe("ko");
    expect(document.querySelector('div.whitespace-pre-wrap')?.textContent).toBe(announcement.content);
    expect(document.querySelector("h2")?.textContent).toBe(getDictionary("en").pages.announcements.aiInsightTitle);
    const schema = JSON.parse(document.querySelector('#announcement-article-schema')!.textContent!);
    expect(schema).toMatchObject({ inLanguage: "ko-KR", headline: announcement.title });
    expect([...document.querySelectorAll("dd")].find(node => node.textContent === getDictionary("en").labels.aiSummaryDetails.empty)?.getAttribute("lang")).toBe("en");
  });
});
