import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { LocaleProvider } from "./LocaleProvider";
import { LiveDataStatusBadge } from "./LiveDataStatusBadge";

it.each(["ko", "en"] as const)("can omit the source while retaining live status and the update time in %s", (locale) => {
  const text = getDictionary(locale).liveData;
  const props = { locale, timestamp: new Date(2026, 9, 6, 22, 15), sourceStatus: "stale" as const };
  const view = render(<LocaleProvider locale={locale}>
    <LiveDataStatusBadge {...props} sourceLabel="SYU Shuttle" />
  </LocaleProvider>);

  expect(screen.getByText(`${text.source}: SYU Shuttle`)).toBeInTheDocument();
  expect(screen.getByText("|")).toBeInTheDocument();
  view.rerender(<LocaleProvider locale={locale}><LiveDataStatusBadge {...props} /></LocaleProvider>);

  expect(screen.getByText(text.statuses.stale)).toBeInTheDocument();
  expect(screen.getByText(new RegExp(text.updated))).toHaveTextContent("10:15");
  expect(screen.queryByText(`${text.source}: SYU Shuttle`)).not.toBeInTheDocument();
  expect(screen.queryByText("|")).not.toBeInTheDocument();
});

it.each(["ko", "en"] as const)("hides normal live-data status and metadata in %s", (locale) => {
  const { container, rerender } = render(<LocaleProvider locale={locale}>
    <LiveDataStatusBadge locale={locale} sourceStatus="fresh" timestamp="2026-10-26T00:00:00Z" sourceLabel="Live source" />
  </LocaleProvider>);
  expect(container).toBeEmptyDOMElement();
  rerender(<LocaleProvider locale={locale}><LiveDataStatusBadge locale={locale} /></LocaleProvider>);
  expect(container).toBeEmptyDOMElement();
});

it.each(["ko", "en"] as const)("keeps stale and error information visible in %s", (locale) => {
  const text = getDictionary(locale).liveData;
  const { rerender } = render(<LocaleProvider locale={locale}>
    <LiveDataStatusBadge locale={locale} sourceStatus="fresh" stale timestamp="2026-10-26T00:00:00Z" />
  </LocaleProvider>);
  expect(screen.getByText(text.statuses.stale)).toBeInTheDocument();
  expect(screen.getByText(new RegExp(text.updated))).toBeInTheDocument();
  rerender(<LocaleProvider locale={locale}>
    <LiveDataStatusBadge locale={locale} sourceStatus="error" stale timestamp="2026-10-26T00:00:00Z" />
  </LocaleProvider>);
  expect(screen.getByText(text.statuses.error)).toBeInTheDocument();
  expect(screen.queryByText(text.statuses.stale)).not.toBeInTheDocument();
});
