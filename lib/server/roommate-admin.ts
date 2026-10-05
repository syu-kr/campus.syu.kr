import { FieldPath, Timestamp, type Firestore, type Query } from "firebase-admin/firestore";
import type { DecodedIdToken } from "firebase-admin/auth";
import { NextResponse } from "next/server";
import { AdminAuthError } from "./admin-auth";
import { ApiError } from "./http";
import {
  DAY_MS,
  isRecruiting,
  retentionExpiry,
  serializeRoommatePost,
  type RoommateOwnerStateDocument,
  type RoommatePostDocument,
} from "./roommate-posts";

const ADMIN_REPORT_STATUSES = ["pending", "reviewing", "done", "rejected"] as const;
export type AdminReportStatus = (typeof ADMIN_REPORT_STATUSES)[number];
export type AdminPostAction = "hide" | "restore" | "delete" | "release_hold" | "extend_hold";
export interface AdminRoommateReport {
  id: string;
  postId: string;
  reason: string;
  description: string;
  evidence: { postId: string; nickname: string; description: string; openChatUrl: string; dorm: string; roomSize: number; version: number };
  status: AdminReportStatus;
  version: number;
  memo: string;
  createdAt: string;
  expiresAt: string;
}
export interface AdminRoommateHold {
  ownerKey: string;
  latestPostId: string | null;
  version: number;
  holdUntil: string;
  reason: string;
}
export type AdminRoommatePost = ReturnType<typeof serializeRoommatePost> & {
  ownerKey: string;
  holdUntil: string | null;
  holdReason: string;
};

export function adminRoommateJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
}

export function adminRoommateError(error: unknown) {
  if (error instanceof AdminAuthError || error instanceof ApiError) {
    return adminRoommateJson({ error: error.message, code: error instanceof ApiError ? error.code : undefined }, error.status);
  }
  console.error("[Roommate admin] request failed");
  return adminRoommateJson({ error: "룸메이트 관리 서비스를 이용할 수 없습니다." }, 503);
}

function validId(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new ApiError("대상 ID가 올바르지 않습니다.", 400);
  return value;
}
function version(value: unknown) {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new ApiError("현재 version이 필요합니다.", 400);
  return Number(value);
}
function text(value: unknown, max = 300) {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.trim().length > max) throw new ApiError(`메모는 ${max}자 이하로 입력해주세요.`, 400);
  return value.trim();
}
function whitelist(body: Record<string, unknown>, fields: string[]) {
  if (Object.keys(body).some((key) => !fields.includes(key))) throw new ApiError("허용하지 않은 입력 항목입니다.", 400);
}
export function readAdminPostMutation(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError("요청이 올바르지 않습니다.", 400);
  const body = value as Record<string, unknown>;
  whitelist(body, ["id", "expectedVersion", "action", "reason", "ownerKey", "expectedOwnerVersion"]);
  const actions: AdminPostAction[] = ["hide", "restore", "delete", "release_hold", "extend_hold"];
  if (!actions.includes(body.action as AdminPostAction)) throw new ApiError("관리 조치가 올바르지 않습니다.", 400);
  const action = body.action as AdminPostAction;
  const ownerOnly = body.ownerKey !== undefined;
  if (ownerOnly && action !== "release_hold" && action !== "extend_hold") throw new ApiError("작성자 상태 조치가 올바르지 않습니다.", 400);
  if (ownerOnly && (body.id !== undefined || body.expectedVersion !== undefined)) throw new ApiError("대상은 하나만 지정해주세요.", 400);
  if (!ownerOnly && body.expectedOwnerVersion !== undefined) throw new ApiError("작성자 상태 대상이 필요합니다.", 400);
  const reason = text(body.reason);
  if ((action === "hide" || action === "extend_hold") && !reason) throw new ApiError("조치 사유를 입력해주세요.", 400);
  return { action, id: ownerOnly ? null : validId(body.id), expectedVersion: ownerOnly ? null : version(body.expectedVersion), ownerKey: ownerOnly ? validId(body.ownerKey) : null, expectedOwnerVersion: ownerOnly ? version(body.expectedOwnerVersion) : null, reason };
}

