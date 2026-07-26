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

  const title = readLimitedString(
    body.title,
    120,
    "title",
    "제목은 120자 이하로 입력해주세요",
    "TITLE_TOO_LONG",
  );
  const category = readString(body.category) as CampusTipCategory;
  const description = readLimitedString(
    body.description,
    1200,
    "description",
    "꿀팁 내용은 1200자 이하로 입력해주세요",
    "DESCRIPTION_TOO_LONG",
  );
  const url = readLimitedString(
    body.url,
    500,
    "url",
    "관련 링크는 500자 이하로 입력해주세요",
    "URL_TOO_LONG",
  );
  const note = readLimitedString(
    body.note,
    1000,
    "note",
    "참고 메모는 1000자 이하로 입력해주세요",
    "NOTE_TOO_LONG",
  );
  const contact = readLimitedString(
    body.contact,
    120,
    "contact",
    "연락처는 120자 이하로 입력해주세요",
    "CONTACT_TOO_LONG",
  );
  const tags = parseTags(body.tags);

  if (!title) {
    throw new ValidationError("title", "제목을 입력해주세요", "TITLE_REQUIRED");
  }

  if (!CAMPUS_TIP_CATEGORIES.includes(category)) {
    throw new ValidationError(
      "category",
      "카테고리를 선택해주세요",
      "CATEGORY_REQUIRED",
    );
  }

  if (!description) {
    throw new ValidationError(
      "description",
      "꿀팁 내용을 입력해주세요",
      "DESCRIPTION_REQUIRED",
    );
  }

  if (url && !isValidHttpUrl(url)) {
    throw new ValidationError(
      "url",
      "관련 링크 형식이 올바르지 않습니다",
      "INVALID_URL",
    );
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
  const title = readLimitedString(
    body.title,
    120,
    "title",
    "제목은 120자 이하로 입력해주세요",
    "TITLE_TOO_LONG",
  );
  const message = readLimitedString(
    body.message,
    2000,
    "message",
    "문의 내용은 2000자 이하로 입력해주세요",
    "MESSAGE_TOO_LONG",
  );
  const pageUrl = readLimitedString(
    body.pageUrl || body.page_url,
    500,
    "pageUrl",
    "관련 페이지 URL은 500자 이하로 입력해주세요",
    "PAGE_URL_TOO_LONG",
  );
  const contact = readLimitedString(
    body.contact,
    120,
    "contact",
    "연락처는 120자 이하로 입력해주세요",
    "CONTACT_TOO_LONG",
  );

  if (!INQUIRY_TYPES.includes(type)) {
    throw new ValidationError(
      "type",
      "문의 유형을 선택해주세요",
      "TYPE_REQUIRED",
    );
  }

  if (!title) {
    throw new ValidationError("title", "제목을 입력해주세요", "TITLE_REQUIRED");
  }

  if (!message) {
    throw new ValidationError(
      "message",
      "문의 내용을 입력해주세요",
      "MESSAGE_REQUIRED",
    );
  }

  if (pageUrl && !isValidHttpUrl(pageUrl)) {
    throw new ValidationError(
      "pageUrl",
      "관련 페이지 URL 형식이 올바르지 않습니다",
      "INVALID_PAGE_URL",
    );
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
    throw new ValidationError(
      "",
      "요청 본문이 올바르지 않습니다",
      "INVALID_BODY",
    );
  }

  return input as Record<string, unknown>;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readLimitedString(
  value: unknown,
  maxLength: number,
  field: string,
  message: string,
  code: string,
) {
  const normalized = readString(value);
  if (normalized.length > maxLength) {
    throw new ValidationError(field, message, code);
  }

  return normalized;
}

function parseTags(value: unknown): string[] {
  const raw =
    Array.isArray(value) && value.every((item) => typeof item === "string")
      ? value.join(",")
      : readString(value);

  const tags = raw
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean);

  if (tags.some((tag) => tag.length > 24)) {
    throw new ValidationError(
      "tags",
      "태그는 각각 24자 이하로 입력해주세요",
      "TAG_TOO_LONG",
    );
  }

  const uniqueTags = Array.from(new Set(tags));
  if (uniqueTags.length > 8) {
    throw new ValidationError(
      "tags",
      "태그는 최대 8개까지 입력할 수 있습니다",
      "TOO_MANY_TAGS",
    );
  }

  return uniqueTags;
}

function assertEmptyHoneypot(body: Record<string, unknown>) {
  if (readString(body.website)) {
    throw new ValidationError("", "제출할 수 없습니다", "SUBMISSION_BLOCKED");
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
