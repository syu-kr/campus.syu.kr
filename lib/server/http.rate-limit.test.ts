import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

const memory = vi.hoisted(() => ({ documents: new Map<string, Record<string, unknown>>(), queue: Promise.resolve() }));
vi.mock("@/lib/server/firestore", () => ({
  admin: { firestore: { Timestamp } },
  getFirestore: () => ({
    collection: () => ({ doc: (id: string) => ({ id }) }),
    runTransaction: (fn: (tx: unknown) => Promise<unknown>) => {
      const result = memory.queue.then(() => fn({
        get: async (ref: { id: string }) => ({ exists: memory.documents.has(ref.id), get: (field: string) => memory.documents.get(ref.id)?.[field] }),
        set: (ref: { id: string }, value: Record<string, unknown>) => memory.documents.set(ref.id, value),
        update: (ref: { id: string }, value: Record<string, unknown>) => memory.documents.set(ref.id, { ...memory.documents.get(ref.id), ...value }),
      }));
      memory.queue = result.then(() => undefined, () => undefined);
      return result;
    },
  }),
}));
import { enforceRateLimitKey } from "./http";

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime("2026-10-04T23:59:30Z");
  vi.stubEnv("RATE_LIMIT_SECRET", "test-only-rate-secret");
  memory.documents.clear(); memory.queue = Promise.resolve();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("persistent explicit identity limits", () => {
  it("reserves atomically across simultaneous requests and module reloads", async () => {
    const outcomes = await Promise.allSettled(Array.from({ length: 5 }, () => enforceRateLimitKey("student-opaque-key", { limit: 2, windowMs: 3_600_000 })));
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(2);
    expect([...memory.documents.values()][0].count).toBe(2);
    vi.resetModules();
    const reloaded = await import("./http");
    await expect(reloaded.enforceRateLimitKey("student-opaque-key", { limit: 2, windowMs: 3_600_000 })).rejects.toMatchObject({ status: 429 });
    await expect(reloaded.enforceRateLimitKey("another-identity", { limit: 2, windowMs: 3_600_000 })).resolves.toBeUndefined();
  });
  it("aligns daily boundaries to UTC and marks counts for admin as site attempts only", async () => {
    const options = { limit: 1, windowMs: 86_400_000, metric: "roommate_mail_requests" };
    await enforceRateLimitKey("opaque-owner-daily", options);
    const record = [...memory.documents.values()][0];
    expect(record.window_start).toBe("2026-10-04");
    expect(record.reset_at).toEqual(Timestamp.fromDate(new Date("2026-10-05T00:00:00Z")));
    await expect(enforceRateLimitKey("opaque-owner-daily", options)).rejects.toMatchObject({ status: 429 });
    vi.setSystemTime("2026-10-05T00:00:00Z");
    await expect(enforceRateLimitKey("opaque-owner-daily", options)).resolves.toBeUndefined();
    expect(memory.documents.size).toBe(2);
  });
  it("maintains a full sixty-second resend cooldown across minute boundaries", async () => {
    const options = { limit: 1, windowMs: 60_000, fixedWindow: false };
    await enforceRateLimitKey("opaque-owner-cooldown", options);
    vi.setSystemTime("2026-10-05T00:00:00Z");
    await expect(enforceRateLimitKey("opaque-owner-cooldown", options)).rejects.toMatchObject({ status: 429 });
    vi.setSystemTime("2026-10-05T00:00:30Z");
    await expect(enforceRateLimitKey("opaque-owner-cooldown", options)).resolves.toBeUndefined();
  });
  it("fails closed without a shared secret in every environment", async () => {
    vi.stubEnv("RATE_LIMIT_SECRET", "");
    await expect(enforceRateLimitKey("owner", { limit: 1, windowMs: 60_000 })).rejects.toMatchObject({ status: 503, code: "RATE_LIMIT_CONFIG_MISSING" });
    expect(memory.documents.size).toBe(0);
  });
});
