import { describe, expect, it } from "vitest";

import * as legacy from "@/lib/i18n";
import { enDictionary } from "./en";
import { koDictionary } from "./ko";
import { createLocalizedAlternates, localizePath, normalizeLocale } from "./routing";

describe("i18n module boundaries", () => {
  it("keeps the existing dictionary objects and routing exports available", () => {
    expect(legacy.getDictionary("ko")).toBe(koDictionary);
    expect(legacy.getDictionary("en")).toBe(enDictionary);
    expect(legacy.localizePath).toBe(localizePath);
    expect(legacy.normalizeLocale).toBe(normalizeLocale);
  });

  it.each([
    ["/academic/timetable?share=abc#grid", "en", "/en/academic/timetable?share=abc#grid"],
    ["/en/academic/timetable?share=abc#grid", "ko", "/academic/timetable?share=abc#grid"],
    ["/en", "ko", "/"],
    ["/", "en", "/en"],
    ["https://example.com/en?lang=ko#target", "ko", "https://example.com/en?lang=ko#target"],
    ["#grid", "en", "#grid"],
  ] as const)("preserves locale routing for %s", (path, locale, expected) => {
    expect(localizePath(path, locale)).toBe(expected);
  });

  it("preserves localized canonical links for the index alias", () => {
    expect(createLocalizedAlternates("/en/index", "en")).toEqual({
      canonical: "/en",
      languages: { ko: "/", en: "/en", "x-default": "/" },
    });
  });
});
