import { createHash } from "node:crypto";
import { FieldPath } from "firebase-admin/firestore";
import type { ContentMutation, ManagedBannerDraft, ManagedContentDraft, ManagedContentRecord, ManagedNoticeDraft, NoticeOriginalMetadata, PublicManagedContentMetadata, PublicManagedPublication } from "@/types/managed-content";
import { getFirestore } from "./firestore";
import { ApiError } from "./http";

const COLLECTION = "site_managed_content";
const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,119}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const actions = new Set(["save", "publish", "unpublish", "archive", "restore"]);
function invalid(message: string, field?: string): never { throw new ApiError(message, 400, field, "INVALID_CONTENT"); }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function only(value: Record<string, unknown>, keys: string[]) { if (Object.keys(value).some(key => !keys.includes(key))) invalid("허용되지 않은 항목이 포함되어 있습니다."); }
function text(value: unknown, field: string, maximum: number, required = false, preserveWhitespace = false) {
  if (typeof value !== "string") invalid("입력 내용을 확인해 주세요.", field);
  const normalized = value.replace(/\r\n/g, "\n");
  if ([...normalized].length > maximum || (required && !normalized.trim())) invalid(required && !normalized.trim() ? "필수 항목을 입력해 주세요." : `최대 ${maximum}자까지 입력할 수 있습니다.`, field);
  return preserveWhitespace ? normalized : normalized.trim();
}
function date(value: unknown, field: string) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) invalid("날짜와 시간을 확인해 주세요.", field);
  const [year, month, day] = value.slice(0, 10).split("-").map(Number), calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) invalid("날짜와 시간을 확인해 주세요.", field);
  return new Date(value).toISOString();
}
export function isManagedMediaId(value: string) { return uuidPattern.test(value); }

export function parseManagedDraft(value: unknown, publishing = false): ManagedContentDraft {
  if (!record(value)) invalid("작성 내용을 확인해 주세요.");
  const startsAt = date(value.startsAt, "startsAt"), endsAt = date(value.endsAt, "endsAt");
  if (startsAt && endsAt && endsAt <= startsAt) invalid("종료 시간은 시작 시간보다 늦어야 합니다.", "endsAt");
  const title = text(value.title, "title", 120, true);
  if (value.kind === "notice") {
    only(value, ["kind", "slug", "title", "summary", "content", "english", "startsAt", "endsAt"]);
    const slug = text(value.slug, "slug", 120, true);
    if (!idPattern.test(slug)) invalid("주소에는 영문, 숫자, 하이픈만 사용할 수 있습니다.", "slug");
    const content = text(value.content, "content", 50_000, publishing, true);
    const result: ManagedNoticeDraft = { kind: "notice", slug, title, summary: text(value.summary, "summary", 300), content, startsAt, endsAt };
    if (value.english !== undefined) {
      if (!record(value.english)) invalid("영문 내용을 확인해 주세요.", "english");
      only(value.english, ["title", "summary", "content"]);
      const english = { title: text(value.english.title, "english.title", 120), summary: text(value.english.summary, "english.summary", 300), content: text(value.english.content, "english.content", 50_000, false, true) };
      if (Object.values(english).some(Boolean)) {
        if (publishing && (!english.title || !english.content)) invalid("영문 제목과 본문을 함께 입력해 주세요.", "english");
        result.english = english;
      }
    }
    return result;
  }
  if (value.kind !== "banner") invalid("콘텐츠 유형을 확인해 주세요.", "kind");
  only(value, ["kind", "category", "placement", "title", "description", "imageDesktop", "imageMobile", "imageAlt", "link", "priority", "dismissible", "startsAt", "endsAt"]);
  if (typeof value.category !== "string" || !["notice", "event", "ad"].includes(value.category)) invalid("배너 유형을 선택해 주세요.", "category");
  if (typeof value.placement !== "string" || !["site-top", "home", "popup"].includes(value.placement)) invalid("배너 위치를 선택해 주세요.", "placement");
  if (!Number.isInteger(value.priority) || Number(value.priority) < 0 || Number(value.priority) > 1000) invalid("노출 순서는 0부터 1000까지 입력해 주세요.", "priority");
  if (typeof value.dismissible !== "boolean") invalid("닫기 설정을 확인해 주세요.", "dismissible");
  const imageDesktop = text(value.imageDesktop, "imageDesktop", 200), imageMobile = text(value.imageMobile, "imageMobile", 200);
  for (const [field, image] of [["imageDesktop", imageDesktop], ["imageMobile", imageMobile]]) {
    if (image && (!image.startsWith("/api/content-media/") || !uuidPattern.test(image.slice("/api/content-media/".length)))) invalid("업로드한 배너 이미지를 선택해 주세요.", field);
  }
  const imageAlt = text(value.imageAlt, "imageAlt", 180);
  if (publishing && imageMobile && !imageDesktop) invalid("기본 이미지를 먼저 업로드해 주세요.", "imageDesktop");
  if (publishing && value.placement === "home" && !imageDesktop) invalid("홈 배너의 기본 이미지를 업로드해 주세요.", "imageDesktop");
  if (publishing && (imageDesktop || imageMobile) && !imageAlt) invalid("이미지 설명을 입력해 주세요.", "imageAlt");
  const link = text(value.link, "link", 2048);
  if (link && !isSafeContentLink(link)) invalid("사이트 내부 주소 또는 https 주소를 입력해 주세요.", "link");
  if (publishing && value.category === "ad" && !link) invalid("광고·제휴 연결 주소를 입력해 주세요.", "link");
  return { kind: "banner", category: value.category as ManagedBannerDraft["category"], placement: value.placement as ManagedBannerDraft["placement"], title, description: text(value.description, "description", 300), imageDesktop, imageMobile, imageAlt, link, priority: Number(value.priority), dismissible: value.placement === "popup" || value.dismissible, startsAt, endsAt };
}

