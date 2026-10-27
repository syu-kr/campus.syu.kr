import { readFile, readdir } from "node:fs/promises";
import path from "path";
import { createHash } from "node:crypto";
import type { Locale } from "./i18n/routing";
import type { ManagedContentRecord, ManagedNoticeDraft } from "@/types/managed-content";

const NOTICES_DIR = path.join(process.cwd(), "public", "service-notices");
const SERVICE_NOTICE_SLUG_PATTERN = /^[0-9A-Za-z][0-9A-Za-z-]*$/;

export interface ServiceNotice {
  id: string;
  slug: string;
  title: string;
  date: string;
  author: string;
  excerpt?: string;
  description?: string;
  lang?: "ko" | "en";
  startsAt?: string | null;
  endsAt?: string | null;
  modifiedAt?: string;
}

export interface ServiceNoticeDetail extends ServiceNotice {
  content: string;
}

/**
 * 마크다운 파일의 frontmatter와 컨텐츠를 파싱
 */
function parseFrontmatter(content: string): {
  metadata: Record<string, string>;
  body: string;
} {
  // Windows/Unix 줄바꿈 호환성: \r\n을 \n으로 정규화
  const normalizedContent = content.replace(/\r\n/g, "\n");

  // Frontmatter 매칭: --- ... --- 패턴
  const frontmatterMatch = normalizedContent.match(
    /^---\n([\s\S]*?)\n---\n([\s\S]*)$/,
  );

  if (!frontmatterMatch) {
    return { metadata: {}, body: content };
  }

  const yamlContent = frontmatterMatch[1];
  const body = frontmatterMatch[2];

  const metadata: Record<string, string> = {};

  // YAML 파싱: key: value 형식
  yamlContent.split("\n").forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith("#")) return; // 빈 줄이나 주석 무시

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) return;

    const key = line.substring(0, colonIndex).trim();
    let value = line.substring(colonIndex + 1).trim();

    // 따옴표 제거 (앞뒤 따옴표)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    metadata[key] = value;
  });

  return { metadata, body };
}

export function getServiceNoticePath(slug: string, locale: Locale = "ko"): string | null {
  if (!SERVICE_NOTICE_SLUG_PATTERN.test(slug)) {
    return null;
  }

  const noticesDir = path.resolve(locale === "en" ? path.join(NOTICES_DIR, "en") : NOTICES_DIR);
  const filePath = path.resolve(noticesDir, `${slug}.md`);
  const noticesDirPrefix = `${noticesDir}${path.sep}`;

  if (!filePath.startsWith(noticesDirPrefix)) {
    return null;
  }

  return filePath;
}

