import { describe, expect, it, vi } from "vitest";
import { runDailyNotificationJob } from "./send-daily-notification";

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
