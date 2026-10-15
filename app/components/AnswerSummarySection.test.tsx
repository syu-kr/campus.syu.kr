import { renderToStaticMarkup } from "react-dom/server";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { AnswerSummary } from "@/types";
import { getDictionary, type Locale } from "@/lib/i18n";
import { LocaleProvider } from "./LocaleProvider";
import { AnswerSummarySection } from "./AnswerSummarySection";

const source = { name: "학교 원문", url: "https://www.syu.ac.kr/academic/major-schedule/", checkedAt: "2026-10-14T01:00:00Z" };
const summary: AnswerSummary = {
  eyebrow: "요약", title: "일정 요약", question: "오늘 일정은 무엇인가요?", answer: "오늘은 시험이 있습니다.", source: "학교 일정",
};
const basisAt = "2026-10-15T00:00:00Z";
const props = { summary, sources: [source], schemaId: "test-answer", path: "/academic/schedule", basisAt, nonce: "test-nonce" };

it.each(["ko", "en"] as const)("server renders the same visible answer, source citation, locale URL and real timestamp in %s", (locale: Locale) => {
  const html = renderToStaticMarkup(<LocaleProvider locale={locale}><AnswerSummarySection {...props} /></LocaleProvider>);
  const document = new DOMParser().parseFromString(html, "text/html");
  const schema = JSON.parse(document.querySelector("#test-answer")!.textContent!);
  expect(document.querySelector("h2")?.textContent).toBe(summary.title);
  expect(document.querySelector("[data-answer-text]")?.textContent).toBe(schema.mainEntity[0].acceptedAnswer.text);
  expect(schema.mainEntity[0].name).toBe(summary.question);
  expect(schema.mainEntity[0].acceptedAnswer.citation).toEqual([source.url]);
  expect(schema.url).toBe(`https://campus.syu.kr${locale === "en" ? "/en" : ""}/academic/schedule`);
  expect(document.querySelector("time")?.getAttribute("datetime")).toBe(source.checkedAt);
  expect(document.querySelector("#test-answer")?.getAttribute("nonce")).toBe("test-nonce");
  expect(html).toContain(getDictionary(locale).answerSummary.basisLabel);
  expect(html).toContain(getDictionary(locale).answerSummary.unofficialNotice);
});

it("updates visible answer and JSON-LD together when the same source snapshot changes", () => {
  const { container, rerender } = render(<AnswerSummarySection {...props} />);
  const nextSummary = { ...summary, answer: "오늘은 등록 기간입니다." };
  const checkedAt = "2026-10-14T23:30:00Z";
  rerender(<AnswerSummarySection {...props} summary={nextSummary} sources={[{ ...source, checkedAt }]} />);
  const schema = JSON.parse(container.querySelector("#test-answer")!.textContent!);
  expect(screen.getByText(nextSummary.answer)).toBeInTheDocument();
  expect(screen.queryByText(summary.answer)).not.toBeInTheDocument();
  expect(schema.mainEntity[0].acceptedAnswer.text).toBe(nextSummary.answer);
  expect(container.querySelector("time")).toHaveAttribute("datetime", checkedAt);
  expect(container.querySelectorAll("script#test-answer")).toHaveLength(1);
});

it.each([null, "invalid", "2026-10-14T12:00:00", "2026-10-16T00:00:00Z"])("does not invent confirmation for missing, invalid, timezone-less or future timestamps (%s)", (checkedAt) => {
  const { container } = render(<AnswerSummarySection {...props} sources={[{ ...source, checkedAt }]} />);
  expect(screen.getByText(new RegExp(getDictionary("ko").answerSummary.unknownCheckedAt))).toBeInTheDocument();
  expect(container.querySelectorAll("time")).toHaveLength(1);
  expect(container.querySelector("time")).toHaveAttribute("datetime", basisAt);
});

it("keeps unsafe links and markup out of navigable citations and executable HTML", () => {
  const unsafeAnswer = "</script><img src=x onerror=alert(1)>";
  const { container } = render(<AnswerSummarySection {...props} summary={{ ...summary, answer: unsafeAnswer }} sources={[{ name: "잘못된 주소", url: "javascript:alert(1)" }]} />);
  expect(container.querySelector("a")).toBeNull();
  expect(container.querySelector("img")).toBeNull();
  expect(screen.getByText(unsafeAnswer)).toBeInTheDocument();
  const schema = JSON.parse(container.querySelector("#test-answer")!.textContent!);
  expect(schema.mainEntity[0].acceptedAnswer.text).toBe(unsafeAnswer);
  expect(schema.mainEntity[0].acceptedAnswer.citation).toBeUndefined();
});
