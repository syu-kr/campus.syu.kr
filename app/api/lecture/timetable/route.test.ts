import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("lecture timetable route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T00:00:00Z"));
    process.env.LECTURE_TIMETABLE_URL = "https://example.com/lectures";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    delete process.env.LECTURE_TIMETABLE_URL;
  });

  it("serves the last successful dataset when refresh fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ 과목명: "테스트 강의" }]), {
          headers: { "content-type": "application/json" },
        }),
      )
      .mockRejectedValueOnce(new Error("upstream unavailable"));
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("./route");

    expect((await (await GET()).json()).stale).toBeUndefined();
    vi.advanceTimersByTime(7 * 60 * 60 * 1000);

    const stale = await (await GET()).json();
    expect(stale.success).toBe(true);
    expect(stale.stale).toBe(true);
    expect(stale.data.courses).toHaveLength(1);
  });

  it("rejects an oversized upstream response before reading it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("{}", {
          headers: {
            "content-type": "application/json",
            "content-length": String(9 * 1024 * 1024),
          },
        }),
      ),
    );
    const { GET } = await import("./route");

    const response = await GET();
    expect(response.status).toBe(500);
    expect((await response.json()).success).toBe(false);
  });
});
