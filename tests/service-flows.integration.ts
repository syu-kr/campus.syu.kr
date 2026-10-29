import { createHash, randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { NextRequest } from "next/server";
import * as contact from "@/app/api/contact/route";
import * as submissions from "@/app/api/admin/submissions/route";
import * as shares from "@/app/api/lecture/timetable/shares/route";
import * as share from "@/app/api/lecture/timetable/shares/[shareId]/route";
import * as rooms from "@/app/api/meet/rooms/route";
import * as room from "@/app/api/meet/rooms/[roomId]/route";
import * as participants from "@/app/api/meet/rooms/[roomId]/participants/route";
import * as subscriptions from "@/app/api/notifications/subscribe/route";
import * as notifications from "@/app/api/notifications/send/route";
import { isPublishedNow, mutateManagedContent, readPublishedManagedContentRecord, readPublishedManagedContentRecords } from "@/lib/server/managed-content";
import type { ManagedNoticeDraft } from "@/types/managed-content";

// Only the external FCM transport is replaced; handlers, Auth, transactions and queries remain real.
const { sendEachForMulticast } = vi.hoisted(() => ({ sendEachForMulticast: vi.fn() }));
vi.mock("firebase-admin/messaging", () => ({ getMessaging: () => ({ sendEachForMulticast }) }));

const PROJECT = "demo-syu-roommates";
const AUTH = "127.0.0.1:9098";
const FIRESTORE = "127.0.0.1:8188";
const ORIGIN = "http://localhost:3001";
const nativeFetch = globalThis.fetch;
let externalAttempts = 0;
let requester = 0;
let ip = "";
let adminToken = "";
const db = () => getFirestore();

function assertLocalEnvironment() {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== AUTH ||
      process.env.FIRESTORE_EMULATOR_HOST !== FIRESTORE ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== PROJECT || !PROJECT.startsWith("demo-")) {
    throw new Error("Service integration tests require isolated local demo emulators.");
  }
}

