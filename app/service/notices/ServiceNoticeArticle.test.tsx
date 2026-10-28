import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ServiceNoticeDetail } from "@/lib/serviceNotices";
import { ServiceNoticeArticle } from "./ServiceNoticeArticle";

const translation = vi.hoisted(() => ({
  hook: vi.fn(() => ({ text: (_field: string, original: string) => original, lang: "ko" })),
}));
vi.mock("@/app/components/ContentTranslation", () => ({ useContentTranslation: translation.hook }));
const notice: ServiceNoticeDetail = { id: "019", slug: "019-heading-check", title: "공지 제목", date: "2026-10-27", author: "SYU CAMPUS", content: "" };

beforeEach(() => { translation.hook.mockClear(); });

it.each(["ko", "en"] as const)("preserves Markdown section levels under one article title in %s", locale => {
  const content = "## Section\n\n### Subsection\n\n#### Detail\n\n##### Subdetail\n\n###### Note";
  const { container } = render(<ServiceNoticeArticle notice={{ ...notice, lang: locale, content }} locale={locale}><p>Original metadata</p></ServiceNoticeArticle>);
  expect([...container.querySelectorAll("h1,h2,h3,h4,h5,h6")].map(heading => heading.tagName)).toEqual(["H1", "H2", "H3", "H4", "H5", "H6"]);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(notice.title);
  expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Section");
  expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Subsection");
  expect(screen.getByRole("heading", { name: "Section" }).closest("div")).toHaveAttribute("lang", locale);
  expect(screen.getByText("Original metadata")).toBeInTheDocument();
  if (locale === "en") expect(translation.hook).toHaveBeenCalledWith({ kind: "service-notice", id: notice.slug }, {});
});

it("keeps the article title as the only h1 when Markdown contains its own top heading", () => {
  render(<ServiceNoticeArticle notice={{ ...notice, content: "# Body heading" }} locale="ko">{null}</ServiceNoticeArticle>);
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("heading", { level: 2, name: "Body heading" })).toBeInTheDocument();
});

it("preserves ordered-list starts, localized Markdown links, original metadata and the return URL", () => {
  const content = "## 안내\n\n[지도](/campus/map?building=2026#guide) [학교](https://school.test/original?year=2026#top) `원래코드`\n\n3. 첫 항목\n4. 둘째 항목";
  const { container } = render(<ServiceNoticeArticle notice={{ ...notice, content }} locale="en"><p>원래 작성자 · 2026-10-27</p><a href="/en/service/notices?listPage=2">목록으로 돌아가기</a></ServiceNoticeArticle>);
  expect(screen.getByRole("link", { name: "지도" })).toHaveAttribute("href", "/en/campus/map?building=2026#guide");
  expect(screen.getByRole("link", { name: "학교" })).toHaveAttribute("href", "https://school.test/original?year=2026#top");
  expect(screen.getByRole("link", { name: "목록으로 돌아가기" })).toHaveAttribute("href", "/en/service/notices?listPage=2");
  expect(container.querySelector("ol")).toHaveAttribute("start", "3");
  expect(container.querySelector("code")).toHaveTextContent("원래코드");
  expect(screen.getByText("원래 작성자 · 2026-10-27")).toBeInTheDocument();
});

it.each(["ko", "en"] as const)("nests a Markdown title and its subsections below the page title in %s", locale => {
  const content = "# Body title\n\n## Section\n\n### Subsection\n\n#### Detail\n\n##### Subdetail\n\n###### Note";
  const { container } = render(<ServiceNoticeArticle notice={{ ...notice, lang: locale, content }} locale={locale}>{null}</ServiceNoticeArticle>);
  expect([...container.querySelectorAll("h1,h2,h3,h4,h5,h6")].map(heading => heading.tagName)).toEqual(["H1", "H2", "H3", "H4", "H5", "H6", "H6"]);
  expect(screen.getByRole("heading", { level: 2, name: "Body title" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 3, name: "Section" })).toBeInTheDocument();
});

it("does not mistake a fenced Markdown example for a body title", () => {
  const content = ["```md", "# Example title", "## Example section", "```", "", "## Actual section", "", "### Actual subsection"].join("\n");
  const { container } = render(<ServiceNoticeArticle notice={{ ...notice, content }} locale="ko">{null}</ServiceNoticeArticle>);
  expect([...container.querySelectorAll("h1,h2,h3")].map(heading => heading.tagName)).toEqual(["H1", "H2", "H3"]);
  expect(screen.getByRole("heading", { level: 2, name: "Actual section" })).toBeInTheDocument();
  expect(container.querySelector("pre code")).toHaveTextContent("# Example title");
});

it("also nests Setext-style headings without changing the source content", () => {
  const content = "Body title\n===\n\nChild section\n---";
  render(<ServiceNoticeArticle notice={{ ...notice, content }} locale="ko">{null}</ServiceNoticeArticle>);
  expect(screen.getByRole("heading", { level: 2, name: "Body title" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 3, name: "Child section" })).toBeInTheDocument();
});
