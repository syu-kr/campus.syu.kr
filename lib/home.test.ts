import { describe, expect, it } from "vitest";

import { isFestivalPromotionVisible } from "./home";

describe("festival promotion", () => {
  it("shows through the festival day and expires afterward", () => {
    expect(isFestivalPromotionVisible("2026-09-27")).toBe(false);
    expect(isFestivalPromotionVisible("2026-09-28")).toBe(true);
    expect(isFestivalPromotionVisible("2026-10-06")).toBe(true);
    expect(isFestivalPromotionVisible("2026-10-07")).toBe(false);
  });
});