export function isSafeContentLink(value: string) {
  if (/[\u0000-\u0020\u007f\\]/.test(value)) return false;
  if (value.startsWith("/") && !value.startsWith("//")) {
    const decoded = (() => { try { return decodeURIComponent(value); } catch { return ""; } })();
    return Boolean(decoded) && !decoded.startsWith("//") && !/[\u0000-\u001f\u007f\\]/.test(decoded);
  }
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}

export function parseContentMutation(value: unknown): ContentMutation {
  if (!record(value)) invalid("저장 요청을 확인해 주세요.");
  only(value, ["id", "expectedRevision", "action", "draft", "englishReviewed"]);
  if (typeof value.id !== "string" || !idPattern.test(value.id)) invalid("콘텐츠 주소를 확인해 주세요.", "id");
  if (!Number.isSafeInteger(value.expectedRevision) || Number(value.expectedRevision) < 0) invalid("목록을 새로 불러온 뒤 다시 시도해 주세요.", "expectedRevision");
  if (typeof value.action !== "string" || !actions.has(value.action)) invalid("저장 동작을 확인해 주세요.", "action");
  const result = { id: value.id, expectedRevision: Number(value.expectedRevision), action: value.action } as ContentMutation;
  if (value.englishReviewed !== undefined) {
    if (typeof value.englishReviewed !== "boolean" || (value.englishReviewed && value.action !== "publish")) invalid("영문 검토 상태를 확인해 주세요.", "english");
    result.englishReviewed = value.englishReviewed;
  }
  if (value.draft !== undefined) result.draft = parseManagedDraft(value.draft, value.action === "publish");
  if ((value.action === "save" || value.action === "publish") && !result.draft) invalid("작성 내용을 확인해 주세요.", "draft");
  return result;
}

