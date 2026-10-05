import { createHash } from "node:crypto";
import type { DocumentReference, Timestamp, Transaction } from "firebase-admin/firestore";
import {
  DAY_MS, ROOMMATE_INPUT_FIELDS, RoommateError, assertRoommateFields, expectedRoommateVersion,
  matchesRoommateFilters, normalizeRoommatePostInput, normalizeRoommateReportInput,
  recruitDeadlineMillis, roommateObject,
} from "@/lib/roommates";
import { admin, getFirestore } from "@/lib/server/firestore";
import type {
  RoommateHabits, RoommateMyPost, RoommatePost, RoommatePostFilters,
  RoommatePostInput, RoommatePostList, RoommatePostStatus, RoommatePostSummary,
  RoommateReportReason, RoommateReportStatus,
} from "@/types/roommates";

export { DAY_MS } from "@/lib/roommates";
const ROOMMATE_COLLECTIONS = {
  posts: "roommate_posts", owners: "roommate_owner_state", reports: "roommate_reports", sessions: "roommate_sessions",
} as const;
const ROOMMATE_DISCLOSURE_POLICY_VERSION = "2026-10-04";

export interface RoommatePostDocument {
  owner_key: string;
  nickname: string;
  dorm: RoommatePostInput["dorm"];
  room_size: number;
  stay_start: string;
  stay_end: string;
  roommates_needed: number;
  recruit_deadline: string;
  habits: RoommateHabits;
  description: string;
  open_chat_url: string;
  status: RoommatePostStatus;
  version: number;
  created_at: Timestamp;
  updated_at: Timestamp;
  recruit_until: Timestamp;
  expires_at: Timestamp;
  closed_at?: Timestamp;
  disclosure_consent?: { accepted_at: Timestamp; policy_version: string };
}

export interface RoommateOwnerStateDocument {
  active_post_id: string | null;
  latest_post_id: string | null;
  hold_until?: Timestamp | null;
  hold_reason?: string | null;
  version?: number;
  updated_at: Timestamp;
  expires_at: Timestamp;
}

interface RoommateReportDocument {
  post_id: string;
  reporter_key: string;
  reason: RoommateReportReason;
  description: string;
  evidence: {
    postId: string; nickname: string; description: string; openChatUrl: string;
    dorm: RoommatePostInput["dorm"]; roomSize: number; version: number;
  };
  status: RoommateReportStatus;
  version: number;
  created_at: Timestamp;
  updated_at: Timestamp;
  expires_at: Timestamp;
  admin_memo?: string;
  handled_at?: Timestamp;
}

export function isRecruiting(post: RoommatePostDocument, now = Date.now()): boolean {
  return post.status === "recruiting" && post.recruit_until.toMillis() > now && post.expires_at.toMillis() > now;
}

function postInput(post: RoommatePostDocument): RoommatePostInput {
  return {
    nickname: post.nickname, dorm: post.dorm, roomSize: post.room_size,
    stayStart: post.stay_start, stayEnd: post.stay_end, roommatesNeeded: post.roommates_needed,
    recruitUntil: post.recruit_deadline, habits: post.habits,
    description: post.description, openChatUrl: post.open_chat_url,
  };
}

export function serializeRoommatePost(post: RoommatePostDocument, id: string, now = Date.now()): RoommatePost {
  return {
    ...postInput(post), id,
    status: post.status === "recruiting" && !isRecruiting(post, now) ? "expired" : post.status,
    version: post.version, createdAt: post.created_at.toDate().toISOString(),
    updatedAt: post.updated_at.toDate().toISOString(), expiresAt: post.expires_at.toDate().toISOString(),
  };
}

function serializeRoommateSummary(post: RoommatePostDocument, id: string, now = Date.now()): RoommatePostSummary {
  const detail = serializeRoommatePost(post, id, now);
  return {
    id: detail.id, nickname: detail.nickname, dorm: detail.dorm, roomSize: detail.roomSize,
    stayStart: detail.stayStart, stayEnd: detail.stayEnd, roommatesNeeded: detail.roommatesNeeded,
    recruitUntil: detail.recruitUntil, habits: detail.habits, status: detail.status,
    version: detail.version, createdAt: detail.createdAt, updatedAt: detail.updatedAt,
  };
}

export function retentionExpiry(post: RoommatePostDocument): Timestamp {
  const firstClose = post.closed_at?.toMillis() ?? post.recruit_until.toMillis();
  return admin.firestore.Timestamp.fromMillis(Math.min(firstClose, post.recruit_until.toMillis()) + 30 * DAY_MS);
}

