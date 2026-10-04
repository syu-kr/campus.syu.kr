import { Timestamp, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteExpiredRoommateDocument } from "./roommate-cleanup";

const DAY = 86_400_000;
const now = Timestamp.fromDate(new Date("2026-10-04T01:00:00Z"));
const time = (days: number) => Timestamp.fromMillis(now.toMillis() + days * DAY);
const records = new Map<string, Record<string, unknown>>();
const ref = { path: "roommate_owner_state/owner", id: "owner" } as DocumentReference;
const transaction = { get: vi.fn(async (target: { path: string }) => ({ exists: records.has(target.path), data: () => records.get(target.path), get: (field: string) => records.get(target.path)?.[field] })), delete: vi.fn(), set: vi.fn() };
const db = { collection: (collection: string) => ({ doc: (id = "audit") => ({ path: `${collection}/${id}`, id }) }), runTransaction: async (callback: (value: typeof transaction) => unknown) => callback(transaction) } as unknown as Firestore;
beforeEach(() => { vi.clearAllMocks(); records.clear(); records.set(ref.path, { expires_at: time(-1), updated_at: time(-91), active_post_id: null }); });

describe("roommate cleanup freshness and retention", () => {
  it("preserves reused owner state updated since the expiry query", async () => {
    records.set(ref.path, { expires_at: time(90), updated_at: now });
    expect(await deleteExpiredRoommateDocument(db, ref, "roommate_owner_state", now)).toBe(false);
    expect(transaction.delete).not.toHaveBeenCalled();
  });
  it("preserves a current hold even if an old expires_at was selected", async () => {
    records.get(ref.path)!.hold_until = time(1);
    expect(await deleteExpiredRoommateDocument(db, ref, "roommate_owner_state", now)).toBe(false);
    expect(transaction.delete).not.toHaveBeenCalled();
  });
  it("preserves state with a newly active post and rechecks the post inside the transaction", async () => {
    records.get(ref.path)!.active_post_id = "new-post";
    records.set("roommate_posts/new-post", { status: "recruiting", recruit_until: time(10) });
    expect(await deleteExpiredRoommateDocument(db, ref, "roommate_owner_state", now)).toBe(false);
    expect(transaction.get).toHaveBeenCalledTimes(2);
    expect(transaction.delete).not.toHaveBeenCalled();
  });
  it("removes inactive state only after 90 days and without restoring hidden posts", async () => {
    records.get(ref.path)!.active_post_id = "hidden-post";
    records.set("roommate_posts/hidden-post", { status: "hidden", recruit_until: time(10) });
    expect(await deleteExpiredRoommateDocument(db, ref, "roommate_owner_state", now)).toBe(true);
    expect(transaction.delete).toHaveBeenCalledWith(ref);
    expect(transaction.set).not.toHaveBeenCalled();
  });
  it.each(["pending", "reviewing"])("records unresolved %s expiry without duplicating private evidence", async (status) => {
    records.set(ref.path, { status, post_id: "post", expires_at: now, description: "private text", evidence: { openChatUrl: "https://open.kakao.com/o/fixture" } });
    expect(await deleteExpiredRoommateDocument(db, ref, "roommate_reports", now)).toBe(true);
    const audit = transaction.set.mock.calls[0][1];
    expect(audit).toMatchObject({ action: "roommate_report_expired_unresolved", previous_status: status, note: "미처리 상태에서 보존 종료", expires_at: time(365) });
    expect(audit).not.toHaveProperty("evidence"); expect(audit).not.toHaveProperty("description"); expect(audit).not.toHaveProperty("next_status");
    expect(transaction.delete).toHaveBeenCalledWith(ref);
  });
  it("does not treat resolved report expiry as unresolved or delete before expiry", async () => {
    records.set(ref.path, { status: "done", expires_at: time(1) });
    expect(await deleteExpiredRoommateDocument(db, ref, "roommate_reports", now)).toBe(false);
    records.get(ref.path)!.expires_at = now;
    expect(await deleteExpiredRoommateDocument(db, ref, "roommate_reports", now)).toBe(true);
    expect(transaction.set).not.toHaveBeenCalled();
  });
});