export async function mutateAdminPost(db: Firestore, identity: DecodedIdToken, input: ReturnType<typeof readAdminPostMutation>, now = Timestamp.now()) {
  await db.runTransaction(async (transaction) => {
    const postRef = input.id ? db.collection("roommate_posts").doc(input.id) : null;
    const postSnapshot = postRef ? await transaction.get(postRef) : null;
    if (postRef && !postSnapshot?.exists) throw new ApiError("글이 이미 정리되었거나 없습니다.", 404);
    const post = postSnapshot?.data() as RoommatePostDocument | undefined;
    if (post && post.version !== input.expectedVersion) throw new ApiError("글이 변경되었습니다. 새로고침 후 다시 시도해주세요.", 409);
    if (post && post.expires_at.toMillis() <= now.toMillis()) throw new ApiError("보존 기한이 지난 글입니다.", 404);
    const ownerKey = post?.owner_key || input.ownerKey!;
    const ownerRef = db.collection("roommate_owner_state").doc(ownerKey);
    const ownerSnapshot = await transaction.get(ownerRef);
    const owner = ownerSnapshot.data() as (RoommateOwnerStateDocument & { version?: number }) | undefined;
    if (!owner) throw new ApiError("작성자 상태를 찾을 수 없습니다.", 404);
    const ownerVersion = owner.version || 1;
    if (!post && ownerVersion !== input.expectedOwnerVersion) throw new ApiError("작성자 상태가 변경되었습니다. 새로고침해주세요.", 409);
    const activeId = owner.active_post_id;
    let otherActive = false;
    if (input.action === "restore" && activeId && activeId !== input.id) {
      const active = await transaction.get(db.collection("roommate_posts").doc(activeId));
      otherActive = active.exists && isRecruiting(active.data() as RoommatePostDocument, now.toMillis());
    }
    const ownerChange: Record<string, unknown> = { updated_at: now, expires_at: Timestamp.fromMillis(now.toMillis() + 90 * DAY_MS), version: ownerVersion + 1 };
    const postChange: Record<string, unknown> = { updated_at: now, version: post ? post.version + 1 : 0 };
    switch (input.action) {
      case "hide":
        if (!post || post.status !== "recruiting") throw new ApiError("모집 중인 글만 숨길 수 있습니다.", 409);
        postChange.status = "hidden";
        ownerChange.hold_until = Timestamp.fromMillis(Math.max(owner.hold_until?.toMillis() || 0, now.toMillis() + 30 * DAY_MS));
        ownerChange.hold_reason = input.reason;
        if (activeId === input.id) ownerChange.active_post_id = null;
        break;
      case "restore":
        if (!post || post.status !== "hidden" || post.recruit_until.toMillis() <= now.toMillis() || otherActive) throw new ApiError("마감 전 숨김 글만 다른 활성 글이 없을 때 복구할 수 있습니다.", 409);
        postChange.status = "recruiting";
        ownerChange.active_post_id = input.id;
        ownerChange.latest_post_id = input.id;
        break;
      case "delete":
        if (!post || post.status === "deleted") throw new ApiError("이미 삭제된 글입니다.", 409);
        postChange.status = "deleted";
        postChange.closed_at = post.closed_at || now;
        postChange.expires_at = retentionExpiry({ ...post, closed_at: post.closed_at || now });
        if (activeId === input.id) ownerChange.active_post_id = null;
        break;
      case "release_hold":
        ownerChange.hold_until = null;
        ownerChange.hold_reason = "";
        break;
      case "extend_hold":
        ownerChange.hold_until = Timestamp.fromMillis(Math.max(owner.hold_until?.toMillis() || 0, now.toMillis()) + 30 * DAY_MS);
        ownerChange.hold_reason = input.reason;
        break;
    }
    if (postRef) transaction.update(postRef, postChange);
    transaction.update(ownerRef, ownerChange);
    transaction.set(db.collection("admin_audit_logs").doc(), { action: `roommate_${input.action}`, actor_uid: identity.uid, actor_email: identity.email || null, post_id: input.id, owner_key: ownerKey, previous_status: post?.status || null, next_status: postChange.status || post?.status || null, created_at: now, expires_at: Timestamp.fromMillis(now.toMillis() + 365 * DAY_MS) });
  });
}