function notFound(): never {
  throw new RoommateError(404, "POST_UNAVAILABLE", "종료되었거나 볼 수 없는 글입니다.");
}

function assertRoommatePostId(id: string) {
  if (!/^[A-Za-z0-9_-]{12,64}$/.test(id)) throw new RoommateError(400, "INVALID_POST_ID", "글 주소를 확인해주세요.");
}

export interface RoommateListCursor { seconds: number; nanoseconds: number; id: string }

export function encodeRoommateCursor(timestamp: Timestamp, id: string): string {
  return Buffer.from(JSON.stringify({ seconds: timestamp.seconds, nanoseconds: timestamp.nanoseconds, id })).toString("base64url");
}

export function decodeRoommateCursor(value: string): RoommateListCursor {
  try {
    if (!/^[A-Za-z0-9_-]{1,300}$/.test(value)) throw new Error("invalid");
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as RoommateListCursor;
    if (!Number.isSafeInteger(cursor.seconds) || !Number.isInteger(cursor.nanoseconds) || cursor.seconds < 0 || cursor.nanoseconds < 0 || cursor.nanoseconds >= 1_000_000_000 || typeof cursor.id !== "string" || !/^[A-Za-z0-9_-]{12,64}$/.test(cursor.id)) throw new Error("invalid");
    new admin.firestore.Timestamp(cursor.seconds, cursor.nanoseconds);
    return cursor;
  } catch {
    throw new RoommateError(400, "INVALID_CURSOR", "목록 위치를 확인해주세요.", "cursor");
  }
}

export async function listRoommatePosts(filters: RoommatePostFilters, cursor?: string | null, now = Date.now()): Promise<RoommatePostList> {
  const db = getFirestore();
  let query = db.collection(ROOMMATE_COLLECTIONS.posts)
    .where("status", "==", "recruiting")
    .orderBy("created_at", "desc").orderBy(admin.firestore.FieldPath.documentId(), "desc").limit(100);
  if (cursor) {
    const position = decodeRoommateCursor(cursor);
    query = query.startAfter(new admin.firestore.Timestamp(position.seconds, position.nanoseconds), position.id);
  }
  const snapshot = await query.get();
  const items: RoommatePostSummary[] = [];
  let examined = 0;
  for (const doc of snapshot.docs) {
    examined += 1;
    const post = doc.data() as RoommatePostDocument;
    if (isRecruiting(post, now) && matchesRoommateFilters(postInput(post), filters)) items.push(serializeRoommateSummary(post, doc.id, now));
    if (items.length === 20) break;
  }
  const last = snapshot.docs[examined - 1];
  const hasMore = examined < snapshot.docs.length || snapshot.docs.length === 100;
  return { items, nextCursor: last && hasMore ? encodeRoommateCursor((last.data() as RoommatePostDocument).created_at, last.id) : null };
}

export async function getRoommatePost(id: string, ownerKey: string, now = Date.now()): Promise<RoommatePost> {
  assertRoommatePostId(id);
  const snapshot = await getFirestore().collection(ROOMMATE_COLLECTIONS.posts).doc(id).get();
  const post = snapshot.data() as RoommatePostDocument | undefined;
  if (!post || !isRecruiting(post, now)) notFound();
  return { ...serializeRoommatePost(post, id, now), isOwner: post.owner_key === ownerKey };
}

export async function getMyRoommatePost(ownerKey: string, now = Date.now()): Promise<RoommateMyPost> {
  const db = getFirestore();
  const owner = (await db.collection(ROOMMATE_COLLECTIONS.owners).doc(ownerKey).get()).data() as RoommateOwnerStateDocument | undefined;
  const snapshot = owner?.latest_post_id ? await db.collection(ROOMMATE_COLLECTIONS.posts).doc(owner.latest_post_id).get() : null;
  const post = snapshot?.data() as RoommatePostDocument | undefined;
  const held = !!owner?.hold_until && owner.hold_until.toMillis() > now;
  return {
    post: post && post.owner_key === ownerKey && post.expires_at.toMillis() > now ? { ...serializeRoommatePost(post, snapshot!.id, now), isOwner: true } : null,
    holdUntil: held ? owner!.hold_until!.toDate().toISOString() : null,
    holdReason: held ? owner!.hold_reason ?? null : null,
  };
}

