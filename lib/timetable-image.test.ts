import { describe, expect, it } from "vitest";

import { getTimetableImageFilename } from "@/lib/timetable-image";

describe("getTimetableImageFilename", () => {
  it("includes normalized semester and local download date", () => {
    expect(
      getTimetableImageFilename("2026", "2 학기", new Date(2026, 7, 4)),
    ).toBe("syu-campus-timetable-2026-2-학기-2026-08-04.png");
  });

  it("falls back to the date when semester metadata is unavailable", () => {
    expect(
      getTimetableImageFilename(undefined, null, new Date(2026, 7, 4)),
    ).toBe("syu-campus-timetable-2026-08-04.png");
  });
});
