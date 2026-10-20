import { expect, it } from "vitest";
import { getDictionary } from "./i18n";
import { getCategoryLabel } from "./utils";

it.each(["ko", "en"] as const)("uses the supplied %s category labels for notices and schedules", (locale) => {
  const categories = getDictionary(locale).categories;
  expect(getCategoryLabel("academic", categories)).toBe(categories.academic);
  expect(getCategoryLabel("exam", categories)).toBe(categories.exam);
});

it("keeps the existing undefined result for an unrecognized category", () => {
  expect(getCategoryLabel("unknown" as "academic", getDictionary("ko").categories)).toBeUndefined();
});
