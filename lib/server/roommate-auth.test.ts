import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ records: new Map<string, Record<string, unknown>>(), verify: vi.fn(), getUser: vi.fn(), limiter: vi.fn() }));
vi.mock("@/lib/firebaseAdmin", () => ({ initializeFirebaseAdmin: vi.fn() }));
vi.mock("firebase-admin/auth", () => ({ getAuth: () => ({ verifyIdToken: mocks.verify, getUser: mocks.getUser }) }));
vi.mock("@/lib/server/firestore", () => ({
  admin: { firestore: { Timestamp } },
  getFirestore: () => ({ collection: (name: string) => ({ doc: (id: string) => ({
    set: async (value: Record<string, unknown>) => { mocks.records.set(`${name}/${id}`, value); },
    get: async () => ({ data: () => mocks.records.get(`${name}/${id}`) }),
    delete: async () => { mocks.records.delete(`${name}/${id}`); },
  }) }) }),
}));
vi.mock("@/lib/server/http", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/server/http")>(), enforceRateLimitKey: mocks.limiter }));

import {
  ROOMMATE_SESSION_COOKIE, enforceRoommateOrigin, getRoommateOwnerKey, getRoommateSessionExpiry,
  isRoommateUserValid, issueRoommateSession, normalizeSchoolEmail, requireRoommateSession,
  revokeRoommateSession, requestRoommateEmailLink, roommateErrorResponse, validateRoommateIdentity,
} from "./roommate-auth";
import { RoommateError } from "@/lib/roommates";
import { POST as issueSession } from "@/app/api/roommates/auth/session/route";
import { POST as sendLink } from "@/app/api/roommates/auth/request-link/route";
import { POST as logout } from "@/app/api/roommates/auth/logout/route";

const NOW = Date.parse("2026-10-04T06:00:00Z");
function identity(overrides = {}) {
  return { uid: "student-uid", email: "student@syuin.ac.kr", email_verified: true, auth_time: Math.floor(NOW / 1000), aud: "test-project", ...overrides };
}
function request(token = "", path = "session") {
  return new Request(`http://localhost:3000/api/roommates/auth/${path}`, { headers: { cookie: `${ROOMMATE_SESSION_COOKIE}=${token}` } });
}
function jsonRequest(path: string, body: unknown, origin = "http://localhost:3000") {
  return new Request(`http://localhost:3000/api/roommates/auth/${path}`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(NOW);
  vi.stubEnv("ROOMMATES_ENABLED", "true"); vi.stubEnv("ROOMMATES_EMAIL_ENABLED", "true");
  vi.stubEnv("ROOMMATES_OWNER_KEY_SECRET", "test-only-owner-secret-at-least-32-characters");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "test-project"); vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "public-test-key");
  mocks.records.clear(); mocks.verify.mockReset(); mocks.getUser.mockReset(); mocks.limiter.mockReset();
  mocks.verify.mockResolvedValue(identity());
  mocks.getUser.mockResolvedValue({ uid: "student-uid", email: "student@syuin.ac.kr", emailVerified: true, disabled: false });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("roommate school identity and fixed sessions", () => {
  it("accepts chosen student IDs, normalizes case, rejects similar and staff domains", () => {
    expect(normalizeSchoolEmail(" Chosen.Name@SYUIN.AC.KR ")).toBe("chosen.name@syuin.ac.kr");
    for (const value of ["user@syu.ac.kr", "user@syuin.ac.kr.evil", "user@gmail.com", "user@@syuin.ac.kr", "@syuin.ac.kr"]) expect(() => normalizeSchoolEmail(value)).toThrow();
    expect(getRoommateOwnerKey("STUDENT@SYUIN.AC.KR")).toBe(getRoommateOwnerKey("student@syuin.ac.kr"));
  });
  it("requires verified project identity and authentication within five minutes", () => {
    for (const overrides of [{ email_verified: false }, { uid: "" }, { aud: "other-project" }, { email: "admin@syu.ac.kr" }, { auth_time: Math.floor(NOW / 1000) - 301 }]) {
      expect(() => validateRoommateIdentity(identity(overrides))).toThrow();
    }
    expect(validateRoommateIdentity(identity()).email).toBe("student@syuin.ac.kr");
  });
  it("anchors 30-day and 12-hour expiry to original auth time, stores only a token hash", async () => {
    const authTime = Math.floor(NOW / 1000) - 120;
    mocks.verify.mockResolvedValue(identity({ auth_time: authTime }));
    const first = await issueRoommateSession("verified-id-token", true);
    vi.setSystemTime(NOW + 60_000);
    const replay = await issueRoommateSession("verified-id-token", true);
    expect(first.expiresAt).toBe(replay.expiresAt);
    expect(Date.parse(first.expiresAt)).toBe(authTime * 1000 + 30 * 86_400_000);
    expect(getRoommateSessionExpiry(authTime, false)).toBe(authTime * 1000 + 12 * 3_600_000);
    expect(mocks.verify).toHaveBeenCalledWith("verified-id-token", true);
    const serialized = JSON.stringify([...mocks.records]);
    expect(serialized).not.toContain(first.token);
    expect(serialized).not.toContain("verified-id-token");
    expect(serialized).not.toContain("student@syuin.ac.kr");
    expect(mocks.records.has(`roommate_sessions/${createHash("sha256").update(first.token).digest("hex")}`)).toBe(true);
  });
  it("checks current Firebase user every request and rejects changes and revocation", async () => {
    const { token } = await issueRoommateSession("verified", true);
    const session = await requireRoommateSession(request(token));
    expect(mocks.getUser).toHaveBeenCalledWith("student-uid");
    for (const user of [{ email: "other@syuin.ac.kr", emailVerified: true }, { email: "student@syuin.ac.kr", emailVerified: false }, { email: "student@syuin.ac.kr", emailVerified: true, disabled: true }, { email: "student@syuin.ac.kr", emailVerified: true, tokensValidAfterTime: new Date(NOW + 1000).toUTCString() }]) expect(isRoommateUserValid({ disabled: false, ...user }, session)).toBe(false);
    mocks.getUser.mockRejectedValue({ code: "auth/user-not-found" });
    await expect(requireRoommateSession(request(token))).rejects.toMatchObject({ status: 401 });
    mocks.getUser.mockRejectedValue(new Error("network private details"));
    await expect(requireRoommateSession(request(token))).rejects.toMatchObject({ status: 503 });
  });
  it("rejects missing, malformed, expired and revoked sessions", async () => {
    await expect(requireRoommateSession(request())).rejects.toMatchObject({ status: 401 });
    const { token, expiresAt } = await issueRoommateSession("verified", true);
    await revokeRoommateSession(request(token));
    await expect(requireRoommateSession(request(token))).rejects.toMatchObject({ status: 401 });
    const short = await issueRoommateSession("verified", false);
    vi.setSystemTime(Date.parse(short.expiresAt));
    await expect(requireRoommateSession(request(short.token))).rejects.toMatchObject({ status: 401 });
    expect(Date.parse(expiresAt)).toBeGreaterThan(Date.now());
  });
  it("fails closed on flags and missing owner configuration; hides unknown error details", async () => {
    vi.stubEnv("ROOMMATES_ENABLED", "false");
    await expect(issueRoommateSession("verified", true)).rejects.toMatchObject({ code: "FEATURE_DISABLED" });
    vi.stubEnv("ROOMMATES_ENABLED", "true"); vi.stubEnv("ROOMMATES_OWNER_KEY_SECRET", "");
    await expect(issueRoommateSession("verified", true)).rejects.toMatchObject({ status: 503 });
    const response = roommateErrorResponse(new Error("student@syuin.ac.kr secret-token"));
    expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain("secret-token");
  });
});

describe("roommate native email API and origin boundary", () => {
  it("preserves the real loopback origin when NextRequest normalizes the hostname", async () => {
    const req = new NextRequest("http://127.0.0.1:3000/api/roommates/auth/request-link", {
      headers: { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" },
    });
    expect(new URL(req.url).hostname).toBe("localhost");
    expect(() => enforceRoommateOrigin(req)).not.toThrow();
    const fetch = vi.fn().mockResolvedValue(new Response("{}")); vi.stubGlobal("fetch", fetch);
    await requestRoommateEmailLink(req, "student@syuin.ac.kr", "ko");
    expect(JSON.parse(fetch.mock.calls[0][1].body).continueUrl).toBe("http://127.0.0.1:3000/campus/roommates/verify/finish");
    const rejectedHeaders: Record<string, string>[] = [
      { origin: "http://127.0.0.1:3001", host: "127.0.0.1:3000" },
      { origin: "http://127.0.0.1:3000", host: "evil.test", "x-forwarded-host": "127.0.0.1:3000" },
      { origin: "http://localhost:3000", host: "127.0.0.1:3000" },
    ];
    for (const headers of rejectedHeaders) expect(() => enforceRoommateOrigin(new NextRequest(req.url, { headers }))).toThrow();
  });
  it("rejects missing, null and mismatched Origin while ignoring attacker forwarded-host", () => {
    for (const origin of [undefined, "null", "https://evil.test"]) {
      const req = new Request("https://campus.syu.kr/api/roommates/auth/session", { headers: origin ? { origin } : {} });
      expect(() => enforceRoommateOrigin(req)).toThrow();
    }
    expect(() => enforceRoommateOrigin(new Request("https://campus.syu.kr/api/roommates/auth/session", { headers: { origin: "https://campus.syu.kr", "x-forwarded-host": "evil.test" } }))).not.toThrow();
  });
  it("uses native EMAIL_SIGNIN, a fixed locale finish URL and account/IP counters", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 })); vi.stubGlobal("fetch", fetch);
    await requestRoommateEmailLink(request(), "Student@syuin.ac.kr", "en");
    const [url, init] = fetch.mock.calls[0];
    expect(url).toContain("accounts:sendOobCode");
    expect(JSON.parse(init.body)).toEqual({ requestType: "EMAIL_SIGNIN", email: "student@syuin.ac.kr", continueUrl: "http://localhost:3000/en/campus/roommates/verify/finish", canHandleCodeInApp: true });
    expect(mocks.limiter.mock.calls).toHaveLength(4);
    expect(mocks.limiter.mock.calls[1][1]).toMatchObject({ fixedWindow: false, windowMs: 60_000 });
    expect(JSON.stringify(mocks.limiter.mock.calls)).not.toContain("student@syuin.ac.kr");
  });
  it("reports provider quota and timeout honestly without retrying or returning an OOB link", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "QUOTA_EXCEEDED" } }), { status: 400 })); vi.stubGlobal("fetch", fetch);
    await expect(requestRoommateEmailLink(request(), "student@syuin.ac.kr", "ko")).rejects.toMatchObject({ code: "EMAIL_PROVIDER_LIMIT" });
    expect(fetch).toHaveBeenCalledTimes(1);
    fetch.mockRejectedValue(new Error("timeout secret"));
    await expect(requestRoommateEmailLink(request(), "student@syuin.ac.kr", "ko")).rejects.toMatchObject({ code: "EMAIL_UNAVAILABLE" });
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.stubEnv("ROOMMATES_EMAIL_ENABLED", "false");
    await expect(requestRoommateEmailLink(request(), "student@syuin.ac.kr", "ko")).rejects.toMatchObject({ code: "EMAIL_DISABLED" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("issues a secure host cookie and permits logout when the feature is disabled", async () => {
    const response = await issueSession(jsonRequest("session", { idToken: "verified", remember: true }));
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain(`${ROOMMATE_SESSION_COOKIE}=`);
    expect(cookie).toContain("HttpOnly"); expect(cookie).toContain("Secure"); expect(cookie).toContain("SameSite=lax"); expect(cookie).not.toContain("Domain=");
    expect(await response.json()).toEqual({ expiresAt: new Date(NOW + 30 * 86_400_000).toISOString(), sessionTag: expect.stringMatching(/^[a-f0-9]{64}$/) });
    vi.stubEnv("ROOMMATES_ENABLED", "false");
    const out = await logout(new Request("http://localhost:3000/api/roommates/auth/logout", { method: "POST", headers: { origin: "http://localhost:3000", cookie: cookie.split(";")[0] } }));
    expect(out.status).toBe(200); expect(mocks.records.size).toBe(0); expect(out.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  it("rejects caller-provided completion URLs and returns no email or token in send response", async () => {
    const invalid = await sendLink(jsonRequest("request-link", { email: "student@syuin.ac.kr", locale: "ko", continueUrl: "https://evil.test" }));
    expect(invalid.status).toBe(400);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
    const sent = await sendLink(jsonRequest("request-link", { email: "student@syuin.ac.kr", locale: "ko" }));
    expect(await sent.json()).toEqual({ sent: true }); expect(sent.headers.get("cache-control")).toBe("private, no-store");
    const error = roommateErrorResponse(new RoommateError(429, "RATE_LIMITED", "17초 후 다시 시도해주세요."));
    expect(error.headers.get("retry-after")).toBe("17");
    expect((await error.json()).retryAt).toBe(new Date(NOW + 17_000).toISOString());
  });
});