function request(path: string, options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  return new NextRequest(`${ORIGIN}${path}`, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers: { origin: ORIGIN, "content-type": "application/json", "x-forwarded-for": ip, ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function json<T = Record<string, unknown>>(response: Response, status = 200): Promise<T> {
  const data = await response.json();
  expect(response.status, JSON.stringify(data)).toBe(status);
  return data as T;
}

const roomContext = (roomId: string) => ({ params: Promise.resolve({ roomId }) });
const shareContext = (shareId: string) => ({ params: Promise.resolve({ shareId }) });

beforeAll(() => {
  assertLocalEnvironment();
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  process.env.GOOGLE_CLOUD_PROJECT = PROJECT;
  process.env.GCLOUD_PROJECT = PROJECT;
  process.env.RATE_LIMIT_SECRET = randomBytes(32).toString("hex");
  process.env.PUSH_API_KEY = randomBytes(32).toString("hex");
  if (getApps().length) throw new Error("Integration tests need a fresh Admin process.");
  initializeApp({ projectId: PROJECT });
  // Satisfy the CMS configuration guard without credentials; the initialized app is emulator-only.
  process.env.FIREBASE_SERVICE_ACCOUNT = "emulator-only-not-a-credential";
  globalThis.fetch = async (input, init) => {
    assertLocalEnvironment();
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.protocol === "http:" && [AUTH, FIRESTORE].includes(url.host)) return nativeFetch(input, init);
    externalAttempts++;
    throw new Error("External network is forbidden in local service-flow tests.");
  };
});

beforeEach(async () => {
  assertLocalEnvironment();
  ip = `198.51.100.${++requester}`;
  externalAttempts = 0;
  expect((await fetch(`http://${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" })).ok).toBe(true);
  expect((await fetch(`http://${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" })).ok).toBe(true);
  const identity = await json<{ idToken: string; localId: string }>(await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }),
  }));
  adminToken = identity.idToken;
  process.env.ADMIN_UIDS = identity.localId;
  sendEachForMulticast.mockReset().mockImplementation(async ({ tokens }: { tokens: string[] }) => ({
    successCount: tokens.length, failureCount: 0, responses: tokens.map(() => ({ success: true })),
  }));
});

afterEach(() => { expect(externalAttempts).toBe(0); });
afterAll(async () => {
  globalThis.fetch = nativeFetch;
  await Promise.all(getApps().map(deleteApp));
});

describe("local real-handler service round trips", () => {
  it("persists an inquiry, lists it only for an authenticated administrator, and records status history", async () => {
    const input = { type: "bug", title: "로컬 문의 접수 시험", message: "실제 사용자에게 전달하지 않는 합성 문의입니다.", contact: "test@example.invalid", pageUrl: `${ORIGIN}/more/contact` };
    const { id } = await json<{ id: string }>(await contact.POST(request("/api/contact", { body: input })));
    expect((await db().collection("site_inquiries").doc(id).get()).data()).toMatchObject({
      type: input.type, title: input.title, message: input.message, contact: input.contact, status: "pending",
    });
    await json(await submissions.GET(request("/api/admin/submissions?kind=inquiry")), 401);
    const headers = { authorization: `Bearer ${adminToken}` };
    const page = await json<{ submissions: { id: string; title: string; status: string }[] }>(await submissions.GET(request("/api/admin/submissions?kind=inquiry", { headers })));
    expect(page.submissions).toContainEqual(expect.objectContaining({ id, title: input.title, status: "pending" }));
    await json(await submissions.PATCH(request("/api/admin/submissions", { method: "PATCH", headers, body: { kind: "inquiry", id, status: "done" } })));
    expect((await db().collection("site_inquiries").doc(id).get()).get("status")).toBe("done");
    const logs = await db().collection("admin_audit_logs").get();
    expect(logs.docs).toHaveLength(1);
    expect(logs.docs[0].get("targets")).toEqual([{ id, kind: "inquiry", previous_status: "pending" }]);
  });

  it("rejects invalid or cross-origin inquiries without storing an inquiry", async () => {
    await json(await contact.POST(request("/api/contact", { body: { type: "bug", title: "", message: "본문" } })), 400);
    await json(await contact.POST(request("/api/contact", { body: {}, headers: { origin: "https://example.invalid" } })), 403);
    expect((await db().collection("site_inquiries").get()).empty).toBe(true);
  });

  it("shares four timetable plans, reads them without an owner secret, rejects unauthorized deletion and deletes for the owner", async () => {
    const workspace = { activeTimetableId: "plan-3", isCompareMode: true, timetables: Array.from({ length: 4 }, (_, index) => ({ id: `plan-${index}`, courseIds: [`course-${index}`] })) };
    const { shareId, ownerToken } = await json<{ shareId: string; ownerToken: string }>(await shares.POST(request("/api/lecture/timetable/shares", { body: { workspace, year: "2026", semester: "2" } })));
    const context = shareContext(shareId);
    const response = await json<{ data: { courseIds: string[]; workspace: unknown } }>(await share.GET(request(`/api/lecture/timetable/shares/${shareId}`), context));
    expect(response.data).toMatchObject({ courseIds: ["course-3"], workspace, year: "2026", semester: "2" });
    expect(JSON.stringify(response)).not.toContain(ownerToken);
    expect(JSON.stringify(response)).not.toContain("owner_token_hash");
    await json(await share.DELETE(request(`/api/lecture/timetable/shares/${shareId}`, { method: "DELETE", headers: { "x-owner-token": "wrong" } }), context), 403);
    expect((await db().collection("timetable_shares").doc(shareId).get()).exists).toBe(true);
    await json(await share.DELETE(request(`/api/lecture/timetable/shares/${shareId}`, { method: "DELETE", headers: { "x-owner-token": ownerToken } }), context));
    await json(await share.GET(request(`/api/lecture/timetable/shares/${shareId}`), context), 404);
  });

  it("preserves legacy timetable shares and hides expired shares before physical cleanup", async () => {
    const { shareId } = await json<{ shareId: string }>(await shares.POST(request("/api/lecture/timetable/shares", { body: { courseIds: ["a", "b", "a"], year: "2026", semester: "2" } })));
    const context = shareContext(shareId);
    const response = await json<{ data: { courseIds: string[] } }>(await share.GET(request(`/api/lecture/timetable/shares/${shareId}`), context));
    expect(response.data.courseIds).toEqual(["a", "b"]);
    await db().collection("timetable_shares").doc(shareId).update({ expires_at: Timestamp.fromMillis(Date.now() - 1) });
    await json(await share.GET(request(`/api/lecture/timetable/shares/${shareId}`), context), 404);
    expect((await db().collection("timetable_shares").doc(shareId).get()).exists).toBe(true);
    await json(await shares.POST(request("/api/lecture/timetable/shares", { body: { workspace: { timetables: Array(5).fill({ id: "x", courseIds: ["a"] }) } } })), 400);
  });

  it("creates a Meet room, joins, updates with the same edit token, enforces closing, and recursively deletes for its owner", async () => {
    const input = { title: "로컬 일정 시험", description: "합성 방", dateStart: "2026-11-01", dateEnd: "2026-11-02", timeStart: "09:00", timeEnd: "10:00", slotMinutes: 30 };
    const { roomId, ownerToken, slots } = await json<{ roomId: string; ownerToken: string; slots: string[] }>(await rooms.POST(request("/api/meet/rooms", { body: input })));
    const context = roomContext(roomId);
    const first = await json<{ editToken: string; availability: string[] }>(await participants.PUT(request(`/api/meet/rooms/${roomId}/participants`, { method: "PUT", body: { nickname: "학생", availability: [slots[0], "invalid-slot"] } }), context));
    expect(first.availability).toEqual([slots[0]]);
    await json(await participants.PUT(request(`/api/meet/rooms/${roomId}/participants`, { method: "PUT", body: { nickname: "학생", availability: [] } }), context), 403);
    await json(await participants.PUT(request(`/api/meet/rooms/${roomId}/participants`, { method: "PUT", body: { nickname: "학생", availability: [slots[1]], editToken: first.editToken } }), context));
    const read = await json<{ room: { participantCount: number; acceptingResponses: boolean }; participants: { nickname: string; availability: string[] }[] }>(await room.GET(request(`/api/meet/rooms/${roomId}`), context));
    expect(read.room.participantCount).toBe(1);
    expect(read.participants).toEqual([expect.objectContaining({ nickname: "학생", availability: [slots[1]] })]);
    expect(JSON.stringify(read)).not.toContain(first.editToken);
    expect(JSON.stringify(read)).not.toContain(ownerToken);
    await db().collection("meet_rooms").doc(roomId).update({ response_closes_at: Timestamp.fromMillis(Date.now() - 1) });
    await json(await participants.PUT(request(`/api/meet/rooms/${roomId}/participants`, { method: "PUT", body: { nickname: "다른 학생", availability: [] } }), context), 403);
    expect((await json<{ room: { acceptingResponses: boolean } }>(await room.GET(request(`/api/meet/rooms/${roomId}`), context))).room.acceptingResponses).toBe(false);
    await json(await room.DELETE(request(`/api/meet/rooms/${roomId}`, { method: "DELETE", headers: { "x-owner-token": "wrong" } }), context), 403);
    await json(await room.DELETE(request(`/api/meet/rooms/${roomId}`, { method: "DELETE", headers: { "x-owner-token": ownerToken } }), context));
    expect((await db().collection("meet_rooms").doc(roomId).collection("participants").get()).empty).toBe(true);
    await json(await room.GET(request(`/api/meet/rooms/${roomId}`), context), 404);
  });

  it("publishes a scheduled notice at its exact start, hides at its end and preserves the unpublished draft", async () => {
    const start = Date.now() + 60_000;
    const draft: ManagedNoticeDraft = { kind: "notice", slug: "local-boundary", title: "로컬 예약 시험", summary: "요약", content: "본문", startsAt: new Date(start).toISOString(), endsAt: new Date(start + 60_000).toISOString() };
    const saved = await mutateManagedContent({ id: draft.slug, expectedRevision: 0, action: "publish", draft });
    expect(isPublishedNow(saved, start - 1)).toBe(false);
    expect(isPublishedNow(saved, start)).toBe(true);
    expect(isPublishedNow(saved, start + 60_000)).toBe(false);
    const projection = await readPublishedManagedContentRecords();
    expect(projection).toHaveLength(1);
    expect(projection[0]).not.toHaveProperty("draft");
    expect((await readPublishedManagedContentRecord(draft.slug))?.published?.title).toBe(draft.title);
    const unpublished = await mutateManagedContent({ id: draft.slug, expectedRevision: saved.revision, action: "unpublish" });
    expect(unpublished.published).toBeNull();
    expect(unpublished.draft).toEqual(draft);
    expect(isPublishedNow(unpublished, start)).toBe(false);
  });

  it("subscribes a synthetic device, checkpoints a mocked FCM delivery, deduplicates, and unsubscribes", async () => {
    const token = "synthetic-fcm-token-never-sent-to-google-1234567890";
    await json(await subscriptions.POST(request("/api/notifications/subscribe", { body: { fcm_token: token } })));
    const tokenId = createHash("sha256").update(token).digest("hex");
    expect((await db().collection("user_devices").doc(tokenId).get()).get("fcm_token")).toBe(token);
    const body = { title: "로컬 푸시 시험", body: "실제 기기로 전송하지 않습니다", category: "daily-summary", url: "/", dedupeKey: "local-roundtrip-20261029" };
    const headers = { "x-api-key": process.env.PUSH_API_KEY! };
    const first = await json<{ data: { successCount: number } }>(await notifications.POST(request("/api/notifications/send", { headers, body })));
    expect(first.data.successCount).toBe(1);
    expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
    const repeated = await json<{ alreadyProcessed: boolean }>(await notifications.POST(request("/api/notifications/send", { headers, body })));
    expect(repeated.alreadyProcessed).toBe(true);
    expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
    await json(await notifications.POST(request("/api/notifications/send", { headers, body: { ...body, body: "다른 본문" } })), 409);
    expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
    expect((await db().collection("notifications_sent").get()).docs).toHaveLength(1);
    const lock = (await db().collection("notification_send_locks").get()).docs[0];
    expect(lock.get("status")).toBe("sent");
    expect(lock.get("batch_progress")).toEqual([expect.objectContaining({ batch_index: 0, success_count: 1 })]);
    await json(await subscriptions.DELETE(request("/api/notifications/subscribe", { method: "DELETE", body: { fcm_token: token } })));
    expect((await db().collection("user_devices").doc(tokenId).get()).exists).toBe(false);
  });

  it("keeps a failed delivery lock and refuses automatic resend after an ambiguous transport failure", async () => {
    const token = "synthetic-fcm-failure-token-not-a-real-device-123456";
    await json(await subscriptions.POST(request("/api/notifications/subscribe", { body: { fcm_token: token } })));
    sendEachForMulticast.mockRejectedValueOnce(new Error("synthetic FCM transport failure"));
    const body = { title: "실패 복구 시험", body: "외부 발송 없음", category: "daily-summary", dedupeKey: "local-failed-20261029" };
    const headers = { "x-api-key": process.env.PUSH_API_KEY! };
    await json(await notifications.POST(request("/api/notifications/send", { headers, body })), 500);
    await json(await notifications.POST(request("/api/notifications/send", { headers, body })), 409);
    expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
    const lock = (await db().collection("notification_send_locks").get()).docs[0];
    expect(lock.get("status")).toBe("failed");
    expect((await db().collection("notifications_sent").get()).empty).toBe(true);
  });

  it("removes only an invalid device after a provider rejection and records the failed delivery count", async () => {
    const token = "synthetic-invalid-fcm-token-not-a-real-device-123456";
    await json(await subscriptions.POST(request("/api/notifications/subscribe", { body: { fcm_token: token } })));
    sendEachForMulticast.mockResolvedValueOnce({ successCount: 0, failureCount: 1, responses: [{ success: false, error: { code: "messaging/registration-token-not-registered" } }] });
    const body = { title: "잘못된 기기 시험", body: "외부 발송 없음", category: "daily-summary", dedupeKey: "local-invalid-device-20261029" };
    const response = await json<{ data: { failureCount: number } }>(await notifications.POST(request("/api/notifications/send", { headers: { "x-api-key": process.env.PUSH_API_KEY! }, body })));
    expect(response.data.failureCount).toBe(1);
    expect((await db().collection("user_devices").get()).empty).toBe(true);
    expect((await db().collection("notifications_sent").get()).docs[0].get("failureCount")).toBe(1);
  });
});