export function requireManagedContentConfigured() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new ApiError("콘텐츠 저장소 설정을 확인해 주세요.", 503, undefined, "CONTENT_CONFIG_MISSING");
}
function noticeMetadata(value: unknown): NoticeOriginalMetadata | undefined {
  if (value === undefined) return undefined;
  if (!record(value)) throw new Error("Invalid notice metadata");
  only(value, ["publicId", "date", "author", "lang", "sourceSha256", "reviewedEnglishSourceSha256", "excerpt", "description", "english"]);
  if (typeof value.publicId !== "string" || !idPattern.test(value.publicId) || typeof value.date !== "string" || !Number.isFinite(Date.parse(value.date)) || typeof value.author !== "string" || !value.author.trim() || value.author.length > 300 || !["ko", "en"].includes(String(value.lang)) || typeof value.sourceSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sourceSha256)) throw new Error("Invalid notice metadata");
  if (value.reviewedEnglishSourceSha256 !== undefined && value.reviewedEnglishSourceSha256 !== value.sourceSha256) throw new Error("Invalid English source binding");
  for (const [field, limit] of [["excerpt", 303], ["description", 163]] as const) if (value[field] !== undefined && (typeof value[field] !== "string" || value[field].length > limit)) throw new Error("Invalid original summary");
  if (value.english !== undefined) {
    if (!record(value.english)) throw new Error("Invalid original English summary");
    only(value.english, ["excerpt", "description"]);
    if (typeof value.english.excerpt !== "string" || value.english.excerpt.length > 303 || typeof value.english.description !== "string" || value.english.description.length > 163) throw new Error("Invalid original English summary");
  }
  return value as unknown as NoticeOriginalMetadata;
}
function toPublicRecord(id: string, value: unknown): ManagedContentRecord {
  try {
    if (!record(value) || !idPattern.test(id) || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1 || typeof value.archived !== "boolean") throw new Error("Invalid record");
    const draft = parseManagedDraft(value.draft), published = value.published === null ? null : parseManagedDraft(value.published, true);
    if (draft.kind === "notice" ? draft.slug !== id : !uuidPattern.test(id)) throw new Error("Invalid identity");
    if (published && (published.kind !== draft.kind || (published.kind === "notice" && published.slug !== id))) throw new Error("Invalid publication");
    const publishedAt = date(value.publishedAt, "publishedAt"), updatedAt = date(value.updatedAt, "updatedAt");
    if (!updatedAt || (published && !publishedAt) || (value.archived && published)) throw new Error("Invalid state");
    const publishedRevision = value.publishedRevision ?? (published ? value.revision : 0);
    const publishedUpdatedAt = value.publishedUpdatedAt === undefined ? (published ? updatedAt : null) : date(value.publishedUpdatedAt, "publishedUpdatedAt");
    if (!Number.isSafeInteger(publishedRevision) || Number(publishedRevision) < 0 || Number(publishedRevision) > Number(value.revision) || (published && !publishedUpdatedAt)) throw new Error("Invalid publication identity");
    const metadata = noticeMetadata(value.noticeMetadata);
    if (metadata && draft.kind !== "notice") throw new Error("Invalid notice metadata kind");
    return { id, draft, published, publishedAt, publishedRevision: Number(publishedRevision), publishedUpdatedAt, updatedAt, archived: value.archived, revision: Number(value.revision), source: "database", ...(metadata ? { noticeMetadata: metadata } : {}) };
  } catch {
    throw new ApiError("저장된 콘텐츠를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.", 503, undefined, "CONTENT_READ_FAILED");
  }
}

export async function readManagedContentRecords(): Promise<ManagedContentRecord[]> {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return [];
  try {
    const result = await getFirestore().collection(COLLECTION).limit(501).get();
    if (result.size > 500) throw new Error("Content list limit exceeded");
    return result.docs.map(doc => toPublicRecord(doc.id, doc.data()));
  } catch {
    throw new ApiError("콘텐츠 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", 503, undefined, "CONTENT_READ_FAILED");
  }
}

const PUBLIC_META_FIELDS = [
  "draft.kind", "archived", "publishedAt", "publishedRevision", "publishedUpdatedAt", "noticeMetadata",
  "published.kind", "published.slug", "published.title", "published.summary", "published.english.title", "published.english.summary", "published.startsAt", "published.endsAt",
  "published.category", "published.placement", "published.description", "published.imageDesktop", "published.imageMobile", "published.imageAlt", "published.link", "published.priority", "published.dismissible",
];
const PUBLIC_DETAIL_FIELDS = ["draft.kind", "archived", "publishedAt", "publishedRevision", "publishedUpdatedAt", "published", "noticeMetadata"];