function storedInput(input: RoommatePostInput) {
  return {
    nickname: input.nickname, dorm: input.dorm, room_size: input.roomSize,
    stay_start: input.stayStart, stay_end: input.stayEnd, roommates_needed: input.roommatesNeeded,
    recruit_deadline: input.recruitUntil, habits: input.habits, description: input.description,
    open_chat_url: input.openChatUrl,
    recruit_until: admin.firestore.Timestamp.fromMillis(recruitDeadlineMillis(input.recruitUntil)),
  };
}

function assertNotHeld(owner: RoommateOwnerStateDocument | undefined, now: number) {
  if (owner?.hold_until && owner.hold_until.toMillis() > now) throw new RoommateError(403, "WRITING_HELD", "관리자에 의해 글 작성이 보류되어 있습니다.");
}

function ownerActivity(now: number) {
  return { updated_at: admin.firestore.Timestamp.fromMillis(now), expires_at: admin.firestore.Timestamp.fromMillis(now + 90 * DAY_MS) };
}

// Reserve inside the same transaction as the successful action. Conflicts and
// invalid attempts cannot consume the user's daily registration/report allowance.
async function dailyAllowance(transaction: Transaction, ownerKey: string, scope: "create" | "report", limit: number, now: number): Promise<{ ref: DocumentReference; data: Record<string, unknown> }> {
  const ref = getFirestore().collection("api_rate_limits").doc(createHash("sha256").update(`roommates:${scope}:${ownerKey}:${Math.floor(now / DAY_MS)}`).digest("hex"));
  const snapshot = await transaction.get(ref);
  const count = Number(snapshot.get("count") ?? 0);
  const resetAt = (Math.floor(now / DAY_MS) + 1) * DAY_MS;
  if (count >= limit) throw new RoommateError(429, "RATE_LIMITED", `오늘 이용 가능한 횟수를 초과했습니다. ${Math.max(1, Math.ceil((resetAt - now) / 1000))}초 후 다시 시도해주세요.`);
  const expiry = admin.firestore.Timestamp.fromMillis(resetAt);
  return { ref, data: { count: count + 1, reset_at: expiry, expires_at: expiry } };
}

export async function createRoommatePost(ownerKey: string, value: unknown, now = Date.now()): Promise<RoommatePost> {
  const input = normalizeRoommatePostInput(value, { now });
  const db = getFirestore();
  const postRef = db.collection(ROOMMATE_COLLECTIONS.posts).doc();
  const ownerRef = db.collection(ROOMMATE_COLLECTIONS.owners).doc(ownerKey);
  const result = await db.runTransaction(async (transaction) => {
    const owner = (await transaction.get(ownerRef)).data() as RoommateOwnerStateDocument | undefined;
    assertNotHeld(owner, now);
    const active = owner?.active_post_id ? (await transaction.get(db.collection(ROOMMATE_COLLECTIONS.posts).doc(owner.active_post_id))).data() as RoommatePostDocument | undefined : undefined;
    if (active && isRecruiting(active, now)) throw new RoommateError(409, "ACTIVE_POST_EXISTS", "모집 중인 글은 하나만 등록할 수 있습니다.");
    const allowance = await dailyAllowance(transaction, ownerKey, "create", 3, now);
    const timestamp = admin.firestore.Timestamp.fromMillis(now);
    const fields = storedInput(input);
    const post: RoommatePostDocument = {
      ...fields, owner_key: ownerKey, status: "recruiting", version: 1,
      created_at: timestamp, updated_at: timestamp,
      disclosure_consent: { accepted_at: timestamp, policy_version: ROOMMATE_DISCLOSURE_POLICY_VERSION },
      expires_at: admin.firestore.Timestamp.fromMillis(fields.recruit_until.toMillis() + 30 * DAY_MS),
    };
    transaction.create(postRef, post);
    transaction.set(ownerRef, { ...(!owner ? { version: 1 } : {}), active_post_id: postRef.id, latest_post_id: postRef.id, ...ownerActivity(now) }, { merge: true });
    transaction.set(allowance.ref, allowance.data);
    return post;
  });
  return { ...serializeRoommatePost(result, postRef.id, now), isOwner: true };
}

