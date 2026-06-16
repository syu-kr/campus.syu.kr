import { NextRequest, NextResponse } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import type {
  Firestore,
  Query,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { ApiError, apiErrorResponse, readJsonBody } from "@/lib/server/http";
import type {
  AdminSubmissionKind,
  AdminSubmissionItem,
  SubmissionStatus,
} from "@/types/submissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES: SubmissionStatus[] = [
  "pending",
  "reviewing",
  "accepted",
  "rejected",
  "done",
];
const VALID_KINDS: AdminSubmissionKind[] = ["inquiry", "campus-tip"];
const MAX_SUBMISSIONS_PER_COLLECTION = 100;

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const kind = readKindFilter(searchParams.get("kind"));
    const status = readStatusFilter(searchParams.get("status"));
    const { getFirestore } = await import("@/lib/server/firestore");
    const db = getFirestore();
    const [submissions, counts] = await Promise.all([
      readSubmissions(db, kind, status),
      readSubmissionCounts(db, kind),
    ]);

    return NextResponse.json({ submissions, counts });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return apiErrorResponse(error, "관리자 제출 목록을 불러오지 못했습니다");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin(req);

    const body = await readJsonBody<{
      id?: unknown;
      kind?: unknown;
      status?: unknown;
    }>(req, 4 * 1024);
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const kind = typeof body.kind === "string" ? body.kind : "";
    const status = typeof body.status === "string" ? body.status : "";

    if (
      !/^[A-Za-z0-9_-]{1,128}$/.test(id) ||
      (kind !== "inquiry" && kind !== "campus-tip")
    ) {
      return NextResponse.json(
        { error: "제출 항목을 찾을 수 없습니다" },
        { status: 400 },
      );
    }

    if (!VALID_STATUSES.includes(status as SubmissionStatus)) {
      return NextResponse.json(
        { error: "처리 상태가 올바르지 않습니다" },
        { status: 400 },
      );
    }

    const collection =
      kind === "inquiry" ? "site_inquiries" : "campus_tip_suggestions";
    const { getFirestore, nowTimestamp } = await import(
      "@/lib/server/firestore"
    );
    const db = getFirestore();

    const submissionRef = db.collection(collection).doc(id);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(submissionRef);

      if (!snapshot.exists) {
        throw new ApiError("제출 항목을 찾을 수 없습니다", 404);
      }

      transaction.update(submissionRef, {
        status,
        updated_at: nowTimestamp(),
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return apiErrorResponse(error, "제출 상태를 변경하지 못했습니다");
  }
}

class AdminAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminAuthError";
    this.status = status;
  }
}

