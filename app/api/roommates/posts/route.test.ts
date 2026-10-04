import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoommateError } from "@/lib/roommates";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), readLimit: vi.fn(), writes: vi.fn(),
  list: vi.fn(), create: vi.fn(), detail: vi.fn(), mine: vi.fn(), mutate: vi.fn(), report: vi.fn(),
}));
vi.mock("@/lib/server/roommate-auth", () => ({
  requireRoommateSession: mocks.session,
  enforceRoommateReadLimit: mocks.readLimit,
  requireRoommateWritesEnabled: mocks.writes,
  enforceRoommateOrigin: (req: Request) => {
    if (req.headers.get("origin") !== new URL(req.url).origin) throw new RoommateError(403, "FORBIDDEN_ORIGIN", "Forbidden origin");
  },
  roommateResponse: (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } }),
  roommateErrorResponse: (error: unknown) => error instanceof RoommateError ? Response.json({ code: error.code, error: error.message }, { status: error.status, headers: { "Cache-Control": "private, no-store" } }) : Response.json({ code: "SERVICE_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "private, no-store" } }),
}));
vi.mock("@/lib/server/roommate-posts", () => ({
  listRoommatePosts: mocks.list, createRoommatePost: mocks.create, getRoommatePost: mocks.detail,
  getMyRoommatePost: mocks.mine, mutateRoommatePost: mocks.mutate, reportRoommatePost: mocks.report,
}));

import { GET, POST } from "./route";
import { GET as mineGET } from "./me/route";
import { GET as detailGET, PATCH, DELETE } from "./[postId]/route";
import { POST as reportPOST } from "./[postId]/reports/route";

const context = { params: Promise.resolve({ postId: "12345678901234567890" }) };
function request(method: string, body?: unknown, origin: string | null = "https://campus.test") {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (origin !== null) headers.origin = origin;
  return new Request("https://campus.test/api/roommates/posts", { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ ownerKey: "server-owner", firebaseUid: "uid", authTime: 1, expiresAt: "2026-11-01T00:00:00Z" });
  mocks.list.mockResolvedValue({ items: [], nextCursor: null });
  mocks.create.mockResolvedValue({ id: "post", version: 1 });
  mocks.detail.mockResolvedValue({ id: "post" });
  mocks.mine.mockResolvedValue({ post: null, holdUntil: null, holdReason: null });
  mocks.mutate.mockResolvedValue({ id: "post", version: 2 });
});

describe("roommate routes authorization and feature boundaries", () => {
  it("authenticates before parsing or returning any protected data", async () => {
    mocks.session.mockRejectedValue(new RoommateError(401, "SESSION_EXPIRED", "Sign in"));
    const routes = [
      () => GET(new Request("https://campus.test/api/roommates/posts?secret=bad")),
      () => POST(request("POST", { invalid: true })),
      () => mineGET(request("GET")),
      () => detailGET(request("GET"), context),
      () => PATCH(request("PATCH", {}), context),
      () => DELETE(request("DELETE", {}), context),
      () => reportPOST(request("POST", {}), context),
    ];
    for (const route of routes) {
      const response = await route();
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.detail).not.toHaveBeenCalled();
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(mocks.report).not.toHaveBeenCalled();
  });

  it.each([null, "null", "https://external.test"])("rejects cookie writes from missing or foreign origins %s", async (origin) => {
    expect((await POST(request("POST", {}, origin))).status).toBe(403);
    expect((await PATCH(request("PATCH", { action: "complete", expectedVersion: 1 }, origin), context)).status).toBe(403);
    expect((await DELETE(request("DELETE", { expectedVersion: 1 }, origin), context)).status).toBe(403);
    expect((await reportPOST(request("POST", { reason: "spam" }, origin), context)).status).toBe(403);
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(mocks.report).not.toHaveBeenCalled();
  });

  it("shares the same owner read limit across listing, personal and detail views", async () => {
    await GET(request("GET"));
    await mineGET(request("GET"));
    await detailGET(request("GET"), context);
    expect(mocks.readLimit).toHaveBeenCalledTimes(3);
    expect(mocks.readLimit.mock.calls.every((args) => args[1] === "server-owner")).toBe(true);
  });

  it("blocks new and edited posts while completion, deletion and reports remain usable", async () => {
    mocks.writes.mockImplementation(() => { throw new RoommateError(503, "WRITES_DISABLED", "Paused"); });
    expect((await POST(request("POST", {}))).status).toBe(503);
    expect((await PATCH(request("PATCH", { action: "update", expectedVersion: 1 },), context)).status).toBe(503);
    expect((await PATCH(request("PATCH", { action: "complete", expectedVersion: 1 }), context)).status).toBe(200);
    expect((await DELETE(request("DELETE", { expectedVersion: 1 }), context)).status).toBe(200);
    expect((await reportPOST(request("POST", { reason: "spam" }), context)).status).toBe(201);
    expect(mocks.mutate).toHaveBeenCalledWith("server-owner", "12345678901234567890", "complete", { action: "complete", expectedVersion: 1 });
  });

  it("propagates whole-feature disablement without calling data access", async () => {
    mocks.session.mockRejectedValue(new RoommateError(503, "FEATURE_DISABLED", "Paused"));
    const response = await GET(request("GET"));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "FEATURE_DISABLED" });
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
