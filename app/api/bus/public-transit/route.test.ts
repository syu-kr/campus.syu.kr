import { describe, expect, it } from "vitest";
import { resolveTransitTimestamp } from "@/lib/server/transit-cache";

describe("resolveTransitTimestamp", () => {
  const cachedTimestamp = "2026-07-13T01:00:00.000Z";
  const currentTimestamp = "2026-07-13T01:01:00.000Z";

  it("keeps the cached timestamp when a cached route is preserved", () => {
    expect(
      resolveTransitTimestamp(true, cachedTimestamp, currentTimestamp),
    ).toBe(cachedTimestamp);
  });

  it("uses the current timestamp for fully fresh data", () => {
    expect(
      resolveTransitTimestamp(false, cachedTimestamp, currentTimestamp),
    ).toBe(currentTimestamp);
  });
});
