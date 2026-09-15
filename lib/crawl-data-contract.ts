export const DAILY_CRAWL_DATA_FILES = [
  "announcements-academic.json",
  "announcements-campus-life.json",
  "announcements-scholarship.json",
  "announcements-events.json",
  "announcements-departments.json",
  "announcements-sw.json",
  "cafeteria-menu.json",
  "announcement-ai-metadata.json",
] as const;

export type DailyCrawlDataFile = (typeof DAILY_CRAWL_DATA_FILES)[number];

export const CRAWL_DATA_MAX_BYTES: Record<DailyCrawlDataFile, number> = {
  "announcements-academic.json": 4 * 1024 * 1024,
  "announcements-campus-life.json": 2 * 1024 * 1024,
  "announcements-scholarship.json": 2 * 1024 * 1024,
  "announcements-events.json": 2 * 1024 * 1024,
  "announcements-departments.json": 1024 * 1024,
  "announcements-sw.json": 1024 * 1024,
  "cafeteria-menu.json": 128 * 1024,
  "announcement-ai-metadata.json": 8 * 1024 * 1024,
};

interface CrawlDataManifestFile {
  path: string;
  sha256: string;
  size: number;
}

export interface CrawlDataManifest {
  schemaVersion: 1;
  version: string;
  publishedAt: string;
  files: Partial<Record<DailyCrawlDataFile, CrawlDataManifestFile>>;
  retainedVersions: string[];
}

export const CRAWL_DATA_RETAINED_VERSION_LIMIT = 7;

const DAILY_CRAWL_DATA_FILE_SET = new Set<string>(DAILY_CRAWL_DATA_FILES);
const LEGACY_OPTIONAL_FILES = new Set<DailyCrawlDataFile>([
  "announcements-sw.json",
]);
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

  const parsedFiles: CrawlDataManifest["files"] = {};

  for (const fileName of DAILY_CRAWL_DATA_FILES) {
    const entry = files[fileName];
    if (!isRecord(entry)) {
      if (LEGACY_OPTIONAL_FILES.has(fileName)) continue;
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
      entry.size < 0 ||
      entry.size > CRAWL_DATA_MAX_BYTES[fileName]
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

export function validateDailyCrawlData(
  fileName: DailyCrawlDataFile,
  value: unknown,
): void {
  if (fileName.startsWith("announcements-")) {
    validateAnnouncements(fileName, value);
    return;
  }
  if (fileName === "cafeteria-menu.json") {
    validateCafeteria(value);
    return;
  }
  validateAnnouncementAiMetadata(value);
}

function validateAnnouncements(fileName: string, value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error(`${fileName}이 배열이 아닙니다.`);
  }

  const ids = new Set<string>();
  for (const item of value) {
    if (
      !isRecord(item) ||
      !isLimitedString(item.id, 200) ||
      !isLimitedString(item.title, 500) ||
      !/^\d{4}\.\d{2}\.\d{2}$/.test(String(item.date)) ||
      !isLimitedString(item.author, 200) ||
      !isLimitedString(item.url, 2048) ||
      !["academic", "campus", "event", "scholarship", "sw"].includes(
        String(item.category),
      ) ||
      typeof item.isImportant !== "boolean" ||
      typeof item.isPinned !== "boolean"
    ) {
      throw new Error(`${fileName}에 올바르지 않은 공지 항목이 있습니다.`);
    }

    const url = new URL(item.url);
    if (
      url.protocol !== "https:" ||
      (url.hostname !== "syu.ac.kr" && !url.hostname.endsWith(".syu.ac.kr"))
    ) {
      throw new Error(`${fileName}에 허용되지 않은 공지 URL이 있습니다.`);
    }
    if (ids.has(item.id)) {
      throw new Error(`${fileName}에 중복 공지 ID가 있습니다.`);
    }
    ids.add(item.id);
  }
}

function validateCafeteria(value: unknown) {
  if (
    !isRecord(value) ||
    !isLimitedString(value.id, 200) ||
    !isLimitedString(value.name, 200) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(String(value.weekStart)) ||
    !isLimitedString(value.lastUpdated, 100) ||
    Number.isNaN(Date.parse(value.lastUpdated)) ||
    !Array.isArray(value.menus)
  ) {
    throw new Error("cafeteria-menu.json 구조가 올바르지 않습니다.");
  }

  for (const menu of value.menus) {
    if (
      !isRecord(menu) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(menu.date)) ||
      !isLimitedString(menu.day, 10) ||
      !isRecord(menu.meals) ||
      !isStringArray(menu.meals.breakfast) ||
      !isStringArray(menu.meals.dinner) ||
      !isRecord(menu.meals.lunch) ||
      !isStringArray(menu.meals.lunch.a_corner) ||
      !isStringArray(menu.meals.lunch.b_corner)
    ) {
      throw new Error("cafeteria-menu.json에 올바르지 않은 식단이 있습니다.");
    }
  }
}

function validateAnnouncementAiMetadata(value: unknown) {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !isLimitedString(value.generatedAt, 100) ||
    Number.isNaN(Date.parse(value.generatedAt)) ||
    !isRecord(value.items)
  ) {
    throw new Error("announcement-ai-metadata.json 구조가 올바르지 않습니다.");
  }

  for (const item of Object.values(value.items)) {
    if (
      !isRecord(item) ||
      !isLimitedString(item.summary, 120) ||
      !isLimitedString(item.target, 100) ||
      !isLimitedString(item.deadline, 100) ||
      !isLimitedString(item.requiredAction, 100) ||
      !Array.isArray(item.keywords) ||
      item.keywords.length < 2 ||
      item.keywords.length > 8 ||
      !item.keywords.every((keyword) => isLimitedString(keyword, 30)) ||
      !["low", "normal", "high"].includes(String(item.importance)) ||
      !["low", "medium", "high"].includes(String(item.confidence))
    ) {
      throw new Error("announcement-ai-metadata.json에 올바르지 않은 요약이 있습니다.");
    }
    const publishedText = [
      item.summary,
      item.target,
      item.deadline,
      item.requiredAction,
      ...item.keywords,
    ].join("\n");
    if (
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(publishedText) ||
      /(?<!\d)(?:01[016789]|0(?:2|[3-8]\d))[-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/.test(
        publishedText,
      )
    ) {
      throw new Error("announcement-ai-metadata.json에 공개할 수 없는 연락처가 있습니다.");
    }
  }
}

function isLimitedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => isLimitedString(item, 500));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
