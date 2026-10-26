import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { expect, it } from "vitest";
import { markdownTranslationFields, markdownTranslationPlugin } from "./markdown-translation";

it("replaces text leaves while preserving heading/list/emphasis/link/code semantics", () => {
  const markdown = "# 제목\n\n**강조** [학교](https://example.test/한국어?year=2026#top) `원래코드`\n\n1. 목록 123\n\n```js\nconst 값 = 42\n```";
  const fields = markdownTranslationFields(markdown);
  expect(Object.values(fields).join(" ")).not.toMatch(/example\.test|원래코드|const 값|```/);
  const html = renderToStaticMarkup(<ReactMarkdown remarkPlugins={[markdownTranslationPlugin((field, original) => fields[field] ? "EN " + original : original)]}>{markdown}</ReactMarkdown>);
  const doc = new DOMParser().parseFromString(html, "text/html");
  expect(doc.querySelector("h1")?.textContent).toBe("EN 제목");expect(doc.querySelector("strong")?.textContent).toBe("EN 강조");
  expect(decodeURI(doc.querySelector("a")?.getAttribute("href") ?? "")).toBe("https://example.test/한국어?year=2026#top");expect(doc.querySelector("a")?.textContent).toBe("EN 학교");
  expect(doc.querySelector("ol li")?.textContent).toBe("EN 목록 123");expect(doc.querySelector("code")?.textContent).toBe("원래코드");expect(doc.querySelector("pre code")?.textContent).toContain("const 값 = 42");
});
