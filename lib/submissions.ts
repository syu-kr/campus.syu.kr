import type {
  CampusTipSuggestionInput,
  SiteInquiryInput,
  SiteInquiryType,
} from "@/types/submissions";
import { SubmissionValidationError as ValidationError } from "@/types/submissions";
import type { CampusTipCategory } from "@/types/campus-tips";

const CAMPUS_TIP_CATEGORIES: CampusTipCategory[] = [
  "school",
  "campus-life",
  "career",
  "certificate",
  "activity",
  "culture",
  "local",
  "finance",
  "reference",
];

const INQUIRY_TYPES: SiteInquiryType[] = [
  "bug",
  "suggestion",
  "data-correction",
  "feature",
  "other",
];

export function normalizeCampusTipSuggestion(
  input: unknown,
): CampusTipSuggestionInput {
  const body = asRecord(input);
  assertEmptyHoneypot(body);

  const title = readString(body.title).slice(0, 120);
  const category = readString(body.category) as CampusTipCategory;
  const description = readString(body.description).slice(0, 1200);
  const url = readString(body.url).slice(0, 500);
  const note = readString(body.note).slice(0, 1000);
  const contact = readString(body.contact).slice(0, 120);
  const tags = parseTags(body.tags).slice(0, 8);

  if (!title) {
    throw new ValidationError("title", "제목을 입력해주세요");
  }

  if (!CAMPUS_TIP_CATEGORIES.includes(category)) {
    throw new ValidationError("category", "카테고리를 선택해주세요");
  }

  if (!description) {
    throw new ValidationError("description", "꿀팁 내용을 입력해주세요");
  }

  if (url && !isValidHttpUrl(url)) {
    throw new ValidationError("url", "관련 링크 형식이 올바르지 않습니다");
  }

  return {
    title,
    category,
    description,
    url,
    tags,
    note,
    contact,
  };
}

export function normalizeSiteInquiry(input: unknown): SiteInquiryInput {
  const body = asRecord(input);
  assertEmptyHoneypot(body);

  const type = readString(body.type) as SiteInquiryType;
  const title = readString(body.title).slice(0, 120);
  const message = readString(body.message).slice(0, 2000);
  const pageUrl = readString(body.pageUrl || body.page_url).slice(0, 500);
  const contact = readString(body.contact).slice(0, 120);

  if (!INQUIRY_TYPES.includes(type)) {
    throw new ValidationError("type", "문의 유형을 선택해주세요");
  }

  if (!title) {
    throw new ValidationError("title", "제목을 입력해주세요");
  }

  if (!message) {
    throw new ValidationError("message", "문의 내용을 입력해주세요");
  }

  if (pageUrl && !isValidHttpUrl(pageUrl)) {
    throw new ValidationError("pageUrl", "관련 페이지 URL 형식이 올바르지 않습니다");
  }

  return {
    type,
    title,
    message,
    pageUrl,
    contact,
  };
}

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("", "요청 본문이 올바르지 않습니다");
  }

  return input as Record<string, unknown>;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseTags(value: unknown): string[] {
  const raw =
    Array.isArray(value) && value.every((item) => typeof item === "string")
      ? value.join(",")
      : readString(value);

  return Array.from(
    new Set(
      raw
        .split(",")
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean)
        .map((tag) => tag.slice(0, 24)),
    ),
  );
}

function assertEmptyHoneypot(body: Record<string, unknown>) {
  if (readString(body.website)) {
    throw new ValidationError("", "제출할 수 없습니다");
  }
}

export function getSubmissionErrorField(error: unknown): string | null {
  if (error instanceof ValidationError) {
    return error.field;
  }

  return null;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