async function requireAdmin(req: NextRequest) {
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

function readBearerToken(req: NextRequest) {
  const header = req.headers.get("authorization") || "";

  if (!header.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return header.slice(7).trim();
}

function readAllowedEmails() {
  return Array.from(new Set([
    process.env.ADMIN_EMAILS,
    process.env.ADMIN_EMAIL,
    process.env.admin_email,
  ]
    .filter((value): value is string => Boolean(value))
    .join(",")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)));
}

async function readSubmissions(
  db: Firestore,
  kind: "all" | AdminSubmissionKind,
  status: "all" | SubmissionStatus,
) {
  const reads: Promise<AdminSubmissionItem[]>[] = [];

  if (kind === "all" || kind === "inquiry") {
    reads.push(
      readCollection(db, "site_inquiries", status, (doc) => mapInquiry(doc)),
    );
  }

  if (kind === "all" || kind === "campus-tip") {
    reads.push(
      readCollection(db, "campus_tip_suggestions", status, (doc) =>
        mapCampusTipSuggestion(doc),
      ),
    );
  }

  const submissions = (await Promise.all(reads)).flat();
  return submissions.sort(compareCreatedAtDesc);
}

async function readCollection(
  db: Firestore,
  collection: "site_inquiries" | "campus_tip_suggestions",
  status: "all" | SubmissionStatus,
  mapper: (doc: QueryDocumentSnapshot) => AdminSubmissionItem,
) {
  let query: Query = db.collection(collection);
  query =
    status === "all"
      ? query.orderBy("created_at", "desc")
      : query.where("status", "==", status);
  const snapshot =
    status === "all"
      ? await query.limit(MAX_SUBMISSIONS_PER_COLLECTION).get()
      : await query.get();

  return snapshot.docs
    .map(mapper)
    .sort(compareCreatedAtDesc)
    .slice(0, MAX_SUBMISSIONS_PER_COLLECTION);
}

async function readSubmissionCounts(
  db: Firestore,
  kind: "all" | AdminSubmissionKind,
) {
  const entries = await Promise.all(
    VALID_STATUSES.map(async (status) => {
      const collectionCounts = await Promise.all([
        kind === "all" || kind === "inquiry"
          ? countByStatus(db, "site_inquiries", status)
          : Promise.resolve(0),
        kind === "all" || kind === "campus-tip"
          ? countByStatus(db, "campus_tip_suggestions", status)
          : Promise.resolve(0),
      ]);

      return [status, collectionCounts[0] + collectionCounts[1]] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<SubmissionStatus, number>;
}

async function countByStatus(
  db: Firestore,
  collection: "site_inquiries" | "campus_tip_suggestions",
  status: SubmissionStatus,
) {
  const snapshot = await db
    .collection(collection)
    .where("status", "==", status)
    .count()
    .get();

  return snapshot.data().count || 0;
}

function readKindFilter(value: string | null): "all" | AdminSubmissionKind {
  if (!value || value === "all") return "all";

  if (VALID_KINDS.includes(value as AdminSubmissionKind)) {
    return value as AdminSubmissionKind;
  }

  throw new ApiError("제출 유형이 올바르지 않습니다", 400);
}

function readStatusFilter(value: string | null): "all" | SubmissionStatus {
  if (!value || value === "all") return "all";

  if (VALID_STATUSES.includes(value as SubmissionStatus)) {
    return value as SubmissionStatus;
  }

  throw new ApiError("처리 상태가 올바르지 않습니다", 400);
}

function mapInquiry(
  doc: QueryDocumentSnapshot,
): AdminSubmissionItem {
  const data = doc.data();

  return {
    id: doc.id,
    kind: "inquiry",
    status: readStatus(data.status),
    title: readString(data.title),
    type: readString(data.type) as AdminSubmissionItem["type"],
    message: readString(data.message),
    pageUrl: readString(data.page_url),
    contact: readString(data.contact),
    createdAt: timestampToIso(data.created_at),
    updatedAt: timestampToIso(data.updated_at),
    userAgent: readString(data.user_agent),
  };
}

function mapCampusTipSuggestion(
  doc: QueryDocumentSnapshot,
): AdminSubmissionItem {
  const data = doc.data();

  return {
    id: doc.id,
    kind: "campus-tip",
    status: readStatus(data.status),
    title: readString(data.title),
    category: readString(data.category) as AdminSubmissionItem["category"],
    description: readString(data.description),
    url: readString(data.url),
    tags: Array.isArray(data.tags)
      ? data.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    note: readString(data.note),
    contact: readString(data.contact),
    createdAt: timestampToIso(data.created_at),
    updatedAt: timestampToIso(data.updated_at),
    userAgent: readString(data.user_agent),
  };
}

function compareCreatedAtDesc(
  a: AdminSubmissionItem,
  b: AdminSubmissionItem,
) {
  return Date.parse(b.createdAt || "") - Date.parse(a.createdAt || "");
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readStatus(value: unknown): SubmissionStatus {
  return VALID_STATUSES.includes(value as SubmissionStatus)
    ? (value as SubmissionStatus)
    : "pending";
}

function timestampToIso(value: unknown): string | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toISOString();
  }

  return null;
}
