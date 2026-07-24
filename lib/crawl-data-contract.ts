export const DAILY_CRAWL_DATA_FILES = [
  "announcements-academic.json",
  "announcements-campus-life.json",
  "announcements-scholarship.json",
  "announcements-events.json",
  "announcements-departments.json",
  "cafeteria-menu.json",
  "announcement-ai-metadata.json",
] as const;

export type DailyCrawlDataFile = (typeof DAILY_CRAWL_DATA_FILES)[number];

interface CrawlDataManifestFile {
  path: string;
  sha256: string;
  size: number;
}

export interface CrawlDataManifest {
  schemaVersion: 1;
  version: string;
  publishedAt: string;
  files: Record<DailyCrawlDataFile, CrawlDataManifestFile>;
  retainedVersions: string[];
}

export const CRAWL_DATA_RETAINED_VERSION_LIMIT = 7;

const DAILY_CRAWL_DATA_FILE_SET = new Set<string>(DAILY_CRAWL_DATA_FILES);
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function isDailyCrawlDataFile(
  value: string,
): value is DailyCrawlDataFile {
  return DAILY_CRAWL_DATA_FILE_SET.has(value);
}

export function validateCrawlDataVersion(value: string): string {
  if (!VERSION_PATTERN.test(value)) {
    throw new Error("크롤링 데이터 버전 형식이 올바르지 않습니다.");
  }
  return value;
}

export function parseCrawlDataManifest(value: unknown): CrawlDataManifest {
  if (!isRecord(value)) {
    throw new Error("크롤링 데이터 manifest가 객체가 아닙니다.");
  }

  const { schemaVersion, version, publishedAt, files, retainedVersions } = value;
  if (schemaVersion !== 1) {
    throw new Error("지원하지 않는 크롤링 데이터 manifest 버전입니다.");
  }
  if (typeof version !== "string") {
    throw new Error("크롤링 데이터 버전 형식이 올바르지 않습니다.");
  }
  validateCrawlDataVersion(version);
  if (
    typeof publishedAt !== "string" ||
    Number.isNaN(Date.parse(publishedAt))
  ) {
    throw new Error("크롤링 데이터 게시 시각이 올바르지 않습니다.");
  }
  if (!isRecord(files)) {
    throw new Error("크롤링 데이터 파일 목록이 올바르지 않습니다.");
  }
  if (
    !Array.isArray(retainedVersions) ||
    retainedVersions.length === 0 ||
    retainedVersions.length > CRAWL_DATA_RETAINED_VERSION_LIMIT ||
    retainedVersions.some((item) => typeof item !== "string")
  ) {
    throw new Error("크롤링 데이터 보존 버전 목록이 올바르지 않습니다.");
  }

  const parsedRetainedVersions = retainedVersions.map((item) =>
    validateCrawlDataVersion(item),
  );
  if (
    new Set(parsedRetainedVersions).size !== parsedRetainedVersions.length ||
    !parsedRetainedVersions.includes(version)
  ) {
    throw new Error("크롤링 데이터 보존 버전 목록이 일관되지 않습니다.");
  }

  const parsedFiles = {} as Record<
    DailyCrawlDataFile,
    CrawlDataManifestFile
  >;

  for (const fileName of DAILY_CRAWL_DATA_FILES) {
    const entry = files[fileName];
    if (!isRecord(entry)) {
      throw new Error(`manifest에 ${fileName} 항목이 없습니다.`);
    }

    const expectedPath = `versions/${version}/${fileName}`;
    if (entry.path !== expectedPath) {
      throw new Error(`${fileName}의 Pages 경로가 올바르지 않습니다.`);
    }
    if (typeof entry.sha256 !== "string" || !SHA256_PATTERN.test(entry.sha256)) {
      throw new Error(`${fileName}의 SHA-256 값이 올바르지 않습니다.`);
    }
    if (
      typeof entry.size !== "number" ||
      !Number.isSafeInteger(entry.size) ||
      entry.size < 0
    ) {
      throw new Error(`${fileName}의 파일 크기가 올바르지 않습니다.`);
    }

    parsedFiles[fileName] = {
      path: entry.path,
      sha256: entry.sha256,
      size: entry.size,
    };
  }

  return {
    schemaVersion: 1,
    version,
    publishedAt,
    files: parsedFiles,
    retainedVersions: parsedRetainedVersions,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
