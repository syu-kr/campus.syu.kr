import { createHash, randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { initializeApp, deleteApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initializeApp as initializeClientApp, deleteApp as deleteClientApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth as getClientAuth, inMemoryPersistence, setPersistence, signInWithEmailLink, signOut } from "firebase/auth";
import { NextRequest } from "next/server";
import * as mailRoute from "@/app/api/roommates/auth/request-link/route";
import * as sessionRoute from "@/app/api/roommates/auth/session/route";
import * as logoutRoute from "@/app/api/roommates/auth/logout/route";
import * as postsRoute from "@/app/api/roommates/posts/route";
import * as detailRoute from "@/app/api/roommates/posts/[postId]/route";
import * as mineRoute from "@/app/api/roommates/posts/me/route";
import * as reportsRoute from "@/app/api/roommates/posts/[postId]/reports/route";
import * as adminPostsRoute from "@/app/api/admin/roommate-posts/route";
import * as adminReportsRoute from "@/app/api/admin/roommate-reports/route";
import { cleanupRoommateDocuments } from "@/scripts/roommate-cleanup";
import { getRoommateOwnerKey, ROOMMATE_SESSION_COOKIE } from "@/lib/server/roommate-auth";
import { koreaDate, DAY_MS } from "@/lib/roommates";
import type { RoommatePost, RoommatePostInput } from "@/types/roommates";

const PROJECT = "demo-syu-roommates";
const AUTH_HOST = "127.0.0.1:9098";
const FIRESTORE_HOST = "127.0.0.1:8188";
const ORIGIN = "http://localhost:3001";
const clientApps: FirebaseApp[] = [];
const nativeFetch = globalThis.fetch;
let externalAttempts = 0;
let linkedEmails = 0;
const db = () => getFirestore();

function assertLocalEnvironment() {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== AUTH_HOST ||
      process.env.FIRESTORE_EMULATOR_HOST !== FIRESTORE_HOST ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== PROJECT || !PROJECT.startsWith("demo-")) {
    throw new Error("Roommate integration tests require the isolated local demo emulators.");
  }
}

