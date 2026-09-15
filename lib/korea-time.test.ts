import { describe, expect, it } from "vitest";

import { getKoreaDateTimeParts } from "./korea-time";

describe("getKoreaDateTimeParts", () => {
  it("uses the Korea calendar date regardless of the runtime timezone", () => {
    expect(getKoreaDateTimeParts(new Date("2026-09-14T15:30:00.000Z"))).toEqual({
      year: 2026,
      month: 9,
      date: 15,
      dayOfWeek: 2,
      hour: 0,
      minute: 30,
    });
  });
});
