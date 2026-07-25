import { NextRequest, NextResponse } from "next/server";
import type {
  Firestore,
  Query,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { FieldPath } from "firebase-admin/firestore";
import { AdminAuthError, requireAdmin } from "@/lib/server/admin-auth";
import { normalizeStoredAdminSubmissionAiClassification } from "@/lib/server/admin-submission-ai";
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
const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 50;
const MAX_BULK_STATUS_ITEMS = 50;
const MAX_CURSOR_LENGTH = 2048;

interface SubmissionTarget {
  id: string;
  kind: AdminSubmissionKind;
}

export interface CollectionCursor {
  createdAt: string;
  id: string;
}

export interface SubmissionCursor {
  inquiry?: CollectionCursor;
  campusTip?: CollectionCursor;
}

interface SubmissionRead {
  item: AdminSubmissionItem;
  cursor: CollectionCursor;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const kind = readKindFilter(searchParams.get("kind"));
    const status = readStatusFilter(searchParams.get("status"));
    const page = readPositiveInt(searchParams.get("page"), 1);
    const limit = readPositiveInt(
      searchParams.get("limit"),
      DEFAULT_PAGE_LIMIT,
      MAX_PAGE_LIMIT,
    );
    const cursor = readSubmissionCursor(searchParams.get("cursor"));
    if (page > 1 && !cursor) {
      throw new ApiError("다음 페이지 커서가 필요합니다", 400);
    }
    const { getFirestore } = await import("@/lib/server/firestore");
    const db = getFirestore();
    const [submissionPage, counts] = await Promise.all([
      readSubmissions(db, kind, status, page, limit, cursor),
      readSubmissionCounts(db, kind),
    ]);

    return NextResponse.json({ ...submissionPage, counts });
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
      items?: unknown;
    }>(req, 16 * 1024);
    const status = typeof body.status === "string" ? body.status : "";

    if (!VALID_STATUSES.includes(status as SubmissionStatus)) {
      return NextResponse.json(
        { error: "처리 상태가 올바르지 않습니다" },
        { status: 400 },
      );
    }

    const targets = readSubmissionTargets(body);
    if (targets.length === 0) {
      return NextResponse.json(
        { error: "제출 항목을 찾을 수 없습니다" },
        { status: 400 },
      );
    }

    if (targets.length > MAX_BULK_STATUS_ITEMS) {
      return NextResponse.json(
        { error: `한 번에 ${MAX_BULK_STATUS_ITEMS}개까지만 변경할 수 있습니다` },
        { status: 400 },
      );
    }

    const { getFirestore, nowTimestamp } = await import(
      "@/lib/server/firestore"
    );
    const db = getFirestore();

    await db.runTransaction(async (transaction) => {
      const now = nowTimestamp();
      const submissionRefs = targets.map((target) =>
        db.collection(collectionForKind(target.kind)).doc(target.id),
      );
      const snapshots = await transaction.getAll(...submissionRefs);

      for (const snapshot of snapshots) {
        if (!snapshot.exists) {
          throw new ApiError("제출 항목을 찾을 수 없습니다", 404);
        }
      }

      for (const submissionRef of submissionRefs) {
        transaction.update(submissionRef, {
          status,
          updated_at: now,
        });
      }
    });

    return NextResponse.json({ success: true, updated: targets.length });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return apiErrorResponse(error, "제출 상태를 변경하지 못했습니다");
  }
}

async function readSubmissions(
  db: Firestore,
  kind: "all" | AdminSubmissionKind,
  status: "all" | SubmissionStatus,
  page: number,
  limit: number,
  cursor: SubmissionCursor | null,
) {
  const total = await countSubmissions(db, kind, status);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const reads: Promise<SubmissionRead[]>[] = [];

  if (kind === "all" || kind === "inquiry") {
    reads.push(
      readCollection(
        db,
        "site_inquiries",
        status,
        cursor?.inquiry,
        limit,
        mapInquiry,
      ),
    );
  }

  if (kind === "all" || kind === "campus-tip") {
    reads.push(
      readCollection(
        db,
        "campus_tip_suggestions",
        status,
        cursor?.campusTip,
        limit,
        mapCampusTipSuggestion,
      ),
    );
  }

  const selected = (await Promise.all(reads))
    .flat()
    .sort(compareSubmissionReadDesc)
    .slice(0, limit);
  const nextCursorState: SubmissionCursor = { ...(cursor || {}) };

  selected.forEach(({ item, cursor: itemCursor }) => {
    if (item.kind === "inquiry") {
      nextCursorState.inquiry = itemCursor;
    } else {
      nextCursorState.campusTip = itemCursor;
    }
  });

  const hasNext = page < totalPages && selected.length > 0;
  return {
    submissions: selected.map(({ item }) => item),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext,
      nextCursor: hasNext ? encodeSubmissionCursor(nextCursorState) : null,
    },
  };
}

