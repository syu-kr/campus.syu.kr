import { describe, expect, it } from "vitest";
import { getAnnouncementListMetadata, getAnnouncementListQuery } from "./announcement-list-query";

describe("announcement list URLs", () => {
  it.each([undefined, "", "0", "-2", "NaN", "Infinity"])("normalizes an invalid page %s without changing search text", (page) => {
    expect(getAnnouncementListQuery({ page, search: " 장학 " })).toEqual({ page: 1, query: " 장학 " });
  });
  it("uses the first repeated query and normalizes fractional page inputs", () => {
    expect(getAnnouncementListQuery({ page: ["3.9", "6"], search: ["장학", "취업"] })).toEqual({ page: 3, query: "장학" });
  });
  it("keeps non-search pagination canonical and hreflang URLs distinct", () => {
    expect(getAnnouncementListMetadata("/academic/announcements", { page: "3", lang: "en" }, "en")).toMatchObject({
      alternates: {
        canonical: "/en/academic/announcements?page=3",
        languages: { ko: "/academic/announcements?page=3", en: "/en/academic/announcements?page=3", "x-default": "/academic/announcements?page=3" },
      },
    });
  });
  it("noindexes searches and canonicalizes them to the category list", () => {
    expect(getAnnouncementListMetadata("/campus/announcements", { page: "3", search: "장학" }, "ko")).toMatchObject({
      robots: { index: false, follow: true },
      alternates: { canonical: "/campus/announcements" },
    });
  });
});