function request(path: string, options: { method?: string; cookie?: string; token?: string; body?: unknown; origin?: string } = {}) {
  const headers = new Headers({ origin: options.origin ?? ORIGIN, "x-forwarded-for": "127.0.0.1" });
  if (options.cookie) headers.set("cookie", options.cookie);
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  if (options.body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(`${ORIGIN}${path}`, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"), headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function responseData<T>(response: Response, status = 200): Promise<T> {
  const data = await response.json();
  expect(response.status, JSON.stringify(data)).toBe(status);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  return data as T;
}

async function localFetch(path: string, init?: RequestInit) {
  assertLocalEnvironment();
  const result = await globalThis.fetch(`http://${AUTH_HOST}${path}`, init);
  if (!result.ok) throw new Error(`Local Auth emulator returned ${result.status}`);
  return result;
}

async function signIn(email: string, remember = true) {
  await responseData(await mailRoute.POST(request("/api/roommates/auth/request-link", { body: { email, locale: "ko" } })));
  const codes = await (await localFetch(`/emulator/v1/projects/${PROJECT}/oobCodes`)).json() as {
    oobCodes: { email: string; oobCode: string }[];
  };
  const code = [...codes.oobCodes].reverse().find((entry) => entry.email === email);
  expect(code).toBeDefined();
  const app = initializeClientApp({ apiKey: "demo-api-key", projectId: PROJECT, authDomain: `${PROJECT}.firebaseapp.com` }, `integration-${linkedEmails++}`);
  clientApps.push(app);
  const auth = getClientAuth(app);
  connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
  await setPersistence(auth, inMemoryPersistence);
  const link = `${ORIGIN}/campus/roommates/verify/finish?mode=signIn&oobCode=${code!.oobCode}&apiKey=demo-api-key`;
  const credential = await signInWithEmailLink(auth, email, link);
  const token = await credential.user.getIdToken();
  const response = await sessionRoute.POST(request("/api/roommates/auth/session", { body: { idToken: token, remember } }));
  const session = await responseData<{ expiresAt: string; sessionTag: string }>(response);
  const setCookie = response.headers.get("set-cookie")!;
  const cookie = setCookie.split(";")[0];
  return { email, auth, uid: credential.user.uid, token, link, cookie, setCookie, session, ownerKey: getRoommateOwnerKey(email) };
}

function postInput(nickname = "로컬 학생"): RoommatePostInput {
  return {
    nickname, dorm: "eden", roomSize: 4, roommatesNeeded: 1,
    stayStart: koreaDate(), stayEnd: koreaDate(Date.now() + 60 * DAY_MS), recruitUntil: koreaDate(Date.now() + 20 * DAY_MS),
    habits: { smoking: "nonsmoker", bedtime: "22to24", calls: "outside" },
    description: "실제 에뮬레이터 통합 시험용 가상 게시글입니다.", openChatUrl: "https://open.kakao.com/o/TestLocal123",
  };
}

async function createPost(cookie: string, input = postInput()) {
  return (await responseData<{ post: RoommatePost }>(await postsRoute.POST(request("/api/roommates/posts", { cookie, body: input })), 201)).post;
}

function context(postId: string) { return { params: Promise.resolve({ postId }) }; }

beforeAll(async () => {
  assertLocalEnvironment();
  // Explicit project and preinitialized default app prevent .env.local/ADC lookup.
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  process.env.GOOGLE_CLOUD_PROJECT = PROJECT;
  process.env.GCLOUD_PROJECT = PROJECT;
  process.env.ROOMMATES_ENABLED = "true";
  process.env.ROOMMATES_WRITES_ENABLED = "true";
  process.env.ROOMMATES_EMAIL_ENABLED = "true";
  process.env.ROOMMATES_OWNER_KEY_SECRET = randomBytes(32).toString("hex");
  process.env.RATE_LIMIT_SECRET = randomBytes(32).toString("hex");
  process.env.ADMIN_EMAILS = "local-admin@syuin.ac.kr";
  delete process.env.ADMIN_EMAIL;
  delete process.env.admin_email;
  if (getApps().length) throw new Error("Integration tests require a fresh Firebase Admin process.");
  initializeApp({ projectId: PROJECT });
  globalThis.fetch = async (input, init) => {
    assertLocalEnvironment();
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === "https://identitytoolkit.googleapis.com" && url.pathname === "/v1/accounts:sendOobCode" &&
        url.searchParams.get("key") === "demo-api-key") {
      url.protocol = "http:";
      url.host = AUTH_HOST;
      url.pathname = `/identitytoolkit.googleapis.com${url.pathname}`;
      return nativeFetch(url, init);
    }
    if (url.protocol === "http:" && [AUTH_HOST, FIRESTORE_HOST].includes(url.host)) return nativeFetch(input, init);
    externalAttempts++;
    throw new Error("External requests are forbidden in roommate integration tests.");
  };
});

beforeEach(async () => {
  assertLocalEnvironment();
  const cleared = await globalThis.fetch(`http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  expect(cleared.ok).toBe(true);
  await localFetch(`/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
  process.env.ROOMMATES_ENABLED = "true";
  process.env.ROOMMATES_WRITES_ENABLED = "true";
  process.env.ROOMMATES_EMAIL_ENABLED = "true";
  externalAttempts = 0;
});

afterEach(async () => {
  expect(externalAttempts).toBe(0);
  for (const app of clientApps.splice(0)) {
    await signOut(getClientAuth(app));
    await deleteClientApp(app);
  }
});

afterAll(async () => {
  globalThis.fetch = nativeFetch;
  await getFirestore().terminate();
  for (const app of getApps()) await deleteApp(app);
});

describe("roommates using real local Auth and Firestore emulators", () => {
  it("consumes a native email link once and persists a private hashed session with a 30-day cookie", async () => {
    const student = await signIn("student-a@syuin.ac.kr");
    expect(student.setCookie).toContain(`${ROOMMATE_SESSION_COOKIE}=`);
    for (const attribute of ["HttpOnly", "Secure", "SameSite=lax", "Path=/"]) expect(student.setCookie).toContain(attribute);
    expect(student.session.sessionTag).toMatch(/^[a-f0-9]{64}$/);
    const decoded = await getAuth().verifyIdToken(student.token, true);
    expect(new Date(student.session.expiresAt).getTime() - decoded.auth_time * 1000).toBe(30 * DAY_MS);
    await expect(signInWithEmailLink(student.auth, student.email, student.link)).rejects.toMatchObject({ code: "auth/invalid-action-code" });
    const sessions = await db().collection("roommate_sessions").get();
    expect(sessions.size).toBe(1);
    const rawToken = student.cookie.split("=")[1];
    expect(sessions.docs[0].id).toBe(createHash("sha256").update(rawToken).digest("hex"));
    expect(JSON.stringify(sessions.docs[0].data())).not.toContain(student.email);
    expect(JSON.stringify(sessions.docs[0].data())).not.toContain(rawToken);
    expect((await db().collection("roommate_owner_state").get()).empty).toBe(true);
    await responseData(await sessionRoute.GET(request("/api/roommates/auth/session", { cookie: student.cookie })));
  });

  it("keeps an opt-out session for 12 hours and revokes it through logout", async () => {
    const student = await signIn("student-a@syuin.ac.kr", false);
    const decoded = await getAuth().verifyIdToken(student.token, true);
    expect(new Date(student.session.expiresAt).getTime() - decoded.auth_time * 1000).toBe(12 * 60 * 60_000);
    process.env.ROOMMATES_ENABLED = "false";
    const logout = await logoutRoute.POST(request("/api/roommates/auth/logout", { method: "POST", cookie: student.cookie }));
    await responseData(logout);
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
    expect((await db().collection("roommate_sessions").get()).empty).toBe(true);
    process.env.ROOMMATES_ENABLED = "true";
    await responseData(await sessionRoute.GET(request("/api/roommates/auth/session", { cookie: student.cookie })), 401);
  });

  it("rejects anonymous requests, wrong domains, cross-origin submissions and cooldown duplicates", async () => {
    await responseData(await postsRoute.GET(request("/api/roommates/posts")), 401);
    await responseData(await mailRoute.POST(request("/api/roommates/auth/request-link", { body: { email: "outsider@example.com", locale: "ko" } })), 400);
    await responseData(await mailRoute.POST(request("/api/roommates/auth/request-link", { origin: "https://example.com", body: { email: "student-a@syuin.ac.kr", locale: "ko" } })), 403);
    const student = await signIn("student-a@syuin.ac.kr");
    const limited = await mailRoute.POST(request("/api/roommates/auth/request-link", { body: { email: student.email, locale: "ko" } }));
    const body = await responseData<{ retryAt: string }>(limited, 429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
    expect(new Date(body.retryAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("serializes racing creates, filters lists and prevents cross-owner writes and duplicate reports", async () => {
    const author = await signIn("student-a@syuin.ac.kr");
    const reader = await signIn("student-b@syuin.ac.kr");
    const racing = await Promise.all([postsRoute.POST(request("/api/roommates/posts", { cookie: author.cookie, body: postInput() })), postsRoute.POST(request("/api/roommates/posts", { cookie: author.cookie, body: postInput() }))]);
    expect(racing.map((response) => response.status).sort()).toEqual([201, 409]);
    const post = (await racing.find((response) => response.status === 201)!.json()).post as RoommatePost;
    expect((await db().collection("roommate_posts").get()).size).toBe(1);
    await createPost(reader.cookie, { ...postInput("다른 학생"), dorm: "sion", roomSize: 3 });
    const list = await responseData<{ items: RoommatePost[] }>(await postsRoute.GET(request("/api/roommates/posts?dorm=eden&smoking=nonsmoker", { cookie: reader.cookie })));
    expect(list.items.map((entry) => entry.id)).toEqual([post.id]);
    expect(list.items[0]).not.toHaveProperty("ownerKey");
    expect(list.items[0]).not.toHaveProperty("openChatUrl");
    await responseData(await detailRoute.PATCH(request(`/api/roommates/posts/${post.id}`, { method: "PATCH", cookie: reader.cookie, body: { ...postInput(), action: "update", expectedVersion: 1 } }), context(post.id)), 403);
    await responseData(await reportsRoute.POST(request(`/api/roommates/posts/${post.id}/reports`, { cookie: author.cookie, body: { reason: "spam", description: "self" } }), context(post.id)), 403);
    await responseData(await reportsRoute.POST(request(`/api/roommates/posts/${post.id}/reports`, { cookie: reader.cookie, body: { reason: "false_info", description: "가상 신고" } }), context(post.id)), 201);
    await responseData(await reportsRoute.POST(request(`/api/roommates/posts/${post.id}/reports`, { cookie: reader.cookie, body: { reason: "spam", description: "duplicate" } }), context(post.id)), 409);
    expect((await db().collection("roommate_reports").get()).size).toBe(1);
  });

  it("updates with optimistic versions, completes, deletes and preserves the original retention deadline", async () => {
    const author = await signIn("student-a@syuin.ac.kr");
    const post = await createPost(author.cookie);
    const edited = await responseData<{ post: RoommatePost }>(await detailRoute.PATCH(request(`/api/roommates/posts/${post.id}`, { method: "PATCH", cookie: author.cookie, body: { ...postInput("수정 학생"), action: "update", expectedVersion: 1 } }), context(post.id)));
    expect(edited.post.version).toBe(2);
    await responseData(await detailRoute.PATCH(request(`/api/roommates/posts/${post.id}`, { method: "PATCH", cookie: author.cookie, body: { action: "complete", expectedVersion: 1 } }), context(post.id)), 409);
    process.env.ROOMMATES_WRITES_ENABLED = "false";
    const completed = await responseData<{ post: RoommatePost }>(await detailRoute.PATCH(request(`/api/roommates/posts/${post.id}`, { method: "PATCH", cookie: author.cookie, body: { action: "complete", expectedVersion: 2 } }), context(post.id)));
    expect(completed.post.status).toBe("completed");
    await responseData(await detailRoute.GET(request(`/api/roommates/posts/${post.id}`, { cookie: author.cookie }), context(post.id)), 404);
    const deleted = await responseData<{ post: RoommatePost }>(await detailRoute.DELETE(request(`/api/roommates/posts/${post.id}`, { method: "DELETE", cookie: author.cookie, body: { expectedVersion: 3 } }), context(post.id)));
    expect(deleted.post.status).toBe("deleted");
    expect(deleted.post.expiresAt).toBe(completed.post.expiresAt);
    expect((await db().collection("roommate_owner_state").doc(author.ownerKey).get()).get("active_post_id")).toBeNull();
  });

  it("uses real admin tokens to hide, hold, restore, release and resolve reports with audit records", async () => {
    const author = await signIn("student-a@syuin.ac.kr");
    const reporter = await signIn("student-b@syuin.ac.kr");
    const admin = await signIn("local-admin@syuin.ac.kr");
    const post = await createPost(author.cookie);
    await responseData(await adminPostsRoute.GET(request("/api/admin/roommate-posts")), 401);
    await responseData(await adminPostsRoute.GET(request("/api/admin/roommate-posts", { token: author.token })), 403);
    await responseData(await reportsRoute.POST(request(`/api/roommates/posts/${post.id}/reports`, { cookie: reporter.cookie, body: { reason: "privacy", description: "가상 신고" } }), context(post.id)), 201);
    const queue = await responseData<{ items: { id: string; evidence: { version: number } }[]; pendingCount: number }>(await adminReportsRoute.GET(request("/api/admin/roommate-reports", { token: admin.token })));
    expect(queue.pendingCount).toBe(1);
    expect(queue.items[0].evidence.version).toBe(1);
    await responseData(await adminPostsRoute.PATCH(request("/api/admin/roommate-posts", { method: "PATCH", token: admin.token, body: { id: post.id, action: "hide", expectedVersion: 1, reason: "테스트 보류" } })));
    const mine = await responseData<{ holdUntil: string; post: RoommatePost }>(await mineRoute.GET(request("/api/roommates/posts/me", { cookie: author.cookie })));
    expect(mine.post.status).toBe("hidden");
    expect(new Date(mine.holdUntil).getTime()).toBeGreaterThan(Date.now() + 29 * DAY_MS);
    await responseData(await postsRoute.POST(request("/api/roommates/posts", { cookie: author.cookie, body: postInput() })), 403);
    await responseData(await detailRoute.GET(request(`/api/roommates/posts/${post.id}`, { cookie: reporter.cookie }), context(post.id)), 404);
    await responseData(await adminPostsRoute.PATCH(request("/api/admin/roommate-posts", { method: "PATCH", token: admin.token, body: { id: post.id, action: "restore", expectedVersion: 2 } })));
    expect((await db().collection("roommate_owner_state").doc(author.ownerKey).get()).get("hold_until")).toBeInstanceOf(Timestamp);
    await responseData(await detailRoute.PATCH(request(`/api/roommates/posts/${post.id}`, { method: "PATCH", cookie: author.cookie, body: { ...postInput(), action: "update", expectedVersion: 3 } }), context(post.id)), 403);
    const owner = await db().collection("roommate_owner_state").doc(author.ownerKey).get();
    await responseData(await adminPostsRoute.PATCH(request("/api/admin/roommate-posts", { method: "PATCH", token: admin.token, body: { ownerKey: author.ownerKey, action: "release_hold", expectedOwnerVersion: owner.get("version") } })));
    await responseData(await detailRoute.PATCH(request(`/api/roommates/posts/${post.id}`, { method: "PATCH", cookie: author.cookie, body: { ...postInput(), action: "update", expectedVersion: 3 } }), context(post.id)));
    await responseData(await adminReportsRoute.PATCH(request("/api/admin/roommate-reports", { method: "PATCH", token: admin.token, body: { id: queue.items[0].id, expectedVersion: 1, status: "done", memo: "검증 완료" } })));
    expect((await db().collection("admin_audit_logs").get()).size).toBe(4);
    const after = await responseData<{ pendingCount: number }>(await adminReportsRoute.GET(request("/api/admin/roommate-reports", { token: admin.token })));
    expect(after.pendingCount).toBe(0);
  });

  it("rejects disabled, revoked, deleted, changed-email and expired sessions using actual Auth state", async () => {
    const student = await signIn("student-a@syuin.ac.kr");
    await getAuth().updateUser(student.uid, { disabled: true });
    await responseData(await sessionRoute.GET(request("/api/roommates/auth/session", { cookie: student.cookie })), 401);
    await getAuth().updateUser(student.uid, { disabled: false, email: "changed@syuin.ac.kr" });
    await responseData(await sessionRoute.GET(request("/api/roommates/auth/session", { cookie: student.cookie })), 401);
    await getAuth().updateUser(student.uid, { email: student.email });
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await getAuth().revokeRefreshTokens(student.uid);
    await responseData(await sessionRoute.GET(request("/api/roommates/auth/session", { cookie: student.cookie })), 401);
    const second = await signIn("student-b@syuin.ac.kr");
    await getAuth().deleteUser(second.uid);
    await responseData(await sessionRoute.GET(request("/api/roommates/auth/session", { cookie: second.cookie })), 401);
    const third = await signIn("student-c@syuin.ac.kr");
    const sessions = await db().collection("roommate_sessions").where("firebase_uid", "==", third.uid).get();
    await sessions.docs[0].ref.update({ expires_at: Timestamp.fromMillis(Date.now() - 1) });
    await responseData(await sessionRoute.GET(request("/api/roommates/auth/session", { cookie: third.cookie })), 401);
  });

  it("denies direct anonymous and authenticated Firestore client reads and writes for all private collections", async () => {
    const student = await signIn("student-a@syuin.ac.kr");
    const post = await createPost(student.cookie);
    for (const collection of ["roommate_posts", "roommate_sessions", "roommate_owner_state", "roommate_reports"]) {
      const id = collection === "roommate_posts" ? post.id : "private-test-document";
      const url = `http://${FIRESTORE_HOST}/v1/projects/${PROJECT}/databases/(default)/documents/${collection}/${id}`;
      for (const token of [null, student.token]) {
        const headers: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
        expect((await globalThis.fetch(url, { headers })).status).toBe(403);
        expect((await globalThis.fetch(url, { method: "PATCH", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ fields: { nickname: { stringValue: "forbidden" } } }) })).status).toBe(403);
      }
    }
  });

  it("cleans expired records with unresolved-report audit while preserving held owners and Firebase Auth users", async () => {
    const author = await signIn("student-a@syuin.ac.kr");
    const reporter = await signIn("student-b@syuin.ac.kr");
    const post = await createPost(author.cookie);
    await responseData(await reportsRoute.POST(request(`/api/roommates/posts/${post.id}/reports`, { cookie: reporter.cookie, body: { reason: "spam", description: "가상 미처리 신고" } }), context(post.id)), 201);
    const now = Timestamp.now();
    const past = Timestamp.fromMillis(now.toMillis() - DAY_MS);
    await db().collection("roommate_posts").doc(post.id).update({ expires_at: past });
    const report = (await db().collection("roommate_reports").get()).docs[0];
    await report.ref.update({ expires_at: past });
    const sessions = await db().collection("roommate_sessions").get();
    for (const session of sessions.docs) await session.ref.update({ expires_at: past });
    await db().collection("roommate_owner_state").doc(author.ownerKey).update({ updated_at: Timestamp.fromMillis(now.toMillis() - 91 * DAY_MS), expires_at: past, hold_until: Timestamp.fromMillis(now.toMillis() + DAY_MS) });
    const result = await cleanupRoommateDocuments(db(), now);
    expect(result).toEqual({ sessions: 2, posts: 1, reports: 1, owners: 0 });
    expect((await db().collection("roommate_owner_state").doc(author.ownerKey).get()).exists).toBe(true);
    expect((await db().collection("admin_audit_logs").where("action", "==", "roommate_report_expired_unresolved").get()).size).toBe(1);
    expect((await getAuth().getUser(author.uid)).email).toBe(author.email);
  });
});