async function readCollection(
  db: Firestore,
  collection: "site_inquiries" | "campus_tip_suggestions",
  status: "all" | SubmissionStatus,
  cursor: CollectionCursor | undefined,
  limit: number,
  mapper: (doc: QueryDocumentSnapshot) => AdminSubmissionItem,
) {
  let query: Query = db.collection(collection);
  query =
    status === "all"
      ? query.orderBy("created_at", "desc")
      : query.where("status", "==", status).orderBy("created_at", "desc");
  query = query.orderBy(FieldPath.documentId(), "desc");

  if (cursor) {
    query = query.startAfter(new Date(cursor.createdAt), cursor.id);
  }

  const snapshot = await query.limit(limit).get();

  return snapshot.docs.map((doc) => ({
    item: mapper(doc),
    cursor: {
      createdAt: timestampToIso(doc.get("created_at")) || new Date(0).toISOString(),
      id: doc.id,
    },
  }));
}

async function countSubmissions(
  db: Firestore,
  kind: "all" | AdminSubmissionKind,
  status: "all" | SubmissionStatus,
) {
  const collections: Array<"site_inquiries" | "campus_tip_suggestions"> = [];

  if (kind === "all" || kind === "inquiry") {
    collections.push("site_inquiries");
  }

  if (kind === "all" || kind === "campus-tip") {
    collections.push("campus_tip_suggestions");
  }

  const counts = await Promise.all(
    collections.map((collection) =>
      status === "all"
        ? countCollection(db, collection)
        : countByStatus(db, collection, status),
    ),
  );

  return counts.reduce((total, count) => total + count, 0);
}

async function countCollection(
  db: Firestore,
  collection: "site_inquiries" | "campus_tip_suggestions",
) {
  const snapshot = await db.collection(collection).count().get();
  return snapshot.data().count || 0;
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

function readPositiveInt(
  value: string | null,
  fallback: number,
  max = Number.MAX_SAFE_INTEGER,
) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function readSubmissionTargets(body: {
  id?: unknown;
  kind?: unknown;
  items?: unknown;
}): SubmissionTarget[] {
  const rawItems = Array.isArray(body.items)
    ? body.items
    : [{ id: body.id, kind: body.kind }];

  const seen = new Set<string>();
  const targets: SubmissionTarget[] = [];

  rawItems.forEach((item) => {
    if (!item || typeof item !== "object") return;

    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const kind = typeof record.kind === "string" ? record.kind : "";

    if (
      !/^[A-Za-z0-9_-]{1,128}$/.test(id) ||
      !VALID_KINDS.includes(kind as AdminSubmissionKind)
    ) {
      return;
    }

    const target = { id, kind: kind as AdminSubmissionKind };
    const key = `${target.kind}:${target.id}`;
    if (seen.has(key)) return;

    seen.add(key);
    targets.push(target);
  });

  return targets;
}

function collectionForKind(kind: AdminSubmissionKind) {
  return kind === "inquiry" ? "site_inquiries" : "campus_tip_suggestions";
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
    aiClassification: normalizeStoredAdminSubmissionAiClassification(
      data.ai_classification,
    ),
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
    aiClassification: normalizeStoredAdminSubmissionAiClassification(
      data.ai_classification,
    ),
  };
}

function compareCreatedAtDesc(
  a: AdminSubmissionItem,
  b: AdminSubmissionItem,
) {
  const createdAtDifference =
    Date.parse(b.createdAt || "") - Date.parse(a.createdAt || "");
  return createdAtDifference || b.id.localeCompare(a.id);
}

function compareSubmissionReadDesc(a: SubmissionRead, b: SubmissionRead) {
  return compareCreatedAtDesc(a.item, b.item);
}

export function readSubmissionCursor(
  value: string | null,
): SubmissionCursor | null {
  if (!value) return null;
  if (value.length > MAX_CURSOR_LENGTH) {
    throw new ApiError("페이지 커서가 너무 깁니다", 400);
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as unknown;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("invalid cursor");
    }

    const record = parsed as Record<string, unknown>;
    const inquiry = readCollectionCursor(record.inquiry);
    const campusTip = readCollectionCursor(record.campusTip);
    if (!inquiry && !campusTip) {
      throw new Error("empty cursor");
    }

    return { inquiry, campusTip };
  } catch {
    throw new ApiError("페이지 커서가 올바르지 않습니다", 400);
  }
}

function readCollectionCursor(value: unknown): CollectionCursor | undefined {
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const createdAt =
    typeof record.createdAt === "string" ? record.createdAt : "";
  const id = typeof record.id === "string" ? record.id : "";

  if (
    !createdAt ||
    !Number.isFinite(Date.parse(createdAt)) ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(id)
  ) {
    throw new Error("invalid collection cursor");
  }

  return { createdAt, id };
}

export function encodeSubmissionCursor(cursor: SubmissionCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
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
