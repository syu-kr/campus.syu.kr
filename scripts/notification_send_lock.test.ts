import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runNotificationSendLock } from "./notification_send_lock";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  transactionGet: vi.fn(),
  transactionDelete: vi.fn(),
  runTransaction: vi.fn(),
  initialize: vi.fn(),
}));

vi.mock("./firebase-admin", async () => {
  const { Timestamp } = await import("firebase-admin/firestore");
  return {
    admin: { firestore: { Timestamp } },
    initializeScriptFirestore: mocks.initialize,
  };
});

const NOW = Date.parse("2026-10-04T01:00:00Z");
const ref = { get: mocks.get };
const transaction = {
  get: mocks.transactionGet,
  delete: mocks.transactionDelete,
};
const snapshot = (data: Record<string, unknown>) => ({
  exists: true,
  data: () => data,
});
const sending = (minutes: number) => ({
  status: "sending",
  updated_at: Timestamp.fromMillis(NOW - minutes * 60_000),
});
const key = "daily-summary:fixture";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  mocks.get.mockResolvedValue(snapshot(sending(60)));
  mocks.transactionGet.mockResolvedValue(snapshot(sending(60)));
  mocks.runTransaction.mockImplementation(async (callback) => callback(transaction));
  mocks.initialize.mockResolvedValue({
    collection: () => ({ doc: () => ref }),
    runTransaction: mocks.runTransaction,
  });
});

describe("notification lock recovery", () => {
  it("keeps an inspection without a delete flag read-only", async () => {
    await runNotificationSendLock([key]);
    expect(mocks.runTransaction).not.toHaveBeenCalled();
    expect(mocks.transactionDelete).not.toHaveBeenCalled();
  });

  it("deletes a sending lock only after a fresh transaction read confirms 30 minutes", async () => {
    mocks.transactionGet.mockResolvedValue(snapshot(sending(30)));
    await runNotificationSendLock([key, "--delete-stale-sending"]);
    expect(mocks.transactionGet).toHaveBeenCalledWith(ref);
    expect(mocks.transactionDelete).toHaveBeenCalledWith(ref);
  });

  it("uses the creation timestamp when an update timestamp is absent", async () => {
    mocks.transactionGet.mockResolvedValue(snapshot({
      status: "sending",
      created_at: Timestamp.fromMillis(NOW - 30 * 60_000),
    }));
    await runNotificationSendLock([key, "--delete-stale-sending"]);
    expect(mocks.transactionDelete).toHaveBeenCalledOnce();
  });

  it.each([
    ["missing", undefined],
    ["malformed", "2026-10-04"],
    ["future", Timestamp.fromMillis(NOW + 60_000)],
  ])("refuses a %s sending timestamp", async (_, updated_at) => {
    mocks.transactionGet.mockResolvedValue(snapshot({ status: "sending", updated_at }));
    await expect(runNotificationSendLock([key, "--delete-stale-sending"]))
      .rejects.toThrow("unknown, invalid, or future timestamp");
    expect(mocks.transactionDelete).not.toHaveBeenCalled();
  });

  it("refuses a non-finite timestamp even if the object is a Timestamp", async () => {
    const invalid = Timestamp.fromMillis(NOW);
    vi.spyOn(invalid, "toMillis").mockReturnValue(Number.NaN);
    mocks.transactionGet.mockResolvedValue(snapshot({ status: "sending", updated_at: invalid }));
    await expect(runNotificationSendLock([key, "--delete-stale-sending"]))
      .rejects.toThrow("unknown, invalid, or future timestamp");
    expect(mocks.transactionDelete).not.toHaveBeenCalled();
  });

  it("refuses a lock refreshed after the initial read", async () => {
    mocks.transactionGet.mockResolvedValue(snapshot(sending(29)));
    await expect(runNotificationSendLock([key, "--delete-stale-sending"]))
      .rejects.toThrow("Wait at least 30m");
    expect(mocks.transactionDelete).not.toHaveBeenCalled();
  });

  it("preserves a lock that became sent after the initial read", async () => {
    mocks.transactionGet.mockResolvedValue(snapshot({ status: "sent" }));
    await expect(runNotificationSendLock([key, "--delete-stale-sending"]))
      .rejects.toThrow("Current status: sent");
    expect(mocks.transactionDelete).not.toHaveBeenCalled();
  });

  it("deletes a failed lock after checking its latest status", async () => {
    mocks.get.mockResolvedValue(snapshot({ status: "failed" }));
    mocks.transactionGet.mockResolvedValue(snapshot({ status: "failed" }));
    await runNotificationSendLock([key, "--delete-failed"]);
    expect(mocks.transactionDelete).toHaveBeenCalledWith(ref);
  });

  it("preserves a failed lock that became sending before deletion", async () => {
    mocks.get.mockResolvedValue(snapshot({ status: "failed" }));
    mocks.transactionGet.mockResolvedValue(snapshot(sending(60)));
    await expect(runNotificationSendLock([key, "--delete-failed"]))
      .rejects.toThrow("Current status: sending");
    expect(mocks.transactionDelete).not.toHaveBeenCalled();
  });

  it("does not delete a lock removed between the initial and transaction reads", async () => {
    mocks.transactionGet.mockResolvedValue({ exists: false });
    await runNotificationSendLock([key, "--delete-stale-sending"]);
    expect(mocks.transactionDelete).not.toHaveBeenCalled();
  });
});
