import { createHash, createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { DecodedIdToken, UserRecord } from "firebase-admin/auth";
import { getAuth } from "firebase-admin/auth";
import { initializeFirebaseAdmin } from "@/lib/firebaseAdmin";
import { areRoommatesEnabled, ROOMMATE_SESSION_COOKIE, RoommateError } from "@/lib/roommates";
import { getRateLimitKey } from "@/lib/rate-limit";
import { admin, getFirestore } from "@/lib/server/firestore";
import { ApiError, enforceRateLimitKey } from "@/lib/server/http";

export { ROOMMATE_SESSION_COOKIE } from "@/lib/roommates";
const DAY_MS = 86_400_000;
const SESSION_COLLECTION = "roommate_sessions";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface RoommateSession {
  ownerKey: string;
  firebaseUid: string;
  authTime: number;
  expiresAt: string;
  sessionTag: string;
}

export function requireRoommatesEnabled() {
  if (!areRoommatesEnabled()) {
    throw new RoommateError(503, "FEATURE_DISABLED", "룸메이트 게시판을 준비 중입니다.");
  }
  requireOwnerSecret();
}

export function requireRoommateWritesEnabled() {
  if (process.env.ROOMMATES_WRITES_ENABLED !== "true") {
    throw new RoommateError(503, "WRITES_DISABLED", "새 글 작성과 수정을 잠시 중지했습니다.");
  }
}

function requireOwnerSecret() {
  const secret = process.env.ROOMMATES_OWNER_KEY_SECRET;
  if (!secret || secret.length < 32) {
    throw new RoommateError(503, "AUTH_CONFIG_MISSING", "인증 설정을 확인해 주세요.");
  }
  return secret;
}

export function normalizeSchoolEmail(value: unknown) {
  if (typeof value !== "string") throw new RoommateError(400, "INVALID_EMAIL", "학교 이메일을 입력해 주세요.", "email");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@syuin\.ac\.kr$/.test(email)) {
    throw new RoommateError(400, "INVALID_EMAIL", "@syuin.ac.kr 학교 이메일을 입력해 주세요.", "email");
  }
  return email;
}

export function getRoommateOwnerKey(email: string) {
  return createHmac("sha256", requireOwnerSecret()).update(normalizeSchoolEmail(email)).digest("hex");
}

export function enforceRoommateOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin || origin === "null" || origin !== roommateRequestOrigin(req)) {
    throw new RoommateError(403, "FORBIDDEN_ORIGIN", "허용되지 않은 출처의 요청입니다.");
  }
}

function roommateRequestOrigin(req: Request) {
  const url = new URL(req.url);
  const host = req.headers.get("host");
  // NextRequest normalizes loopback IPs to localhost. Recover only the actual local Host,
  // retaining the port boundary and never trusting a caller's forwarded-host header.
  if (url.hostname === "localhost" && host && /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) {
    const local = new URL(`${url.protocol}//${host}`);
    if (local.port === url.port) return local.origin;
  }
  return url.origin;
}

export function roommateResponse(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}

export function roommateErrorResponse(error: unknown) {
  if (error instanceof RoommateError || error instanceof ApiError) {
    const response = roommateResponse({ error: error.message, code: error.code, field: error.field }, error.status);
    if (error.status === 429) {
      const retrySeconds = Number(error.message.match(/(\d+)초/)?.[1] ?? "60");
      const limited = roommateResponse({ error: error.message, code: error.code, field: error.field, retryAt: new Date(Date.now() + retrySeconds * 1000).toISOString() }, 429);
      limited.headers.set("Retry-After", String(retrySeconds));
      return limited;
    }
    return response;
  }
  // Authentication errors can contain email addresses or one-time credentials. Never log them.
  return roommateResponse({ error: "요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.", code: "SERVICE_UNAVAILABLE" }, 503);
}