function publicPublication(id: string, value: unknown, detail: boolean): PublicManagedPublication | PublicManagedContentMetadata {
  try {
    if (!record(value) || !record(value.draft) || !["notice", "banner"].includes(String(value.draft.kind)) || typeof value.archived !== "boolean" || !idPattern.test(id)) throw new Error("Invalid public metadata");
    const kind = value.draft.kind as "notice" | "banner";
    if (kind === "banner" && !uuidPattern.test(id)) throw new Error("Invalid banner identity");
    const publishedAt = date(value.publishedAt, "publishedAt");
    // Nested Firestore field projections omit a null published parent.
    const rawPublished = value.published ?? null;
    const publishedRevision = value.publishedRevision ?? 0;
    const publishedUpdatedAt = value.publishedUpdatedAt === undefined ? publishedAt : date(value.publishedUpdatedAt, "publishedUpdatedAt");
    if (!Number.isSafeInteger(publishedRevision) || Number(publishedRevision) < 0 || (rawPublished !== null && (!publishedAt || !publishedUpdatedAt)) || (value.archived && rawPublished !== null)) throw new Error("Invalid publication metadata");
    let published: ManagedContentDraft | null = null;
    if (rawPublished !== null) {
      if (!record(rawPublished) || rawPublished.kind !== kind) throw new Error("Invalid publication");
      let raw = rawPublished;
      if (!detail && kind === "notice") raw = { ...raw, content: "", ...(record(raw.english) ? { english: { ...raw.english, content: "" } } : {}) };
      published = parseManagedDraft(raw, detail || kind === "banner");
      if (published.kind === "notice" && published.slug !== id) throw new Error("Invalid publication identity");
    }
    const metadata = noticeMetadata(value.noticeMetadata);
    if (metadata && kind !== "notice") throw new Error("Invalid notice metadata kind");
    const identity = { id, kind, archived: value.archived, publishedAt, publishedRevision: Number(publishedRevision), publishedUpdatedAt, ...(metadata ? { noticeMetadata: metadata } : {}) };
    if (!detail && published?.kind === "notice") {
      const { english } = published;
      return { ...identity, published: { kind: "notice", slug: published.slug, title: published.title, summary: published.summary, startsAt: published.startsAt, endsAt: published.endsAt, ...(english ? { english: { title: english.title, summary: english.summary } } : {}) } };
    }
    return { ...identity, published };
  } catch {
    throw new ApiError("게시된 콘텐츠를 확인하지 못했습니다.", 503, undefined, "CONTENT_READ_FAILED");
  }
}

/** List metadata never loads draft bodies or published notice bodies into Next's shared cache. */
export async function readPublishedManagedContentRecords(): Promise<PublicManagedContentMetadata[]> {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return [];
  try {
    const result = await getFirestore().collection(COLLECTION).select(...PUBLIC_META_FIELDS).limit(501).get();
    if (result.size > 500) throw new Error("Content list limit exceeded");
    return result.docs.map(doc => publicPublication(doc.id, doc.data(), false) as PublicManagedContentMetadata);
  } catch { throw new ApiError("게시된 콘텐츠 목록을 불러오지 못했습니다.", 503, undefined, "CONTENT_READ_FAILED"); }
}

/** A detail request selects only one publication; private draft fields are never requested. */
export async function readPublishedManagedContentRecord(id: string): Promise<PublicManagedPublication | null> {
  if (!idPattern.test(id) || !process.env.FIREBASE_SERVICE_ACCOUNT) return null;
  try {
    const result = await getFirestore().collection(COLLECTION).where(FieldPath.documentId(), "==", id).select(...PUBLIC_DETAIL_FIELDS).limit(1).get();
    const doc = result.docs[0];
    return doc ? publicPublication(doc.id, doc.data(), true) as PublicManagedPublication : null;
  } catch { throw new ApiError("게시된 콘텐츠를 불러오지 못했습니다.", 503, undefined, "CONTENT_READ_FAILED"); }
}
export function isPublishedNow(item: ManagedContentRecord, now = Date.now()) {
  return !item.archived && Boolean(item.published) && (!item.published!.startsAt || Date.parse(item.published!.startsAt) <= now) && (!item.published!.endsAt || Date.parse(item.published!.endsAt) > now);
}

