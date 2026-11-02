import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ collection: vi.fn() }));
vi.mock("@/lib/server/admin-auth", async (original) => ({
  ...await original<typeof import("@/lib/server/admin-auth")>(),
  requireAdmin: vi.fn(async () => ({ uid: "admin-test" })),
}));
vi.mock("@/lib/server/firestore", () => ({ getFirestore: () => ({ collection: mocks.collection }) }));
import {
  GET,
  encodeSubmissionCursor,
  readSubmissionCursor,
  type SubmissionCursor,
} from "./route";

beforeEach(() => { mocks.collection.mockReset(); });

it.each([
  ["pending", true, 10], ["all", true, 12],
  ["pending", false, 2], ["all", false, 2],
] as const)("keeps totals and cursors for %s (includeCounts=%s, aggregates=%s)", async (status, includeCounts, expectedAggregates) => {
  const aggregates: string[] = [];
  const reads: string[] = [];
  mocks.collection.mockImplementation((name: string) => {
    let filter = "all";
    const query = {
      where: (_field: string, _operator: string, value: string) => { filter = value; return query; },
      orderBy: () => query, limit: () => query, startAfter: () => query,
      get: async () => {
        reads.push(name);
        const data = { status: "pending", created_at: { toDate: () => new Date(name === "site_inquiries" ? "2026-07-25T03:00:00Z" : "2026-07-25T02:00:00Z") } };
        return { docs: [{ id: `${name}_item`, data: () => data, get: (field: keyof typeof data) => data[field] }] };
      },
      count: () => ({ get: async () => {
        aggregates.push(`${name}:${filter}`);
        const count = filter === "all" ? (name === "site_inquiries" ? 7 : 11)
          : filter === "pending" ? (name === "site_inquiries" ? 2 : 3) : 0;
        return { data: () => ({ count }) };
      } }),
    };
    return query;
  });
  const cursor = encodeSubmissionCursor({ inquiry: { createdAt: "2026-07-26T00:00:00.000Z", id: "previous" } });
  const response = await GET(new NextRequest(`https://campus.test/api/admin/submissions?kind=all&status=${status}&page=2&limit=2&cursor=${cursor}${includeCounts ? "" : "&includeCounts=false"}`));
  expect(response.status).toBe(200);
  const page = await response.json();
  expect(page.pagination.total).toBe(status === "all" ? 18 : 5);
  expect(page.pagination.totalPages).toBe(status === "all" ? 9 : 3);
  expect(page.pagination.hasNext).toBe(true);
  expect(readSubmissionCursor(page.pagination.nextCursor)).toEqual({
    inquiry: { createdAt: "2026-07-25T03:00:00.000Z", id: "site_inquiries_item" },
    campusTip: { createdAt: "2026-07-25T02:00:00.000Z", id: "campus_tip_suggestions_item" },
  });
  expect(reads).toEqual(["site_inquiries", "campus_tip_suggestions"]);
  expect(aggregates).toHaveLength(expectedAggregates);
  if (includeCounts) expect(page.counts.pending).toBe(5);
  else expect(page).not.toHaveProperty("counts");
  if (status === "pending" || includeCounts) {
    expect(aggregates.filter((key) => key.endsWith(":pending"))).toEqual(["site_inquiries:pending", "campus_tip_suggestions:pending"]);
  }
});

describe("admin submission pagination cursor", () => {
  it("round-trips independent collection positions", () => {
    const cursor: SubmissionCursor = {
      inquiry: {
        createdAt: "2026-07-25T01:00:00.000Z",
        id: "inquiry_1",
      },
      campusTip: {
        createdAt: "2026-07-24T02:00:00.000Z",
        id: "tip_1",
      },
    };

    expect(readSubmissionCursor(encodeSubmissionCursor(cursor))).toEqual(
      cursor,
    );
  });

  it("rejects a malformed cursor instead of restarting from page one", () => {
    expect(() => readSubmissionCursor("not-a-valid-cursor")).toThrow(
      "페이지 커서가 올바르지 않습니다",
    );
  });

  it("rejects cursor document identifiers outside the Firestore id contract", () => {
    const invalidCursor = Buffer.from(
      JSON.stringify({
        inquiry: {
          createdAt: "2026-07-25T01:00:00.000Z",
          id: "invalid/id",
        },
      }),
      "utf8",
    ).toString("base64url");

    expect(() => readSubmissionCursor(invalidCursor)).toThrow(
      "페이지 커서가 올바르지 않습니다",
    );
  });
});