export async function mutateRoommatePost(ownerKey: string, id: string, action: "update" | "complete" | "delete", value: unknown, now = Date.now()): Promise<RoommatePost> {
  assertRoommatePostId(id);
  const body = roommateObject(value);
  assertRoommateFields(body, action === "update" ? ["action", "expectedVersion", ...ROOMMATE_INPUT_FIELDS] : action === "complete" ? ["action", "expectedVersion"] : ["expectedVersion"]);
  if (action !== "delete" && body.action !== action) throw new RoommateError(400, "INVALID_ACTION", "요청 동작을 확인해주세요.", "action");
  const expectedVersion = expectedRoommateVersion(body.expectedVersion);
  const db = getFirestore();
  const postRef = db.collection(ROOMMATE_COLLECTIONS.posts).doc(id);
  const ownerRef = db.collection(ROOMMATE_COLLECTIONS.owners).doc(ownerKey);
  const result = await db.runTransaction(async (transaction) => {
    const post = (await transaction.get(postRef)).data() as RoommatePostDocument | undefined;
    if (!post || post.expires_at.toMillis() <= now) notFound();
    if (post.owner_key !== ownerKey) throw new RoommateError(403, "NOT_POST_OWNER", "본인의 글만 관리할 수 있습니다.");
    if (post.version !== expectedVersion) throw new RoommateError(409, "VERSION_CONFLICT", "글이 변경되었습니다. 최신 내용을 확인해주세요.");
    const owner = (await transaction.get(ownerRef)).data() as RoommateOwnerStateDocument | undefined;
    if ((action === "delete" && post.status === "deleted") || (action === "complete" && post.status === "completed")) return post;
    const timestamp = admin.firestore.Timestamp.fromMillis(now);
    let updated: RoommatePostDocument;
    if (action === "update") {
      assertNotHeld(owner, now);
      if (!isRecruiting(post, now)) throw new RoommateError(409, "POST_CLOSED", "모집 중인 글만 수정할 수 있습니다.");
      const fields = Object.fromEntries(ROOMMATE_INPUT_FIELDS.map((key) => [key, body[key]]));
      const input = normalizeRoommatePostInput(fields, { now, createdAt: post.created_at.toMillis(), previousDeadline: post.recruit_deadline });
      updated = { ...post, ...storedInput(input), version: post.version + 1, updated_at: timestamp,
        disclosure_consent: { accepted_at: timestamp, policy_version: ROOMMATE_DISCLOSURE_POLICY_VERSION } };
      updated.expires_at = retentionExpiry(updated);
    } else {
      if (action === "complete" && post.status !== "recruiting") throw new RoommateError(409, "POST_CLOSED", "모집 중인 글만 완료할 수 있습니다.");
      updated = { ...post, status: action === "delete" ? "deleted" : "completed", version: post.version + 1, updated_at: timestamp, closed_at: post.closed_at ?? timestamp };
      updated.expires_at = retentionExpiry(updated);
    }
    transaction.set(postRef, updated);
    transaction.set(ownerRef, { ...(!owner ? { version: 1, latest_post_id: id, active_post_id: action === "update" ? id : null } : {}), ...(action !== "update" && owner?.active_post_id === id ? { active_post_id: null } : {}), ...ownerActivity(now) }, { merge: true });
    return updated;
  });
  return { ...serializeRoommatePost(result, id, now), isOwner: true };
}

export async function reportRoommatePost(ownerKey: string, id: string, value: unknown, now = Date.now()): Promise<void> {
  assertRoommatePostId(id);
  const input = normalizeRoommateReportInput(value);
  const db = getFirestore();
  const postRef = db.collection(ROOMMATE_COLLECTIONS.posts).doc(id);
  const reportRef = db.collection(ROOMMATE_COLLECTIONS.reports).doc(createHash("sha256").update(`${id}:${ownerKey}`).digest("hex"));
  await db.runTransaction(async (transaction) => {
    const post = (await transaction.get(postRef)).data() as RoommatePostDocument | undefined;
    if (!post || !isRecruiting(post, now)) notFound();
    if (post.owner_key === ownerKey) throw new RoommateError(403, "SELF_REPORT", "본인의 글은 신고할 수 없습니다.");
    if ((await transaction.get(reportRef)).exists) throw new RoommateError(409, "ALREADY_REPORTED", "이미 신고한 글입니다.");
    const allowance = await dailyAllowance(transaction, ownerKey, "report", 5, now);
    const timestamp = admin.firestore.Timestamp.fromMillis(now);
    const report: RoommateReportDocument = {
      post_id: id, reporter_key: ownerKey, ...input,
      evidence: { postId: id, nickname: post.nickname, description: post.description, openChatUrl: post.open_chat_url, dorm: post.dorm, roomSize: post.room_size, version: post.version },
      status: "pending", version: 1, created_at: timestamp, updated_at: timestamp,
      expires_at: admin.firestore.Timestamp.fromMillis(now + 30 * DAY_MS),
    };
    transaction.create(reportRef, report);
    transaction.set(allowance.ref, allowance.data);
  });
}
