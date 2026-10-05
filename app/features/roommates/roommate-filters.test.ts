import { describe, expect, it } from "vitest";
import { readRoommateFilterUrl, serializeRoommateFilters } from "./roommate-filters";

describe("roommate URL filters", () => {
  it("restores validated conditions and separates the cursor from reusable filters", () => {
    const state = readRoommateFilterUrl("dorm=eden&roomSize=3&stayStart=2026-10-04&sleepHabits=snoring,talking&cursor=next-page");
    expect(state.filters).toEqual({ dorm: "eden", roomSize: 3, stayStart: "2026-10-04", habits: { sleepHabits: ["snoring", "talking"] } });
    expect(state.cursor).toBe("next-page");
    const changed = serializeRoommateFilters({ ...state.filters, dorm: "sion" });
    expect(changed.get("dorm")).toBe("sion"); expect(changed.has("cursor")).toBe(false);
    expect(readRoommateFilterUrl(changed.toString()).filters).toMatchObject({ dorm: "sion", habits: { sleepHabits: ["snoring", "talking"] } });
  });
  it("does not turn malformed URL input into a valid, unfiltered request", () => {
    for (const query of ["dorm=unknown", "roomSize=7", "stayStart=2026-02-31", "bedtime=unknown", "email=student%40syuin.ac.kr"]) expect(() => readRoommateFilterUrl(query)).toThrow();
    expect(serializeRoommateFilters({}).toString()).toBe("");
  });
});
