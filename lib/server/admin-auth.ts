import type { DecodedIdToken } from "firebase-admin/auth";

export class AdminAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminAuthError";
    this.status = status;
  }
}

export async function requireAdmin(req: Request): Promise<DecodedIdToken> {
  const token = readBearerToken(req);

  if (!token) {
    throw new AdminAuthError("로그인이 필요합니다", 401);
  }

  const { initializeFirebaseAdmin } = await import("@/lib/firebaseAdmin");
  initializeFirebaseAdmin();

  let decodedToken: DecodedIdToken;
  try {
    const { getAuth } = await import("firebase-admin/auth");
    decodedToken = await getAuth().verifyIdToken(token, true);
  } catch (error) {
    console.error("[Admin API] Firebase ID token verification failed", error);
    if (isAdminAuthInfrastructureError(error)) {
      throw new AdminAuthError("관리자 인증 설정을 확인해 주세요", 503);
    }
    throw new AdminAuthError("유효한 로그인이 필요합니다", 401);
  }

  const allowedEmails = readAllowedEmails();

  if (allowedEmails.length === 0) {
    console.error("[Admin API] ADMIN_EMAILS is not configured");
    throw new AdminAuthError("관리자 설정이 완료되지 않았습니다", 503);
  }

  const normalizedEmail = decodedToken.email?.toLowerCase();
  if (!normalizedEmail || !allowedEmails.includes(normalizedEmail)) {
    throw new AdminAuthError("관리자 권한이 없습니다", 403);
  }

  return decodedToken;
}

function isAdminAuthInfrastructureError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code =
    "code" in error && typeof error.code === "string" ? error.code : "";
  const message = error instanceof Error ? error.message : "";

  return (
    code === "ERR_REQUIRE_ESM" ||
    message.includes("Failed to load external module firebase-admin") ||
    message.includes("require() of ES Module") ||
    message.includes("Error fetching Json Web Keys")
  );
}

function readBearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";

  if (!header.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return header.slice(7).trim();
}

function readAllowedEmails() {
  return Array.from(
    new Set(
      [
        process.env.ADMIN_EMAILS,
        process.env.ADMIN_EMAIL,
        process.env.admin_email,
      ]
        .filter((value): value is string => Boolean(value))
        .join(",")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}
