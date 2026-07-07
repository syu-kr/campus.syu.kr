"use server";

import fs from "fs";
import path from "path";

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

function getServiceNoticePath(slug: string): string | null {
  if (!SERVICE_NOTICE_SLUG_PATTERN.test(slug)) {
    return null;
  }

  const noticesDir = path.resolve(NOTICES_DIR);
  const filePath = path.resolve(noticesDir, `${slug}.md`);
  const noticesDirPrefix = `${noticesDir}${path.sep}`;

  if (!filePath.startsWith(noticesDirPrefix)) {
    return null;
  }

  return filePath;
}

function createPlainTextExcerpt(content: string, maxLength: number): string {
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

/**
 * 모든 서비스 공지 조회 (목록)
 */
export async function getAllServiceNotices(): Promise<ServiceNotice[]> {
  if (!fs.existsSync(NOTICES_DIR)) {
    return [];
  }

  const files = fs
    .readdirSync(NOTICES_DIR)
    .filter((file) => file.endsWith(".md"));

  const notices = files
    .map((file) => {
      const filePath = path.join(NOTICES_DIR, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const { metadata, body } = parseFrontmatter(content);

      // 파일명에서 ID 추출 (001-service-launch.md → 001)
      const id = file.split("-")[0];
      const slug = file.replace(".md", "");
      const descriptionSource = metadata.description || body;

      return {
        id,
        slug,
        title: metadata.title || "무제",
        date: metadata.date || new Date().toISOString().split("T")[0],
        author: metadata.author || "시스템",
        excerpt: createPlainTextExcerpt(descriptionSource, 300),
        description: createPlainTextExcerpt(descriptionSource, 160),
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return notices;
}

/**
 * 특정 서비스 공지 상세 조회
 */
export async function getServiceNoticeBySlug(
  slug: string,
): Promise<ServiceNoticeDetail | null> {
  const filePath = getServiceNoticePath(slug);

  if (!filePath) {
    return null;
  }

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const { metadata, body } = parseFrontmatter(content);
  const descriptionSource = metadata.description || body;

  // 파일명에서 ID 추출
  const id = slug.split("-")[0];

  return {
    id,
    slug,
    title: metadata.title || "무제",
    date: metadata.date || new Date().toISOString().split("T")[0],
    author: metadata.author || "시스템",
    excerpt: createPlainTextExcerpt(descriptionSource, 300),
    description: createPlainTextExcerpt(descriptionSource, 160),
    content: body,
  };
}
