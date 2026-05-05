import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { initializeFirebaseAdmin } from "@/lib/firebaseAdmin";
import { apiErrorResponse } from "@/lib/server/http";
import {
  admin,
  getFirestore,
  nowTimestamp,
  timestampToIso,
} from "@/lib/server/firestore";
import type {
  AdminSubmissionItem,
  SubmissionStatus,
} from "@/types/submissions";

const VALID_STATUSES: SubmissionStatus[] = [
  "pending",
  "reviewing",
  "accepted",
  "rejected",
  "done",
];

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const db = getFirestore();
    const [inquiriesSnapshot, tipSuggestionsSnapshot] = await Promise.all([
      db.collection("site_inquiries").orderBy("created_at", "desc").limit(100).get(),
      db
        .collection("campus_tip_suggestions")
        .orderBy("created_at", "desc")
        .limit(100)
        .get(),
    ]);

    const submissions = [
      ...inquiriesSnapshot.docs.map(mapInquiry),
      ...tipSuggestionsSnapshot.docs.map(mapCampusTipSuggestion),
    ].sort((a, b) => compareCreatedAtDesc(a, b));

    return NextResponse.json({ submissions });
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

    const body = (await req.json()) as {
      id?: unknown;
      kind?: unknown;
      status?: unknown;
    };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const kind = typeof body.kind === "string" ? body.kind : "";
    const status = typeof body.status === "string" ? body.status : "";

    if (!id || (kind !== "inquiry" && kind !== "campus-tip")) {
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
    const db = getFirestore();

    await db.collection(collection).doc(id).update({
      status,
      updated_at: nowTimestamp(),
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
  initializeFirebaseAdmin();
  const token = readBearerToken(req);

  if (!token) {
    throw new AdminAuthError("로그인이 필요합니다", 401);
  }

  const decodedToken = await getAuth().verifyIdToken(token);
  const allowedEmails = readAllowedEmails();

  if (
    allowedEmails.length > 0 &&
    (!decodedToken.email || !allowedEmails.includes(decodedToken.email))
  ) {
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
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function mapInquiry(
  doc: admin.firestore.QueryDocumentSnapshot,
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
  doc: admin.firestore.QueryDocumentSnapshot,
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
