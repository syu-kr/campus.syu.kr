import { describe, expect, it } from "vitest";

import { synchronizeTimetableScrollTop } from "@/lib/timetable-scroll";

describe("synchronizeTimetableScrollTop", () => {
  it("moves every other timetable to the source scroll position", () => {
    const source = { scrollTop: 420 };
    const second = { scrollTop: 0 };
    const third = { scrollTop: 120 };
    const containers = new Map([
      ["first", source],
      ["second", second],
      ["third", third],
    ]);

    synchronizeTimetableScrollTop("first", source.scrollTop, containers);

    expect(source.scrollTop).toBe(420);
    expect(second.scrollTop).toBe(420);
    expect(third.scrollTop).toBe(420);
  });
});