export async function enforceRoommateReadLimit(req: Request, ownerKey: string) {
  await Promise.all([
    enforceRateLimitKey(`roommates:read:owner:${ownerKey}`, { limit: 30, windowMs: 60_000 }),
    enforceRateLimitKey(getRateLimitKey(req, "roommates:read:ip"), { limit: 120, windowMs: 60_000 }),
  ]);
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function sessionTag(token: string) {
  // A non-credential UI marker changes on account/session replacement; no UID or owner key is exposed.
  return createHmac("sha256", requireOwnerSecret()).update(`ui-session:${token}`).digest("hex");
}

function readRequestToken(req: Request) {
  const value = req.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${ROOMMATE_SESSION_COOKIE}=`));
  return value?.slice(ROOMMATE_SESSION_COOKIE.length + 1) ?? "";
}

function unauthorized() {
  return new RoommateError(401, "SESSION_EXPIRED", "학교 이메일 인증이 필요합니다.");
}

function isInvalidAuthError(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  return ["auth/id-token-expired", "auth/id-token-revoked", "auth/invalid-id-token", "auth/argument-error", "auth/user-disabled", "auth/user-not-found", "auth/invalid-argument"].includes(code);
}

export function validateRoommateIdentity(token: Pick<DecodedIdToken, "email" | "email_verified" | "uid" | "auth_time" | "aud">, now = Date.now()) {
  if (!token.uid || !token.email_verified || !token.email) throw unauthorized();
  let email: string;
  try { email = normalizeSchoolEmail(token.email); } catch { throw unauthorized(); }
  if (!Number.isInteger(token.auth_time) || token.auth_time * 1000 > now + 60_000 || now - token.auth_time * 1000 > 300_000) {
    throw new RoommateError(401, "RECENT_AUTH_REQUIRED", "다시 이메일 링크로 인증해 주세요.");
  }
  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || token.aud !== process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) throw unauthorized();
  return { email, ownerKey: getRoommateOwnerKey(email), authTime: token.auth_time };
}

export function getRoommateSessionExpiry(authTime: number, remember: boolean) {
  return authTime * 1000 + (remember ? 30 * DAY_MS : 12 * 60 * 60_000);
}

export function isRoommateUserValid(user: Pick<UserRecord, "email" | "emailVerified" | "disabled" | "tokensValidAfterTime">, session: RoommateSession) {
  if (user.disabled || !user.emailVerified || !user.email) return false;
  let ownerKey: string;
  try { ownerKey = getRoommateOwnerKey(user.email); } catch (error) {
    if (error instanceof RoommateError && error.status === 503) throw error;
    return false;
  }
  const validAfter = user.tokensValidAfterTime ? Date.parse(user.tokensValidAfterTime) : 0;
  return ownerKey === session.ownerKey && Number.isFinite(validAfter) && validAfter <= session.authTime * 1000;
}

export async function issueRoommateSession(idToken: unknown, remember: unknown) {
  requireRoommatesEnabled();
  if (typeof idToken !== "string" || idToken.length > 16_384 || !idToken || typeof remember !== "boolean") {
    throw new RoommateError(400, "INVALID_AUTH_REQUEST", "인증 요청이 올바르지 않습니다.");
  }
  let decoded: DecodedIdToken;
  try {
    initializeFirebaseAdmin();
    decoded = await getAuth().verifyIdToken(idToken, true);
  } catch (error) {
    if (isInvalidAuthError(error)) throw unauthorized();
    throw new RoommateError(503, "AUTH_UNAVAILABLE", "인증 서비스를 잠시 사용할 수 없습니다.");
  }
  const identity = validateRoommateIdentity(decoded);
  const expiresAt = getRoommateSessionExpiry(identity.authTime, remember);
  const token = randomBytes(32).toString("base64url");
  await getFirestore().collection(SESSION_COLLECTION).doc(hashSessionToken(token)).set({
    owner_key: identity.ownerKey,
    firebase_uid: decoded.uid,
    auth_time: identity.authTime,
    created_at: admin.firestore.Timestamp.now(),
    expires_at: admin.firestore.Timestamp.fromMillis(expiresAt),
  });
  return { token, expiresAt: new Date(expiresAt).toISOString(), sessionTag: sessionTag(token) };
}

async function readRoommateSession(token: string): Promise<RoommateSession> {
  requireRoommatesEnabled();
  if (!TOKEN_PATTERN.test(token)) throw unauthorized();
  const snapshot = await getFirestore().collection(SESSION_COLLECTION).doc(hashSessionToken(token)).get();
  const value = snapshot.data();
  const expiresAt = value?.expires_at;
  if (!value || !(expiresAt instanceof admin.firestore.Timestamp) || expiresAt.toMillis() <= Date.now() ||
      typeof value.owner_key !== "string" || typeof value.firebase_uid !== "string" || !Number.isInteger(value.auth_time)) throw unauthorized();
  const session: RoommateSession = { ownerKey: value.owner_key, firebaseUid: value.firebase_uid, authTime: value.auth_time, expiresAt: expiresAt.toDate().toISOString(), sessionTag: sessionTag(token) };
  let user: UserRecord;
  try {
    initializeFirebaseAdmin();
    user = await getAuth().getUser(session.firebaseUid);
  } catch (error) {
    if (isInvalidAuthError(error)) throw unauthorized();
    throw new RoommateError(503, "AUTH_UNAVAILABLE", "인증 서비스를 잠시 사용할 수 없습니다.");
  }
  if (!isRoommateUserValid(user, session)) throw unauthorized();
  return session;
}

export function requireRoommateSession(req: Request) {
  return readRoommateSession(readRequestToken(req));
}

export async function getRoommatePageSession() {
  const store = await cookies();
  const session = await readRoommateSession(store.get(ROOMMATE_SESSION_COOKIE)?.value ?? "");
  return { expiresAt: session.expiresAt, sessionTag: session.sessionTag };
}

export async function revokeRoommateSession(req: Request) {
  const token = readRequestToken(req);
  if (TOKEN_PATTERN.test(token)) {
    await getFirestore().collection(SESSION_COLLECTION).doc(hashSessionToken(token)).delete();
  }
}

export function setRoommateSessionCookie(response: NextResponse, token: string, expiresAt: string) {
  response.cookies.set(ROOMMATE_SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", expires: new Date(expiresAt) });
}

export function clearRoommateSessionCookie(response: NextResponse) {
  response.cookies.set(ROOMMATE_SESSION_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", expires: new Date(0), maxAge: 0 });
}

export async function requestRoommateEmailLink(req: Request, emailInput: unknown, locale: unknown) {
  requireRoommatesEnabled();
  if (process.env.ROOMMATES_EMAIL_ENABLED !== "true") throw new RoommateError(503, "EMAIL_DISABLED", "인증 메일 발송을 잠시 중지했습니다.");
  const email = normalizeSchoolEmail(emailInput);
  if (locale !== "ko" && locale !== "en") throw new RoommateError(400, "INVALID_LOCALE", "언어 설정이 올바르지 않습니다.");
  const ownerKey = getRoommateOwnerKey(email);
  await enforceRateLimitKey(getRateLimitKey(req, "roommates:mail:ip"), { limit: 100, windowMs: 60 * 60_000 });
  await enforceRateLimitKey(`roommates:mail:cooldown:${ownerKey}`, { limit: 1, windowMs: 60_000, fixedWindow: false });
  await enforceRateLimitKey(`roommates:mail:hour:${ownerKey}`, { limit: 5, windowMs: 60 * 60_000 });
  await enforceRateLimitKey(`roommates:mail:day:${ownerKey}`, { limit: 10, windowMs: DAY_MS, metric: "roommate_mail_requests" });
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new RoommateError(503, "AUTH_CONFIG_MISSING", "인증 설정을 확인해 주세요.");
  const origin = getRoommateEmailOrigin(req);
  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Firebase-Locale": locale },
      body: JSON.stringify({ requestType: "EMAIL_SIGNIN", email, continueUrl: `${origin}${locale === "en" ? "/en" : ""}/campus/roommates/verify/finish`, canHandleCodeInApp: true }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      const code = data?.error?.message?.split(" : ")[0];
      if (code === "QUOTA_EXCEEDED" || code === "TOO_MANY_ATTEMPTS_TRY_LATER") throw new RoommateError(503, "EMAIL_PROVIDER_LIMIT", "인증 메일 발송 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.");
      throw new RoommateError(503, "EMAIL_UNAVAILABLE", "인증 메일을 보낼 수 없습니다. 잠시 후 다시 시도해 주세요.");
    }
  } catch (error) {
    if (error instanceof RoommateError) throw error;
    throw new RoommateError(503, "EMAIL_UNAVAILABLE", "메일 발송 결과를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.");
  }
}

function getRoommateEmailOrigin(req: Request) {
  const origin = roommateRequestOrigin(req);
  const allowed = ["https://campus.syu.kr", process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ""];
  if (process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  if (allowed.includes(origin)) return origin;
  throw new RoommateError(503, "AUTH_DOMAIN_UNCONFIGURED", "인증 완료 도메인을 확인해 주세요.");
}
