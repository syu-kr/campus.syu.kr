import { Timestamp, type Firestore } from "firebase-admin/firestore";
import type { DecodedIdToken } from "firebase-admin/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mutateAdminPost, mutateAdminReport, readAdminPostMutation, readAdminReportMutation } from "./roommate-admin";
import { createRoommatePost, getMyRoommatePost, mutateRoommatePost } from "./roommate-posts";

vi.mock("@/lib/server/firestore", () => ({ admin: { firestore: { Timestamp } }, getFirestore: () => db }));

const DAY = 86_400_000;
const now = Timestamp.fromDate(new Date("2026-10-04T01:00:00Z"));
const time = (days: number) => Timestamp.fromMillis(now.toMillis() + days * DAY);
const identity = { uid: "admin-fixture", email: "admin@example.test" } as DecodedIdToken;
const records = new Map<string, Record<string, unknown>>();
const snapshot = (path: string) => ({ id: path.split("/").at(-1)!, exists: records.has(path), data: () => records.get(path), get: (field: string) => records.get(path)?.[field] });
const reference = (path: string) => ({ path, id: path.split("/").at(-1)!, get: async () => snapshot(path) });
const transaction = {
  get: vi.fn(async (ref: { path: string }) => snapshot(ref.path)),
  create: vi.fn((ref: { path: string }, data: Record<string, unknown>) => records.set(ref.path, data)),
  update: vi.fn((ref: { path: string }, data: Record<string, unknown>) => records.set(ref.path, { ...records.get(ref.path), ...data })),
  set: vi.fn((ref: { path: string }, data: Record<string, unknown>, options?: { merge: boolean }) => records.set(ref.path, options?.merge ? { ...records.get(ref.path), ...data } : data)),
};
const db = { collection: (collection: string) => ({ doc: (id = "audit-fixture") => reference(`${collection}/${id}`) }), runTransaction: async (callback: (value: typeof transaction) => unknown) => callback(transaction) } as unknown as Firestore;
const mutate = (action: string, fields: Record<string, unknown> = {}) => mutateAdminPost(db, identity, readAdminPostMutation({ id: "post-fixture", expectedVersion: 1, action, ...fields }), now);

beforeEach(() => {
  vi.clearAllMocks(); records.clear();
  records.set("roommate_posts/post-fixture", { owner_key: "owner-fixture", status: "recruiting", version: 1, recruit_until: time(10), expires_at: time(40), created_at: time(-1), updated_at: time(-1) });
  records.set("roommate_owner_state/owner-fixture", { active_post_id: "post-fixture", latest_post_id: "post-fixture", version: 1, updated_at: time(-1), expires_at: time(89) });
});

