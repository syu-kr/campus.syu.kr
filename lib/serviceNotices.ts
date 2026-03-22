"use server";

import fs from "fs";
import path from "path";

const NOTICES_DIR = path.join(process.cwd(), "public", "service-notices");

export interface ServiceNotice {
  id: string;
  slug: string;
  title: string;
  date: string;
  author: string;
  excerpt?: string;
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

      // 첫 줄을 excerpt로 사용 (첫 300자)
      const excerpt = body
        .replace(/^# .*\n/, "")
        .split("\n")[0]
        .substring(0, 300);

      return {
        id,
        slug,
        title: metadata.title || "무제",
        date: metadata.date || new Date().toISOString().split("T")[0],
        author: metadata.author || "시스템",
        excerpt: excerpt || "",
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
  const filePath = path.join(NOTICES_DIR, `${slug}.md`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const { metadata, body } = parseFrontmatter(content);

  // 파일명에서 ID 추출
  const id = slug.split("-")[0];

  return {
    id,
    slug,
    title: metadata.title || "무제",
    date: metadata.date || new Date().toISOString().split("T")[0],
    author: metadata.author || "시스템",
    content: body,
  };
}
