import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminAuthorizationFailure, requireAdmin } from "./admin-auth";

const mocks = vi.hoisted(() => ({ verify: vi.fn(), initialize: vi.fn() }));
vi.mock("@/lib/firebaseAdmin", () => ({ initializeFirebaseAdmin: mocks.initialize }));
vi.mock("firebase-admin/auth", () => ({ getAuth: () => ({ verifyIdToken: mocks.verify }) }));

const identity = { uid: "Admin-UID", email: "admin@example.com", email_verified: false };
const allowedUids = [identity.uid];
const request = () => new Request("https://example.invalid/api/admin/submissions", {
  headers: { authorization: "Bearer test-token" },
});

beforeEach(() => {
  vi.stubEnv("ADMIN_UIDS", identity.uid);
  for (const name of ["ADMIN_EMAILS", "ADMIN_EMAIL", "admin_email"]) {
    vi.stubEnv(name, identity.email);
  }
  mocks.verify.mockReset().mockResolvedValue(identity);
  mocks.initialize.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getAdminAuthorizationFailure", () => {
  it("accepts the approved UID without requiring verified email", () => {
    expect(getAdminAuthorizationFailure(identity, allowedUids)).toBeNull();
  });

  it("rejects a different UID with the same formerly allowed email", () => {
    expect(getAdminAuthorizationFailure({ ...identity, uid: "other-uid" }, allowedUids)).toBe("not-allowed");
  });

  it("accepts the approved UID after an email change or without an email", () => {
    const changedIdentity = { ...identity, email: "changed@example.com" };
    expect(getAdminAuthorizationFailure(changedIdentity, allowedUids)).toBeNull();
    expect(getAdminAuthorizationFailure({ uid: identity.uid }, allowedUids)).toBeNull();
  });

  it.each(["admin-uid", "ADMIN-UID", " Admin-UID ", ""])("rejects a non-exact UID: %s", (uid) => {
    expect(getAdminAuthorizationFailure({ uid }, allowedUids)).toBe("not-allowed");
  });
});

describe("requireAdmin", () => {
  it("trims configured UID entries while keeping case and revocation checks", async () => {
    vi.stubEnv("ADMIN_UIDS", " ,other-uid, Admin-UID ,Admin-UID,, ");
    await expect(requireAdmin(request())).resolves.toBe(identity);
    expect(mocks.verify).toHaveBeenCalledWith("test-token", true);
  });

  it.each([undefined, "", " , , "])("fails closed without configured UIDs even if legacy emails match: %s", async (value) => {
    vi.stubEnv("ADMIN_UIDS", value);
    await expect(requireAdmin(request())).rejects.toMatchObject({ status: 503 });
  });

  it.each(["other-uid", "admin-uid"])("rejects nonallowlisted UID despite matching email: %s", async (uid) => {
    mocks.verify.mockResolvedValue({ ...identity, uid });
    await expect(requireAdmin(request())).rejects.toMatchObject({ status: 403 });
  });

  it("rejects a missing bearer before accessing Firebase", async () => {
    await expect(requireAdmin(new Request("https://example.invalid/api/admin/submissions"))).rejects.toMatchObject({ status: 401 });
    expect(mocks.initialize).not.toHaveBeenCalled();
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it.each(["auth/id-token-revoked", "auth/user-disabled", "auth/argument-error"])("rejects Firebase token verification failures: %s", async (code) => {
    mocks.verify.mockRejectedValue(Object.assign(new Error("Invalid fixture token"), { code }));
    await expect(requireAdmin(request())).rejects.toMatchObject({ status: 401 });
    expect(mocks.verify).toHaveBeenCalledWith("test-token", true);
  });
});