export function createPlainTextExcerpt(content: string, maxLength: number): string {
  const plainText = content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^([-*_])\1{2,}$/.test(line))
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/, "")
        .replace(/^[-*+]\s+/, "")
        .replace(/^\d+\.\s+/, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/[*_`>#~]/g, "")
        .trim(),
    )
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (plainText.length <= maxLength) {
    return plainText;
  }

  return `${plainText.slice(0, maxLength).trimEnd()}...`;
}

function createServiceNotice(slug: string, metadata: Record<string, string>, body: string): ServiceNotice {
  const descriptionSource = metadata.description || body;
  return {
    id: slug.split("-")[0],
    slug,
    title: metadata.title || "무제",
    date: metadata.date || new Date().toISOString().split("T")[0],
    author: metadata.author || "시스템",
    lang: metadata.lang === "en" ? "en" : "ko",
    excerpt: createPlainTextExcerpt(descriptionSource, 300),
    description: createPlainTextExcerpt(descriptionSource, 160),
  };
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

async function localizedContent(slug: string, source: string, locale: Locale) {
  const original = parseFrontmatter(source);
  if (locale !== "en" || original.metadata.lang === "en") return original;
  const translatedPath = getServiceNoticePath(slug, "en");
  if (!translatedPath) return original;
  let translated: string;
  try {
    translated = await readFile(translatedPath, "utf-8");
  } catch (error) {
    if (isMissingFile(error)) return original;
    throw error;
  }
  const variant = parseFrontmatter(translated);
  // Normalize checkout line endings so a Windows checkout has the same source identity.
  const sourceSha256 = createHash("sha256").update(source.replace(/\r\n/g, "\n"), "utf8").digest("hex");
  if (variant.metadata.lang !== "en" || variant.metadata.sourceSha256 !== sourceSha256 || !variant.metadata.title?.trim() || !variant.body.trim()) return original;
  return {
    metadata: { ...original.metadata, title: variant.metadata.title, description: variant.metadata.description || "", lang: "en" },
    body: variant.body,
  };
}

/**
 * 모든 서비스 공지 조회 (목록)
 */
export async function getRepositoryServiceNotices(locale: Locale = "ko"): Promise<ServiceNotice[]> {
  let files: string[];
  try {
    files = (await readdir(NOTICES_DIR)).filter((file) => file.endsWith(".md") && SERVICE_NOTICE_SLUG_PATTERN.test(file.slice(0, -3)));
  } catch (error) {
    if (isMissingFile(error)) return [];
    throw error;
  }
  const notices = await Promise.all(files.map(async (file) => {
    const filePath = path.join(NOTICES_DIR, file);
    const content = await readFile(filePath, "utf-8");
    const { metadata, body } = await localizedContent(file.slice(0, -3), content, locale);
    return createServiceNotice(file.replace(".md", ""), metadata, body);
  }));
  return notices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * 특정 서비스 공지 상세 조회
 */
export async function getRepositoryServiceNoticeBySlug(
  slug: string,
  locale: Locale = "ko",
): Promise<ServiceNoticeDetail | null> {
  const filePath = getServiceNoticePath(slug);

  if (!filePath) {
    return null;
  }

  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
  const { metadata, body } = await localizedContent(slug, content, locale);
  return {
    ...createServiceNotice(slug, metadata, body),
    content: body,
  };
}

export async function readRepositoryManagedContent(strictEnglish = false): Promise<ManagedContentRecord[]> {
  const notices = await getRepositoryServiceNotices();
  return Promise.all(notices.map(async notice => {
    const original = (await getRepositoryServiceNoticeBySlug(notice.slug))!;
    const english = await getRepositoryServiceNoticeBySlug(notice.slug, "en");
    const draft: ManagedNoticeDraft = {
      kind: "notice", slug: notice.slug, title: notice.title,
      summary: (notice.excerpt ?? "").slice(0, 300).trim(), content: original.content, startsAt: null, endsAt: null,
      ...(english?.lang === "en" ? { english: { title: english.title, summary: (english.excerpt ?? "").slice(0, 300).trim(), content: english.content } } : {}),
    };
    const source = (await readFile(getServiceNoticePath(notice.slug)!, "utf8")).replace(/\r\n/g, "\n");
    const sourceSha256 = createHash("sha256").update(source, "utf8").digest("hex");
    if (strictEnglish && notice.lang !== "en" && english?.lang !== "en") {
      try {
        await readFile(getServiceNoticePath(notice.slug, "en")!, "utf8");
        throw new Error(`Reviewed English does not match source: ${notice.slug}`);
      } catch (error) { if (!isMissingFile(error)) throw error; }
    }
    const date = new Date(notice.date).toISOString();
    return { id: notice.slug, draft, published: draft, publishedAt: date, updatedAt: date, revision: 0, archived: false, source: "repository", noticeMetadata: {
      publicId: notice.id, date: notice.date, author: notice.author, lang: notice.lang ?? "ko", sourceSha256,
      ...(english?.lang === "en" && notice.lang !== "en" ? { reviewedEnglishSourceSha256: sourceSha256 } : {}),
      excerpt: notice.excerpt ?? "", description: notice.description ?? "",
      ...(english?.lang === "en" ? { english: { excerpt: english.excerpt ?? "", description: english.description ?? "" } } : {}),
    } };
  }));
}
