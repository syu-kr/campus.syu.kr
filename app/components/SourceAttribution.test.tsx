import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { LocaleProvider } from "./LocaleProvider";
import { SourceAttribution } from "./SourceAttribution";

it.each(["ko", "en"] as const)("shows source links in a footer without answer or checking timestamps in %s", (locale) => {
  const text = getDictionary(locale).answerSummary;
  const source = { name: "학교 원문", url: "https://www.syu.ac.kr/academic/major-schedule/", checkedAt: "2026-10-14T01:00:00Z", note: "참고 안내" };
  const { container } = render(<LocaleProvider locale={locale}><SourceAttribution sources={[source]} /></LocaleProvider>);

  const link = screen.getByRole("link", { name: source.name });
  expect(link).toHaveAttribute("href", source.url);
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
  expect(link.closest("footer")).not.toBeNull();
  expect(screen.getByRole("list", { name: text.sourceLabel })).toContainElement(link);
  expect(screen.getByText(source.note)).toBeVisible();
  expect(screen.queryByText(text.basisLabel, { exact: false })).not.toBeInTheDocument();
  expect(screen.queryByText(text.checkedAtLabel, { exact: false })).not.toBeInTheDocument();
  expect(container.querySelector("time, script, h2")).toBeNull();
});

it.each(["javascript:alert(1)", "http://example.com", "invalid"])("keeps unsafe source URLs out of navigable links: %s", (url) => {
  const name = "</script><img src=x onerror=alert(1)>";
  const { container } = render(<SourceAttribution sources={[{ name, url }]} />);
  expect(screen.getByText(name)).toBeVisible();
  expect(container.querySelector("a, img, script")).toBeNull();
});
