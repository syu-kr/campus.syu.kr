import { NextRequest, NextResponse } from "next/server";
import type { DocumentData } from "firebase-admin/firestore";
import { AdminAuthError, requireAdmin } from "@/lib/server/admin-auth";
import {
  buildAdminSubmissionAiSourceHash,
  classifyAdminSubmission,
  normalizeStoredAdminSubmissionAiClassification,
  type AdminSubmissionAiInput,
} from "@/lib/server/admin-submission-ai";
import { ApiError, apiErrorResponse, readJsonBody } from "@/lib/server/http";
import { SupilotJsonError } from "@/lib/server/supilot-json";
import type { AdminSubmissionKind } from "@/types/submissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const body = await readJsonBody<{
      id?: unknown;
      kind?: unknown;
    }>(req, 4 * 1024);
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const kind = typeof body.kind === "string" ? body.kind : "";

    if (
      !/^[A-Za-z0-9_-]{1,128}$/.test(id) ||
      (kind !== "inquiry" && kind !== "campus-tip")
    ) {
      throw new ApiError("제출 항목을 찾을 수 없습니다", 400);
    }

    const hasClassifierKey = Boolean(
      (
        process.env.SUPILOT_ADMIN_CLASSIFIER_API_KEY ||
        process.env.SUPILOT_API_KEY ||
        ""
      ).trim(),
    );

    if (!hasClassifierKey) {
      throw new ApiError("운영자 문의 분류 AI 키가 설정되지 않았습니다", 503);
    }

    const collection =
      kind === "inquiry" ? "site_inquiries" : "campus_tip_suggestions";
    const { getFirestore } = await import("@/lib/server/firestore");
    const db = getFirestore();
    const docRef = db.collection(collection).doc(id);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      throw new ApiError("제출 항목을 찾을 수 없습니다", 404);
    }

    const input = mapSubmissionDataToAiInput(kind, snapshot.data() || {});
    const sourceHash = buildAdminSubmissionAiSourceHash(input);
    const existing = normalizeStoredAdminSubmissionAiClassification(
      snapshot.get("ai_classification"),
    );

    if (existing?.sourceHash === sourceHash) {
      return NextResponse.json({ classification: existing, reused: true });
    }

    const classification = await classifyAdminSubmission(input);
    await docRef.update({
      ai_classification: classification,
    });

    return NextResponse.json({ classification, reused: false });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    if (error instanceof SupilotJsonError) {
      return supilotErrorResponse(error);
    }

    if (isSupilotTransportError(error)) {
      return NextResponse.json(
        { error: "AI 문의 분류 서버에 연결하지 못했습니다" },
        { status: 503 },
      );
    }

    return apiErrorResponse(error, "AI 문의 분류를 생성하지 못했습니다");
  }
}

function supilotErrorResponse(error: SupilotJsonError) {
  const status = Number(error.status || 0);

  if (status === 429) {
    return NextResponse.json(
      { error: "AI 문의 분류 호출 제한을 초과했습니다" },
      { status: 429 },
    );
  }

  if (status === 401 || status === 403) {
    return NextResponse.json(
      { error: "AI 문의 분류 인증 설정을 확인해 주세요" },
      { status: 503 },
    );
  }

  if (status >= 500) {
    return NextResponse.json(
      { error: "AI 문의 분류 서버가 일시적으로 응답하지 않습니다" },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { error: "AI 문의 분류 응답 형식이 올바르지 않습니다" },
    { status: 500 },
  );
}

function isSupilotTransportError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" ||
      error.name === "AbortError" ||
      error.message.toLowerCase().includes("fetch failed"))
  );
}

function mapSubmissionDataToAiInput(
  kind: AdminSubmissionKind,
  data: DocumentData,
): AdminSubmissionAiInput {
  if (kind === "inquiry") {
    return {
      kind,
      title: readString(data.title),
      type: readString(data.type),
      message: readString(data.message),
      pageUrl: readString(data.page_url),
    };
  }

  return {
    kind,
    title: readString(data.title),
    category: readString(data.category),
    description: readString(data.description),
    url: readString(data.url),
    tags: Array.isArray(data.tags)
      ? data.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    note: readString(data.note),
  };
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}
