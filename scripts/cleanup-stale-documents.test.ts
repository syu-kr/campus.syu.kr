// @vitest-environment node
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteExpiredDocuments } from "./cleanup_meet_rooms";
import { deleteOldTokens } from "./cleanup_old_tokens";

const now = Timestamp.fromMillis(1_000);
const selectedVersion = Timestamp.fromMillis(100);
const renewedVersion = Timestamp.fromMillis(200);

function database(renewBeforeCommit: boolean) {
  const records = new Map([["renewed", selectedVersion], ["stale", selectedVersion]]);
  const docs = [...records].map(([id, updateTime]) => ({ ref: { id }, id, updateTime }));
  const get = vi.fn()
    .mockResolvedValueOnce({ empty: false, docs, size: docs.length })
    .mockResolvedValue({ empty: true, docs: [], size: 0 });
  const where = vi.fn(() => ({ limit: () => ({ get }) }));
  const batch = vi.fn(() => {
    if (renewBeforeCommit) records.set("renewed", renewedVersion);
    const deletes: { ref: { id: string }; condition?: { lastUpdateTime: Timestamp } }[] = [];
    return {
      delete: (ref: { id: string }, condition?: { lastUpdateTime: Timestamp }) => {
        deletes.push({ ref, condition });
      },
      commit: async () => {
        // Model Firestore's atomic precondition check before applying any deletes.
        if (deletes.some(({ ref, condition }) =>
          condition && !records.get(ref.id)?.isEqual(condition.lastUpdateTime))) {
          throw new Error("fixture precondition failed");
        }
        for (const { ref } of deletes) records.delete(ref.id);
      },
    };
  });
  const db = { collection: () => ({ where }), batch } as unknown as Firestore;
  return { db, records, get, where };
}

beforeEach(() => vi.spyOn(console, "log").mockImplementation(() => undefined));

describe.each([
  { name: "token subscription", field: "last_updated", cleanup: (db: Firestore) => deleteOldTokens(db, now) },
  { name: "rate-limit reset", field: "expires_at", cleanup: (db: Firestore) => deleteExpiredDocuments(db, "api_rate_limits", now) },
])("stale document cleanup: $name", ({ field, cleanup }) => {
  it("deletes unchanged query snapshots and reports the committed count", async () => {
    const fixture = database(false);
    expect(await cleanup(fixture.db)).toBe(2);
    expect(fixture.records.size).toBe(0);
    expect(fixture.where).toHaveBeenCalledWith(field, "<=", now);
    expect(fixture.get).toHaveBeenCalledTimes(2);
  });

  it("preserves a concurrent renewal and aborts the atomic batch visibly", async () => {
    const fixture = database(true);
    await expect(cleanup(fixture.db)).rejects.toThrow("fixture precondition failed");
    expect(fixture.records.get("renewed")).toEqual(renewedVersion);
    expect(fixture.records.get("stale")).toEqual(selectedVersion);
    expect(fixture.get).toHaveBeenCalledTimes(1);
  });
});