export function readAdminReportMutation(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError("요청이 올바르지 않습니다.", 400);
  const body = value as Record<string, unknown>;
  whitelist(body, ["id", "expectedVersion", "status", "memo"]);
  if (!ADMIN_REPORT_STATUSES.includes(body.status as AdminReportStatus)) throw new ApiError("신고 상태가 올바르지 않습니다.", 400);
  return { id: validId(body.id), expectedVersion: version(body.expectedVersion), status: body.status as AdminReportStatus, memo: text(body.memo) };
}
export async function mutateAdminReport(db: Firestore, identity: DecodedIdToken, input: ReturnType<typeof readAdminReportMutation>, now = Timestamp.now()) {
  await db.runTransaction(async (transaction) => {
    const ref = db.collection("roommate_reports").doc(input.id);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || (snapshot.get("expires_at") as Timestamp).toMillis() <= now.toMillis()) throw new ApiError("신고가 정리되었거나 없습니다.", 404);
    if (snapshot.get("version") !== input.expectedVersion) throw new ApiError("신고가 변경되었습니다. 새로고침해주세요.", 409);
    transaction.update(ref, { status: input.status, admin_memo: input.memo, version: input.expectedVersion + 1, updated_at: now, handled_at: input.status === "done" || input.status === "rejected" ? now : null });
    transaction.set(db.collection("admin_audit_logs").doc(), { action: "roommate_report_status_changed", actor_uid: identity.uid, actor_email: identity.email || null, report_id: input.id, post_id: snapshot.get("post_id"), previous_status: snapshot.get("status"), next_status: input.status, created_at: now, expires_at: Timestamp.fromMillis(now.toMillis() + 365 * DAY_MS) });
  });
}

function readCursor(value: string | null) {
  if (!value) return null;
  try {
    if (value.length > 1024) throw new Error();
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const id = validId(parsed.id);
    if (!Number.isInteger(parsed.seconds) || !Number.isInteger(parsed.nanoseconds) || parsed.nanoseconds < 0 || parsed.nanoseconds >= 1e9) throw new Error();
    return { timestamp: new Timestamp(parsed.seconds, parsed.nanoseconds), id };
  } catch { throw new ApiError("페이지 커서가 올바르지 않습니다.", 400); }
}
function nextCursor(timestamp: Timestamp, id: string) {
  return Buffer.from(JSON.stringify({ seconds: timestamp.seconds, nanoseconds: timestamp.nanoseconds, id })).toString("base64url");
}

export async function listAdminReports(db: Firestore, params: URLSearchParams, now = Timestamp.now()) {
  const status = params.get("status") || "pending";
  if (status !== "all" && !ADMIN_REPORT_STATUSES.includes(status as AdminReportStatus)) throw new ApiError("신고 필터가 올바르지 않습니다.", 400);
  let query: Query = db.collection("roommate_reports").where("expires_at", ">", now);
  if (status !== "all") query = query.where("status", "==", status);
  query = query.orderBy("expires_at", "asc").orderBy(FieldPath.documentId(), "asc");
  const cursor = readCursor(params.get("cursor"));
  if (cursor) query = query.startAfter(cursor.timestamp, cursor.id);
  const [snapshot, pending] = await Promise.all([query.limit(21).get(), db.collection("roommate_reports").where("status", "in", ["pending", "reviewing"]).where("expires_at", ">", now).count().get()]);
  const docs = snapshot.docs.slice(0, 20);
  const items = docs.map((doc): AdminRoommateReport => { const data = doc.data(); return { id: doc.id, postId: data.post_id, reason: data.reason, description: data.description || "", evidence: data.evidence, status: data.status, version: data.version, memo: data.admin_memo || "", createdAt: data.created_at.toDate().toISOString(), expiresAt: data.expires_at.toDate().toISOString() }; });
  const last = docs.at(-1);
  return { items, pendingCount: pending.data().count, nextCursor: snapshot.docs.length > 20 && last ? nextCursor(last.get("expires_at"), last.id) : null };
}

