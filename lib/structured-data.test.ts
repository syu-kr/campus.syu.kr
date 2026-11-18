import { expect, it } from "vitest";
import { createArticleSchema, serializeJsonLd } from "./structured-data";

const article = { authorName: "학사지원팀", description: "공개 공지 본문", headline: "졸업 서류 제출", inLanguage: "ko-KR", url: "https://campus.syu.kr/announcements/academic/example" };

it("identifies the original announcement without inventing source or modification dates", () => {
  expect(createArticleSchema({ ...article, sourceUrl: "https://www.syu.ac.kr/example" }))
    .toMatchObject({ url: article.url, isBasedOn: "https://www.syu.ac.kr/example" });
  const withoutSource = createArticleSchema(article);
  expect(withoutSource).not.toHaveProperty("isBasedOn");
  expect(withoutSource).not.toHaveProperty("datePublished");
  expect(withoutSource).not.toHaveProperty("dateModified");
});

it("keeps source text from breaking out of a JSON-LD script", () => {
  const serialized = serializeJsonLd(createArticleSchema({ ...article, headline: "</script><script>alert('x')</script>" }));
  expect(serialized).not.toContain("<");
  expect(JSON.parse(serialized).headline).toBe("</script><script>alert('x')</script>");
});
