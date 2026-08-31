import { describe, expect, it } from "vitest";

import { timeToMinutes } from "./shuttle-schedule";

describe("timeToMinutes", () => {
  it("parses valid times and rejects invalid ranges", () => {
    expect(timeToMinutes("08:05")).toBe(485);
    expect(timeToMinutes("24:00")).toBeNull();
    expect(timeToMinutes("08:60")).toBeNull();
    expect(timeToMinutes("invalid")).toBeNull();
  });
});
