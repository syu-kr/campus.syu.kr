import { describe, expect, it } from "vitest";
import { createPageMetadata } from "./page-metadata";

describe("page social metadata", () => {
  it.each(["ko", "en"] as const)("keeps page identity and common image together in %s", (locale) => {
    const metadata = createPageMetadata({ title: "시간표 | SYU CAMPUS", description: "강의 시간표를 만들어요", pathname: "/academic/timetable", locale });
    expect(metadata).toMatchObject({
      title: "시간표 | SYU CAMPUS",
      openGraph: {
        type: "website",
        url: `https://campus.syu.kr${locale === "en" ? "/en" : ""}/academic/timetable`,
        locale: locale === "en" ? "en_US" : "ko_KR",
        siteName: "SYU CAMPUS",
        title: "시간표 | SYU CAMPUS",
        description: "강의 시간표를 만들어요",
        images: [{ url: "/images/syu-campus-app-icon-512-m3-smile.png", width: 512, height: 512, alt: "SYU CAMPUS" }],
      },
      twitter: { card: "summary", title: "시간표 | SYU CAMPUS", description: "강의 시간표를 만들어요", images: ["/images/syu-campus-app-icon-512-m3-smile.png"] },
    });
    expect(metadata).not.toHaveProperty("alternates");
    expect(metadata).not.toHaveProperty("robots");
  });

  it("preserves locale paths, page identity and article semantics", () => {
    expect(createPageMetadata({ title: "원문 공지", description: "요약", pathname: "/en/announcements/academic/example?page=2", locale: "en", contentLocale: "ko", type: "article" })).toMatchObject({
      openGraph: { type: "article", locale: "ko_KR", url: "https://campus.syu.kr/en/announcements/academic/example?page=2" },
      twitter: { title: "원문 공지" },
    });
    expect(createPageMetadata({ title: "Home", description: "Home", pathname: "/", locale: "en" }).openGraph).toMatchObject({ url: "https://campus.syu.kr/en" });
  });
});
