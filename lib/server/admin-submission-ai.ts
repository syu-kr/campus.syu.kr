import { createHash } from "crypto";
import type {
  AdminSubmissionAiCategory,
  AdminSubmissionAiClassification,
  AdminSubmissionAiConfidence,
  AdminSubmissionAiUrgency,
  AdminSubmissionKind,
} from "@/types/submissions";
import {
  compactAiText,
  readNumberEnv,
  requestSupilotJsonObject,
} from "./supilot-json";

export interface AdminSubmissionAiInput {
  kind: AdminSubmissionKind;
  title: string;
  type?: string;
  message?: string;
  pageUrl?: string;
  category?: string;
  description?: string;
  url?: string;
  tags?: string[];
  note?: string;
}

interface RawAdminSubmissionAiClassification {
  category?: unknown;
  urgency?: unknown;
  handlingHint?: unknown;
  confidence?: unknown;
}

const AI_CATEGORIES: AdminSubmissionAiCategory[] = [
  "bug",
  "data-correction",
  "feature-request",
  "campus-tip",
  "abuse-spam",
  "privacy-security",
  "other",
];
const AI_URGENCIES: AdminSubmissionAiUrgency[] = [
  "low",
  "normal",
  "high",
  "critical",
];
const AI_CONFIDENCES: AdminSubmissionAiConfidence[] = [
  "low",
  "medium",
  "high",
];

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_MS = 2000;
const MODEL_NAME = "supilot-admin-classifier";

export async function classifyAdminSubmission(
  input: AdminSubmissionAiInput,
): Promise<AdminSubmissionAiClassification> {
  const sourceHash = buildAdminSubmissionAiSourceHash(input);
  const sanitizedInput = sanitizeAdminSubmissionAiInput(input);
  const apiKey =
    readOptionalEnv("SUPILOT_ADMIN_CLASSIFIER_API_KEY", "SUPILOT_API_KEY") ||
    "";
  const baseUrl = readOptionalEnv(
    "SUPILOT_ADMIN_CLASSIFIER_API_BASE_URL",
    "SUPILOT_API_BASE_URL",
  );
  const raw = await requestSupilotJsonObject<RawAdminSubmissionAiClassification>({
    apiKey,
    baseUrl,
    message: buildAdminSubmissionClassifierPrompt(sanitizedInput),
    timeoutMs: readNumberEnv(
      "SUPILOT_ADMIN_CLASSIFIER_TIMEOUT_MS",
      DEFAULT_TIMEOUT_MS,
    ),
    maxRetries: readNumberEnv(
      "SUPILOT_ADMIN_CLASSIFIER_MAX_RETRIES",
      DEFAULT_MAX_RETRIES,
    ),
    retryBaseMs: readNumberEnv(
      "SUPILOT_ADMIN_CLASSIFIER_RETRY_BASE_MS",
      DEFAULT_RETRY_BASE_MS,
    ),
  });

  return normalizeAdminSubmissionAiClassification(raw, sourceHash);
}

export function buildAdminSubmissionAiSourceHash(input: AdminSubmissionAiInput) {
  const sanitizedInput = sanitizeAdminSubmissionAiInput(input);

  return createHash("sha256")
    .update(
      JSON.stringify({
        kind: sanitizedInput.kind,
        title: compactAiText(sanitizedInput.title, 200),
        type: compactAiText(sanitizedInput.type, 80),
        message: compactAiText(sanitizedInput.message, 2000),
        pageUrl: compactAiText(sanitizedInput.pageUrl, 300),
        category: compactAiText(sanitizedInput.category, 80),
        description: compactAiText(sanitizedInput.description, 2000),
        url: compactAiText(sanitizedInput.url, 300),
        tags: normalizeTags(sanitizedInput.tags),
        note: compactAiText(sanitizedInput.note, 1000),
      }),
    )
    .digest("hex")
    .slice(0, 16);
}

export function normalizeStoredAdminSubmissionAiClassification(
  value: unknown,
): AdminSubmissionAiClassification | undefined {
  if (!value || typeof value !== "object") return undefined;

  const sourceHash =
    "sourceHash" in value && typeof value.sourceHash === "string"
      ? value.sourceHash
      : "";
  const generatedAt =
    "generatedAt" in value && typeof value.generatedAt === "string"
      ? value.generatedAt
      : "";

  if (!sourceHash || !generatedAt) return undefined;

  return {
    category: normalizeEnum(
      "category" in value ? value.category : undefined,
      AI_CATEGORIES,
      "other",
    ),
    urgency: normalizeEnum(
      "urgency" in value ? value.urgency : undefined,
      AI_URGENCIES,
      "normal",
    ),
    handlingHint:
      "handlingHint" in value
        ? redactPersonalInfo(compactAiText(value.handlingHint, 180))
        : "",
    confidence: normalizeEnum(
      "confidence" in value ? value.confidence : undefined,
      AI_CONFIDENCES,
      "medium",
    ),
    generatedAt,
    sourceHash,
    ...("model" in value && typeof value.model === "string"
      ? { model: value.model }
      : {}),
  };
}