describe("roommate administrator transactions", () => {
  it("hides a post, releases its active pointer and applies a 30-day hold atomically without extending post retention", async () => {
    await mutate("hide", { reason: "스팸" });
    expect(records.get("roommate_posts/post-fixture")).toMatchObject({ status: "hidden", version: 2, expires_at: time(40) });
    expect(records.get("roommate_owner_state/owner-fixture")).toMatchObject({ active_post_id: null, hold_until: time(30), hold_reason: "스팸" });
    expect(records.get("admin_audit_logs/audit-fixture")).toMatchObject({ action: "roommate_hide", expires_at: time(365) });
  });
  it("does not shorten an existing hold on hide", async () => {
    records.get("roommate_owner_state/owner-fixture")!.hold_until = time(60);
    await mutate("hide", { reason: "검토" });
    expect(records.get("roommate_owner_state/owner-fixture")!.hold_until).toEqual(time(60));
  });
  it.each(["completed", "deleted"])("refuses restoration of %s", async (status) => {
    records.get("roommate_posts/post-fixture")!.status = status;
    await expect(mutate("restore")).rejects.toMatchObject({ status: 409 });
    expect(transaction.update).not.toHaveBeenCalled();
  });
  it("refuses restoration when expired or another post is actively recruiting", async () => {
    records.get("roommate_posts/post-fixture")!.status = "hidden";
    records.get("roommate_owner_state/owner-fixture")!.active_post_id = "other-post";
    records.set("roommate_posts/other-post", { status: "recruiting", recruit_until: time(5), expires_at: time(35) });
    await expect(mutate("restore")).rejects.toMatchObject({ status: 409 });
    expect(transaction.update).not.toHaveBeenCalled();
    records.get("roommate_owner_state/owner-fixture")!.active_post_id = null;
    records.get("roommate_posts/post-fixture")!.recruit_until = time(0);
    await expect(mutate("restore")).rejects.toMatchObject({ status: 409 });
  });
  it("restores hidden posts without releasing the independent writing hold", async () => {
    records.get("roommate_posts/post-fixture")!.status = "hidden";
    records.get("roommate_owner_state/owner-fixture")!.hold_until = time(30);
    await mutate("restore");
    expect(records.get("roommate_posts/post-fixture")!.status).toBe("recruiting");
    expect(records.get("roommate_owner_state/owner-fixture")!.hold_until).toEqual(time(30));
  });
  it("shows a restored older post in My post after a newer post was completed", async () => {
    await mutate("hide", { reason: "검토" });
    await mutate("release_hold", { expectedVersion: 2 });
    const newer = await createRoommatePost("owner-fixture", {
      nickname: "학생님", dorm: "eden", roomSize: 3, roommatesNeeded: 1,
      stayStart: "2026-10-04", stayEnd: "2026-11-01", recruitUntil: "2026-10-14",
      habits: {}, description: "새 모집글", openChatUrl: "https://open.kakao.com/o/fixture",
      disclosureConsent: true,
    }, now.toMillis() + 1000);
    await mutateRoommatePost("owner-fixture", newer.id, "complete", { action: "complete", expectedVersion: 1 }, now.toMillis() + 2000);
    expect((await getMyRoommatePost("owner-fixture", now.toMillis() + 3000)).post?.id).toBe(newer.id);
    await mutate("restore", { expectedVersion: 3 });
    expect(records.get("roommate_owner_state/owner-fixture")!.active_post_id).toBe("post-fixture");
    expect((await getMyRoommatePost("owner-fixture", now.toMillis() + 3000)).post).toMatchObject({ id: "post-fixture", status: "recruiting" });
  });
  it("preserves the first close timestamp and newer active pointer when deleting an old completed post", async () => {
    Object.assign(records.get("roommate_posts/post-fixture")!, { status: "completed", closed_at: time(-1), expires_at: time(29) });
    records.get("roommate_owner_state/owner-fixture")!.active_post_id = "new-post";
    await mutate("delete");
    expect(records.get("roommate_posts/post-fixture")).toMatchObject({ status: "deleted", closed_at: time(-1), expires_at: time(29) });
    expect(records.get("roommate_owner_state/owner-fixture")!.active_post_id).toBe("new-post");
  });
  it("rejects stale versions before writing", async () => {
    await expect(mutate("delete", { expectedVersion: 2 })).rejects.toMatchObject({ status: 409 });
    expect(transaction.update).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
  });
  it("manages a remaining hold after the original post was purged using owner version", async () => {
    records.delete("roommate_posts/post-fixture");
    records.get("roommate_owner_state/owner-fixture")!.hold_until = time(10);
    await mutateAdminPost(db, identity, readAdminPostMutation({ ownerKey: "owner-fixture", expectedOwnerVersion: 1, action: "extend_hold", reason: "추가 검토" }), now);
    expect(records.get("roommate_owner_state/owner-fixture")).toMatchObject({ hold_until: time(40), version: 2 });
    await expect(mutateAdminPost(db, identity, readAdminPostMutation({ ownerKey: "owner-fixture", expectedOwnerVersion: 1, action: "release_hold" }), now)).rejects.toMatchObject({ status: 409 });
  });
  it("records report handling separately while retaining the original expiry and excluding evidence from audit", async () => {
    records.set("roommate_reports/report-fixture", { post_id: "post-fixture", status: "pending", version: 1, evidence: { openChatUrl: "https://open.kakao.com/o/fixture" }, expires_at: time(20) });
    await mutateAdminReport(db, identity, readAdminReportMutation({ id: "report-fixture", expectedVersion: 1, status: "done", memo: "확인했습니다" }), now);
    expect(records.get("roommate_reports/report-fixture")).toMatchObject({ status: "done", version: 2, admin_memo: "확인했습니다", expires_at: time(20) });
    expect(records.get("roommate_posts/post-fixture")!.status).toBe("recruiting");
    const audit = records.get("admin_audit_logs/audit-fixture")!;
    expect(audit).not.toHaveProperty("evidence"); expect(audit).not.toHaveProperty("memo");
  });
  it("rejects expired report evidence and input fields outside the contract", async () => {
    records.set("roommate_reports/report-fixture", { expires_at: time(0), version: 1 });
    await expect(mutateAdminReport(db, identity, readAdminReportMutation({ id: "report-fixture", expectedVersion: 1, status: "reviewing" }), now)).rejects.toMatchObject({ status: 404 });
    expect(() => readAdminPostMutation({ id: "post-fixture", expectedVersion: 1, action: "hide", reason: "검토", status: "hidden" })).toThrow();
    expect(() => readAdminReportMutation({ id: "report-fixture", expectedVersion: 1, status: "done", memo: "가".repeat(301) })).toThrow();
  });
});
