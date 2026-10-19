import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getDictionary, type Locale } from "@/lib/i18n";
import { LocaleProvider, useDictionary, useLocale } from "./LocaleProvider";

function LocaleProbe() {
  const locale = useLocale();
  const dictionary = useDictionary();

  return <output>{locale}: {dictionary.pages.timetable.addCourse}</output>;
}

describe("LocaleProvider", () => {
  it("keeps the Korean default when no provider is present", () => {
    render(<LocaleProbe />);

    expect(screen.getByRole("status")).toHaveTextContent(
      `ko: ${getDictionary("ko").pages.timetable.addCourse}`,
    );
  });

  it("preserves locale changes for existing callers of the wrapper", () => {
    const view = render(<LocaleProvider locale="ko"><LocaleProbe /></LocaleProvider>);

    for (const locale of ["en", "ko"] as const) {
      view.rerender(<LocaleProvider locale={locale}><LocaleProbe /></LocaleProvider>);
      expect(screen.getByRole("status")).toHaveTextContent(
        `${locale}: ${getDictionary(locale).pages.timetable.addCourse}`,
      );
    }
  });

  it.each(["ko", "en"] as const)("renders %s text on the server", (locale) => {
    const html = renderToStaticMarkup(<LocaleProvider locale={locale}><LocaleProbe /></LocaleProvider>);

    expect(html).toContain(getDictionary(locale).pages.timetable.addCourse);
    expect(html).toContain(`${locale}: `);
  });

  it("normalizes an unsupported locale to the existing Korean default", () => {
    render(<LocaleProvider locale={"invalid" as Locale}><LocaleProbe /></LocaleProvider>);

    expect(screen.getByRole("status")).toHaveTextContent(
      `ko: ${getDictionary("ko").pages.timetable.addCourse}`,
    );
  });

});