function buildAdminSubmissionClassifierPrompt(input: AdminSubmissionAiInput) {
  const normalized = {
    kind: input.kind,
    title: compactAiText(input.title, 180),
    type: compactAiText(input.type, 80) || "unknown",
    message: compactAiText(input.message, 1400) || "unknown",
    pageUrl: compactAiText(input.pageUrl, 300) || "unknown",
    category: compactAiText(input.category, 80) || "unknown",
    description: compactAiText(input.description, 1400) || "unknown",
    url: compactAiText(input.url, 300) || "unknown",
    tags: normalizeTags(input.tags),
    note: compactAiText(input.note, 700) || "unknown",
  };

  return `당신은 SYU CAMPUS 운영자 문의 분류 어시스턴트입니다.
관리자가 처리 우선순위와 담당 방향을 빠르게 판단하도록 접수 항목을 분류하세요.

중요 규칙:
- 반드시 제공된 접수 정보만 근거로 판단하세요.
- 사용자에게 보낼 답변을 작성하지 마세요.
- 개인정보, 연락처, 사용자 식별 정보를 출력하지 마세요.
- handlingHint는 내부 운영자용 처리 힌트만 한국어 120자 이내로 쓰세요.
- category는 아래 값 중 하나만 사용하세요.
  bug, data-correction, feature-request, campus-tip, abuse-spam, privacy-security, other
- urgency는 low, normal, high, critical 중 하나입니다.
- confidence는 low, medium, high 중 하나입니다.
- JSON 외의 문장, 마크다운, 코드블록을 출력하지 마세요.

분류 기준:
- 서비스 장애, 깨진 화면, 저장 실패, 로그인/알림 문제는 bug입니다.
- 잘못된 공지/식단/셔틀/학사 정보 정정은 data-correction입니다.
- 새 기능이나 개선 아이디어는 feature-request입니다.
- 캠퍼스 꿀팁 후보 제보는 campus-tip입니다.
- 광고, 반복 제출, 욕설, 무관한 내용은 abuse-spam입니다.
- 개인정보 노출, 권한 우회, 보안 취약점, 계정/인증 문제는 privacy-security이며 긴급도를 높게 두세요.

출력 JSON 스키마:
{
  "category": "bug|data-correction|feature-request|campus-tip|abuse-spam|privacy-security|other",
  "urgency": "low|normal|high|critical",
  "handlingHint": "운영자 처리 힌트",
  "confidence": "low|medium|high"
}

접수 항목:
${JSON.stringify(normalized, null, 2)}`;
}

function sanitizeAdminSubmissionAiInput(
  input: AdminSubmissionAiInput,
): AdminSubmissionAiInput {
  return {
    kind: input.kind,
    title: redactPersonalInfo(compactAiText(input.title, 200)),
    type: redactPersonalInfo(compactAiText(input.type, 80)),
    message: redactPersonalInfo(compactAiText(input.message, 2000)),
    pageUrl: sanitizeUrlForAi(input.pageUrl),
    category: redactPersonalInfo(compactAiText(input.category, 80)),
    description: redactPersonalInfo(compactAiText(input.description, 2000)),
    url: sanitizeUrlForAi(input.url),
    tags: normalizeTags(input.tags).map((tag) => redactPersonalInfo(tag)),
    note: redactPersonalInfo(compactAiText(input.note, 1000)),
  };
}

function normalizeAdminSubmissionAiClassification(
  raw: RawAdminSubmissionAiClassification,
  sourceHash: string,
): AdminSubmissionAiClassification {
  return {
    category: normalizeEnum(raw.category, AI_CATEGORIES, "other"),
    urgency: normalizeEnum(raw.urgency, AI_URGENCIES, "normal"),
    handlingHint:
      redactPersonalInfo(compactAiText(raw.handlingHint, 180)) ||
      "접수 내용을 확인하고 담당자가 직접 처리 방향을 결정하세요.",
    confidence: normalizeEnum(raw.confidence, AI_CONFIDENCES, "medium"),
    generatedAt: new Date().toISOString(),
    sourceHash,
    model: process.env.SUPILOT_ADMIN_CLASSIFIER_MODEL || MODEL_NAME,
  };
}

function normalizeTags(value: string[] | undefined) {
  return Array.isArray(value)
    ? value.map((tag) => compactAiText(tag, 40)).filter(Boolean).slice(0, 8)
    : [];
}

function normalizeEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

function redactPersonalInfo(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[연락처 생략]")
    .replace(/\b0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, "[연락처 생략]")
    .replace(/\b\d{8,12}\b/g, "[식별번호 생략]");
}

function sanitizeUrlForAi(value: string | undefined) {
  const text = compactAiText(value, 300);
  if (!text) return "";

  try {
    const url = new URL(text);
    url.search = "";
    url.hash = "";
    return redactPersonalInfo(url.toString());
  } catch {
    return redactPersonalInfo(text.split(/[?#]/, 1)[0] || "");
  }
}

function readOptionalEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }

  return undefined;
}
