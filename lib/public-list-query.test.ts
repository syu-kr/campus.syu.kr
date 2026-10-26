import { expect, it } from "vitest";
import { getCampusTipsListQuery, getCompetitionListQuery, getPublicListMetadata, replaceListParams } from "./public-list-query";

it("accepts only original list options and preserves the first repeated search and valid page", () => {
  expect(getCompetitionListQuery({ source: "department", status: "result", search: [" 장학 ", "other"], page: "3.8" }))
    .toEqual({ source: "department", status: "result", query: " 장학 ", page: 3 });
  expect(getCompetitionListQuery({ source: "__proto__", status: "unknown", page: "Infinity" }))
    .toEqual({ source: "all", status: "open", query: "", page: 1 });
  expect(getCampusTipsListQuery({ view: "study", category: "reference", page: "2" }))
    .toEqual({ view: "study", category: "reference", query: "", page: 2 });
  expect(getCampusTipsListQuery({ view: "other", category: "other", page: "-1" }))
    .toEqual({ view: "campus-tips", category: "all", query: "", page: 1 });
});

it("normalizes only requested list values while keeping unrelated repeated query fields", () => {
  expect(replaceListParams({ page: "999", category: "finance", view: "study", extra: ["a", "b"] }, { page: undefined, category: undefined }))
    .toBe("?view=study&extra=a&extra=b");
});

it("makes unfiltered pages self-canonical and marks search/filter variants noindex in both languages", () => {
  expect(getPublicListMetadata("/academic/competitions", 3, false, "en")).toMatchObject({
    alternates: { canonical: "/en/academic/competitions?page=3", languages: { ko: "/academic/competitions?page=3" } },
  });
  expect(getPublicListMetadata("/campus/campus-tips", 3, true, "ko")).toMatchObject({
    robots: { index: false, follow: true }, alternates: { canonical: "/campus/campus-tips" },
  });
});