export async function mutateManagedContent(input: ContentMutation, seed?: ManagedContentRecord): Promise<ManagedContentRecord> {
  requireManagedContentConfigured();
  const mutation = parseContentMutation(input);
  const db = getFirestore(), ref = db.collection(COLLECTION).doc(mutation.id);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const stored = snapshot.exists ? snapshot.data() : undefined;
    const current = snapshot.exists ? toPublicRecord(snapshot.id, stored) : seed;
    if ((current?.revision ?? 0) !== mutation.expectedRevision) throw new ApiError("다른 변경 내용이 저장되었습니다. 작성 중인 내용을 보관한 뒤 목록을 새로 불러와 주세요.", 409, undefined, "CONTENT_CONFLICT");
    if (!current && !["save", "publish"].includes(mutation.action)) throw new ApiError("콘텐츠를 찾을 수 없습니다.", 404, undefined, "CONTENT_NOT_FOUND");
    if (!snapshot.exists) {
      const contents = await transaction.get(db.collection(COLLECTION).limit(500));
      if (contents.size >= 500) throw new ApiError("관리 가능한 콘텐츠 수에 도달했습니다. 운영자에게 문의해 주세요.", 429, undefined, "CONTENT_CAPACITY_REACHED");
    }
    const draft = mutation.draft ?? current!.draft;
    if (draft.kind === "notice" ? draft.slug !== mutation.id : !uuidPattern.test(mutation.id)) invalid("콘텐츠 주소를 확인해 주세요.", "id");
    if (current && current.draft.kind !== draft.kind) invalid("콘텐츠 유형은 바꿀 수 없습니다.", "kind");
    if (current?.archived && ["save", "publish"].includes(mutation.action)) throw new ApiError("보관 해제한 뒤 수정해 주세요.", 409, undefined, "CONTENT_ARCHIVED");
    let draftEnglishSourceHash: string | null = null;
    if (draft.kind === "notice" && draft.english) {
      const currentEnglish = current?.draft.kind === "notice" ? current.draft.english : undefined;
      if (!currentEnglish || JSON.stringify(currentEnglish) !== JSON.stringify(draft.english)) draftEnglishSourceHash = koreanNoticeHash(draft);
      else if (!snapshot.exists && current?.draft.kind === "notice") draftEnglishSourceHash = koreanNoticeHash(current.draft);
      else if (record(stored) && typeof stored.draftEnglishSourceHash === "string" && /^[a-f0-9]{64}$/.test(stored.draftEnglishSourceHash)) draftEnglishSourceHash = stored.draftEnglishSourceHash;
      if (mutation.action === "publish" && mutation.englishReviewed) draftEnglishSourceHash = koreanNoticeHash(draft);
      if (mutation.action === "publish" && draftEnglishSourceHash !== koreanNoticeHash(draft)) throw new ApiError("한국어 내용이 바뀌었습니다. 영문도 수정하거나 비워 주세요.", 400, "english", "ENGLISH_REVIEW_REQUIRED");
    }
    const now = new Date().toISOString();
    const item: ManagedContentRecord = {
      id: mutation.id, draft, published: current?.published ?? null,
      publishedAt: current?.publishedAt ?? null,
      publishedRevision: current?.publishedRevision ?? (current?.published ? current.revision : 0),
      publishedUpdatedAt: current?.publishedUpdatedAt ?? (current?.published ? current.updatedAt : null),
      revision: (current?.revision ?? 0) + 1, updatedAt: now, archived: current?.archived ?? false, source: "database",
      ...(current?.noticeMetadata ? { noticeMetadata: current.noticeMetadata } : {}),
    };
    if (mutation.action === "publish") { item.published = parseManagedDraft(draft, true); item.publishedAt ||= item.published.startsAt ?? now; item.publishedRevision = item.revision; item.publishedUpdatedAt = now; }
    if (mutation.action === "unpublish" || mutation.action === "archive") item.published = null;
    if (mutation.action === "archive") item.archived = true;
    if (mutation.action === "restore") { item.archived = false; item.published = null; }
    transaction.set(ref, { ...item, draftEnglishSourceHash });
    return item;
  });
}

function koreanNoticeHash(draft: ManagedNoticeDraft) {
  return createHash("sha256").update(JSON.stringify([draft.title, draft.summary, draft.content])).digest("hex");
}
