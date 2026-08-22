import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { DocumentData } from "firebase-admin/firestore";
import { AdminAuthError, requireAdmin } from "@/lib/server/admin-auth";
import {
  buildAdminSubmissionAiSourceHash,
  classifyAdminSubmission,
  normalizeStoredAdminSubmissionAiClassification,
  type AdminSubmissionAiInput,
} from "@/lib/server/admin-submission-ai";
import {
  ApiError,
  apiErrorResponse,
  enforceRateLimit,
  rateLimitResponse,
  readJsonBody,
} from "@/lib/server/http";
import { OpenAiJsonError } from "@/lib/server/openai-json";
import type { AdminSubmissionKind } from "@/types/submissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ADMIN_CLASSIFIER_RATE_LIMIT = {
  limit: 20,
  windowMs: 60 * 60 * 1000,
};

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const admin = await requireAdmin(req);
    await enforceRateLimit(
      req,
      `admin_submission_classifier:${admin.uid}`,
      ADMIN_CLASSIFIER_RATE_LIMIT,
    );

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
      logClassificationResult(admin.uid, kind, true, startedAt);
      return NextResponse.json({ classification: existing, reused: true });
    }

    const classifierEnabled =
      process.env.ADMIN_CLASSIFIER_AI_ENABLED !== "false";
    const configurationError = getAdminClassifierConfigurationError(
      classifierEnabled,
      process.env.OPENAI_API_KEY,
    );
    if (configurationError) {
      throw new ApiError(configurationError, 503);
    }

    const classification = await classifyAdminSubmission(input);
    await docRef.update({
      ai_classification: classification,
    });

    logClassificationResult(admin.uid, kind, false, startedAt);
    return NextResponse.json({ classification, reused: false });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    const rateLimited = rateLimitResponse(error);
    if (rateLimited) return rateLimited;

    if (error instanceof OpenAiJsonError) {
      logOpenAiClassificationError(error, startedAt);
      return openAiErrorResponse(error);
    }

    return apiErrorResponse(error, "AI 문의 분류를 생성하지 못했습니다");
  }
}

export function getAdminClassifierConfigurationError(
  enabled: boolean,
  apiKey: string | undefined,
) {
  if (!enabled) {
    return "운영자 문의 분류 AI 기능이 비활성화되어 있습니다";
  }

  if (!apiKey?.trim()) {
    return "운영자 문의 분류 AI 키가 설정되지 않았습니다";
  }

  return undefined;
}

function logClassificationResult(
  uid: string,
  kind: AdminSubmissionKind,
  reused: boolean,
  startedAt: number,
) {
  console.info("[Admin AI] classification completed", {
    actor: createHash("sha256").update(uid).digest("hex").slice(0, 12),
    kind,
    reused,
    durationMs: Date.now() - startedAt,
  });
}

export function openAiErrorResponse(error: OpenAiJsonError) {
  if (error.kind === "rate-limit") {
    return NextResponse.json(
      { error: "AI 문의 분류 호출 제한을 초과했습니다" },
      { status: 429 },
    );
  }

  if (
    error.kind === "auth" ||
    error.kind === "permission" ||
    error.kind === "quota"
  ) {
    return NextResponse.json(
      { error: "AI 문의 분류 인증 설정을 확인해 주세요" },
      { status: 503 },
    );
  }

  if (error.kind === "timeout" || error.kind === "server") {
    return NextResponse.json(
      { error: "AI 문의 분류 서버가 일시적으로 응답하지 않습니다" },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { error: "AI 문의 분류 응답 형식이 올바르지 않습니다" },
    { status: 502 },
  );
}

function logOpenAiClassificationError(error: OpenAiJsonError, startedAt: number) {
  console.error("[Admin AI] classification failed", {
    kind: error.kind,
    status: error.status,
    code: error.code,
    requestId: error.requestId,
    durationMs: Date.now() - startedAt,
  });
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
