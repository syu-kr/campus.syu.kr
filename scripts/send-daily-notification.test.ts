import { afterEach, describe, expect, it, vi } from "vitest";
import { runDailyNotificationJob } from "./send-daily-notification";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("daily notification dry-run", () => {
  it("generates copy without sending FCM or writing Firestore", async () => {
    const stats = [
      {
        category: "academic",
        count: 1,
        titles: ["수강 신청 안내"],
        items: [
          {
            category: "academic",
            title: "수강 신청 안내",
            date: "2026-08-18",
          },
        ],
      },
    ];
    const send = vi.fn();
    const logRecord = vi.fn();
    const buildCopy = vi.fn().mockResolvedValue({
      copy: { title: "새 공지", body: "수강 신청 안내를 확인하세요." },
      source: "openai",
      model: "gpt-5.6-luna",
      promptVersion: "push-notification-v1",
      reason: null,
    });

    const result = await runDailyNotificationJob({
      now: new Date("2026-08-19T00:00:00.000Z"),
      dryRun: true,
      getStats: vi.fn().mockResolvedValue(stats),
      buildCopy,
      send,
      logRecord,
    });

    expect(result.dryRun).toBe(true);
    expect(buildCopy).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
    expect(logRecord).not.toHaveBeenCalled();
  });
});

describe("daily notification delivery failures", () => {
  const stats = [{ category: "academic", count: 1, titles: ["Fixture notice"] }];
  const copy = {
    copy: { title: "Fixture summary", body: "Fixture notice" },
    source: "fallback" as const,
    model: null,
    promptVersion: "push-notification-v1",
    reason: "disabled",
  };

  function deliveryOptions(logRecord: () => Promise<void>) {
    vi.stubEnv("API_URL", "https://fixture.invalid");
    vi.stubEnv("PUSH_API_KEY", "fixture-api-key");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    return {
      now: new Date("2026-10-04T00:00:00Z"),
      dryRun: false,
      getStats: vi.fn().mockResolvedValue(stats),
      buildCopy: vi.fn().mockResolvedValue(copy),
      logRecord,
    };
  }

  it("aborts the POST after its 120-second deadline without retrying or recording success", async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const fetchMock = vi.fn(async (_url, options: RequestInit) =>
      new Promise((_, reject) => {
        options.signal?.addEventListener("abort", () => reject(options.signal?.reason));
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const logRecord = vi.fn(async () => undefined);
    const result = runDailyNotificationJob(deliveryOptions(logRecord)).catch((error) => error);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(timeout).toHaveBeenCalledWith(120_000);
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
    controller.abort(new DOMException("Fixture timeout", "TimeoutError"));

    expect(await result).toMatchObject({ name: "TimeoutError" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(logRecord).not.toHaveBeenCalled();
  });

  it("propagates a failed API response without retrying or recording success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("Fixture failure", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const logRecord = vi.fn(async () => undefined);

    await expect(runDailyNotificationJob(deliveryOptions(logRecord)))
      .rejects.toThrow("API 응답: 503");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(logRecord).not.toHaveBeenCalled();
  });
});
