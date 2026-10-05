import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearRateLimitBuckets } from "@/lib/rate-limit";
import { GET as readTimetableShare } from "@/app/api/lecture/timetable/shares/[shareId]/route";
import { GET as readMeetRoom } from "@/app/api/meet/rooms/[roomId]/route";

const { getFirestore, getDocument } = vi.hoisted(() => {
  const getDocument = vi.fn().mockResolvedValue({ exists: false });
  const getFirestore = vi.fn(() => ({
    collection: () => ({ doc: () => ({ get: getDocument }) }),
  }));
  return { getFirestore, getDocument };
});

vi.mock("@/lib/server/firestore", () => ({
  admin: {},
  getFirestore,
  timestampToIso: vi.fn(),
}));

beforeEach(() => {
  clearRateLimitBuckets();
  getFirestore.mockClear();
  getDocument.mockClear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-04T00:00:00Z"));
});

afterEach(() => {
  clearRateLimitBuckets();
  vi.useRealTimers();
});

describe("public share reads", () => {
  it.each([
    {
      name: "timetable shares",
      read: (req: NextRequest, id: string) =>
        readTimetableShare(req, { params: Promise.resolve({ shareId: id }) }),
    },
    {
      name: "meet rooms",
      read: (req: NextRequest, id: string) =>
        readMeetRoom(req, { params: Promise.resolve({ roomId: id }) }),
    },
  ])("limits changing IDs before database access for $name", async ({ read }) => {
    const request = new NextRequest("https://campus.syu.kr/api/share", {
      headers: { "x-vercel-forwarded-for": "192.0.2.1" },
    });

    for (let index = 0; index < 120; index += 1) {
      const response = await read(request, `audit-room-${index}`);
      expect(response.status).toBe(404);
    }

    const blocked = await read(request, "another-room-id");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBe("60");
    expect((await blocked.json()).code).toBe("RATE_LIMITED");
    expect(getFirestore).toHaveBeenCalledTimes(120);
    expect(getDocument).toHaveBeenCalledTimes(120);

    const otherRequester = new NextRequest(request.url, {
      headers: { "x-vercel-forwarded-for": "192.0.2.2" },
    });
    expect((await read(otherRequester, "another-room-id")).status).toBe(404);

    vi.advanceTimersByTime(60 * 1000);
    expect((await read(request, "another-room-id")).status).toBe(404);
  });
});