export async function listAdminPosts(db: Firestore, params: URLSearchParams, now = Timestamp.now()) {
  const status = params.get("status") || "all";
  if (!["all", "recruiting", "hidden", "completed", "deleted"].includes(status)) throw new ApiError("글 필터가 올바르지 않습니다.", 400);
  let query: Query = db.collection("roommate_posts");
  const requestedId = params.get("id");
  if (requestedId) query = query.where(FieldPath.documentId(), "==", validId(requestedId));
  if (status !== "all") query = query.where("status", "==", status);
  query = query.orderBy("created_at", "desc").orderBy(FieldPath.documentId(), "desc");
  const cursor = readCursor(params.get("cursor"));
  if (cursor) query = query.startAfter(cursor.timestamp, cursor.id);
  let holdsQuery = db.collection("roommate_owner_state").where("hold_until", ">", now).orderBy("hold_until", "asc").orderBy(FieldPath.documentId(), "asc");
  const holdCursor = readCursor(params.get("holdsCursor"));
  if (holdCursor) holdsQuery = holdsQuery.startAfter(holdCursor.timestamp, holdCursor.id);
  const [snapshot, holdsSnapshot, mailSnapshot, recruiting] = await Promise.all([query.limit(21).get(), holdsQuery.limit(21).get(), db.collection("api_rate_limits").where("metric", "==", "roommate_mail_requests").where("window_start", "==", now.toDate().toISOString().slice(0, 10)).limit(1001).get(), db.collection("roommate_posts").where("status", "==", "recruiting").where("recruit_until", ">", now).count().get()]);
  const docs = snapshot.docs.slice(0, 20);
  const valid = docs.filter((doc) => (doc.get("expires_at") as Timestamp).toMillis() > now.toMillis());
  const refs = valid.map((doc) => db.collection("roommate_owner_state").doc(doc.get("owner_key")));
  const owners = refs.length ? await db.getAll(...refs) : [];
  const items = valid.map((doc, index): AdminRoommatePost => { const data = doc.data() as RoommatePostDocument; return { ...serializeRoommatePost(data, doc.id), ownerKey: data.owner_key, holdUntil: owners[index].get("hold_until")?.toDate().toISOString() || null, holdReason: owners[index].get("hold_reason") || "" }; });
  const holds: AdminRoommateHold[] = holdsSnapshot.docs.slice(0, 20).map((doc) => ({ ownerKey: doc.id, latestPostId: doc.get("latest_post_id") || null, version: doc.get("version") || 1, holdUntil: doc.get("hold_until").toDate().toISOString(), reason: doc.get("hold_reason") || "" }));
  const last = docs.at(-1);
  const lastHold = holdsSnapshot.docs.slice(0, 20).at(-1);
  return { items, holds, holdsNextCursor: holdsSnapshot.docs.length > 20 && lastHold ? nextCursor(lastHold.get("hold_until"), lastHold.id) : null, recruitingCount: recruiting.data().count, nextCursor: snapshot.docs.length > 20 && last ? nextCursor(last.get("created_at"), last.id) : null, mailRequests: { dateUtc: now.toDate().toISOString().slice(0, 10), count: mailSnapshot.docs.slice(0, 1000).reduce((sum, doc) => sum + Number(doc.get("count") || 0), 0), partial: mailSnapshot.docs.length > 1000 } };
}
