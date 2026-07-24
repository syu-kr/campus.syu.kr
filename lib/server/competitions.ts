import { attachAnnouncementAiSummaries } from "@/lib/server/announcement-ai";
import { readDailyCrawlDataJson } from "@/lib/server/crawl-data";
import type { DailyCrawlDataFile } from "@/lib/crawl-data-contract";
import type {
  AnnouncementCategory,
  AnnouncementAiSummary,
  CompetitionAnnouncement,
  CompetitionKind,
  CompetitionPageResponse,
  CompetitionSourceCategory,
  CompetitionSourceFilter,
  CompetitionStatus,
  CompetitionStatusFilter,
} from "@/types";

export interface CompetitionQuery {
  source?: CompetitionSourceFilter;
  status?: CompetitionStatusFilter;
  query?: string;
  page?: number;
  limit?: number;
}

type RawAnnouncement = {
  id?: unknown;
  title?: unknown;
  content?: unknown;
  category?: unknown;
  date?: unknown;
  author?: unknown;
  views?: unknown;
  isImportant?: unknown;
  isPinned?: unknown;
  url?: unknown;
  sourceName?: unknown;
  sourceUrl?: unknown;
  departmentName?: unknown;
  departmentUrl?: unknown;
  departmentNames?: unknown;
  departmentUrls?: unknown;
};

const SOURCE_BY_CATEGORY: Record<
  CompetitionSourceCategory,
  DailyCrawlDataFile
> = {
  academic: "announcements-academic.json",
  campus: "announcements-campus-life.json",
  scholarship: "announcements-scholarship.json",
  event: "announcements-events.json",
  department: "announcements-departments.json",
};

const SOURCE_ORDER: CompetitionSourceCategory[] = [
  "event",
  "department",
  "academic",
  "campus",
  "scholarship",
];

const COMPETITION_CACHE_TTL_MS = 60 * 1000;
const competitionCache = new Map<
  CompetitionSourceCategory,
  {
    expiresAt: number;
    promise: Promise<CompetitionAnnouncement[]>;
  }
>();

const KEYWORD_RULES: Array<{
  label: string;
  kind: CompetitionKind;
  terms: string[];
}> = [
  {
    label: "공모전",
    kind: "contest",
    terms: ["공모전", "공모이벤트", "공모 이벤트"],
  },
  {
    label: "프로그램 공모",
    kind: "program",
    terms: ["프로젝트 공모", "프로그램 공모", "봉사 프로그램 공모"],
  },
  {
    label: "공모",
    kind: "contest",
    terms: [
      "공모 안내",
      "공모 모집",
      "공모 및",
      "공모/",
      "공모사업",
      "아이디어 공모",
      "콘텐츠 공모",
      "프로젝트 공모",
      "프로그램 공모",
      "후기 공모",
      "수기 공모",
      "에세이 공모",
      "리포트 공모",
      "보고서 공모",
      "독후감 공모",
      "ucc 공모",
      "v-log 공모",
      "vlog 공모",
    ],
  },
  {
    label: "경진대회",
    kind: "competition",
    terms: ["경진대회", "경시대회", "발표대회", "발명대회"],
  },
  {
    label: "해커톤",
    kind: "hackathon",
    terms: ["해커톤", "hackathon"],
  },
  {
    label: "아이디어톤",
    kind: "idea",
    terms: ["아이디어톤", "idea 공모", "아이디어 공모"],
  },
  {
    label: "캡스톤디자인",
    kind: "capstone",
    terms: ["캡스톤디자인 경진", "캡스톤 디자인 경진"],
  },
  {
    label: "발표/토론",
    kind: "presentation",
    terms: [
      "말하기대회",
      "말하기 대회",
      "토론대회",
      "토론 대회",
      "글쓰기 대회",
      "스피치 릴레이",
      "프레젠테이션 경진",
    ],
  },
  {
    label: "영상/UCC",
    kind: "competition",
    terms: ["ucc", "영상 공모", "v-log", "vlog"],
  },
  {
    label: "대회",
    kind: "competition",
    terms: [
      "대회 안내",
      "대회 모집",
      "대회 참가",
      "대회 개최",
      "대회 결과",
      "선발대회",
      "코딩테스트 대회",
      "프로그래밍 경진",
    ],
  },
];

const RESULT_TERMS = [
  "결과 발표",
  "결과발표",
  "결과 안내",
  "결과안내",
  "심사결과",
  "심사 결과",
  "수상자",
  "수상 후보",
  "입상자",
  "당선",
  "본선 진출",
  "최종 심사",
  "선발 결과",
];

const CLOSED_TERMS = ["마감", "취소", "종료"];

const UNKNOWN_AI_VALUES = new Set(["", "unknown", "미정", "없음", "해당 없음"]);

export async function getCompetitionPage({
  source = "all",
  status = "open",
  query = "",
  page = 1,
  limit = 10,
}: CompetitionQuery): Promise<CompetitionPageResponse> {
  const normalizedPage = Math.max(1, Math.floor(page));
  const normalizedLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const normalizedQuery = normalizeText(query.trim());
  const sources = source === "all" ? SOURCE_ORDER : [source];

  const sourceItems = await Promise.all(
    sources.map((sourceCategory) => readCompetitionAnnouncements(sourceCategory)),
  );

  const filtered = sourceItems
    .flat()
    .filter((announcement) =>
      status === "all" ? true : announcement.competitionStatus === status,
    )
    .filter((announcement) => {
      if (!normalizedQuery) return true;
      return getSearchText(announcement).includes(normalizedQuery);
    })
    .sort(sortCompetitionsByDate);

  const start = (normalizedPage - 1) * normalizedLimit;

  return {
    items: filtered.slice(start, start + normalizedLimit),
    total: filtered.length,
    page: normalizedPage,
    limit: normalizedLimit,
    totalPages: Math.max(1, Math.ceil(filtered.length / normalizedLimit)),
  };
}

async function readCompetitionAnnouncements(
  sourceCategory: CompetitionSourceCategory,
): Promise<CompetitionAnnouncement[]> {
  const now = Date.now();
  const cached = competitionCache.get(sourceCategory);

  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = readCompetitionAnnouncementsFromSource(sourceCategory).catch(
    (error) => {
      competitionCache.delete(sourceCategory);
      throw error;
    },
  );

  competitionCache.set(sourceCategory, {
    expiresAt: now + COMPETITION_CACHE_TTL_MS,
    promise,
  });

  return promise;
}

async function readCompetitionAnnouncementsFromSource(
  sourceCategory: CompetitionSourceCategory,
): Promise<CompetitionAnnouncement[]> {
  const fileName = SOURCE_BY_CATEGORY[sourceCategory];
  const items = await readDailyCrawlDataJson<RawAnnouncement[]>(fileName);

  const candidates = items
    .map((item, index) => toCompetitionCandidate(item, sourceCategory, index))
    .filter((item): item is CompetitionAnnouncement => item !== null);
  const withAiSummaries = (await attachAnnouncementAiSummaries(
    candidates,
  )) as CompetitionAnnouncement[];

  return withAiSummaries
    .map(applyCompetitionAnalysis)
    .filter((item): item is CompetitionAnnouncement => item !== null);
}

function toCompetitionCandidate(
  item: RawAnnouncement,
  sourceCategory: CompetitionSourceCategory,
  index: number,
): CompetitionAnnouncement | null {
  const title = readString(item.title);
  const content = readString(item.content);
  const departmentNames = readStringArray(item.departmentNames);
  const departmentUrls = readStringArray(item.departmentUrls);

  if (!title) return null;

  return {
    id: readString(item.id) || `${sourceCategory}-${index}`,
    title,
    content,
    category: toAnnouncementCategory(item.category, sourceCategory),
    sourceCategory,
    date: readString(item.date),
    author: readString(item.author),
    views: readNumber(item.views),
    isImportant: Boolean(item.isImportant),
    isPinned: Boolean(item.isPinned),
    url: readOptionalString(item.url),
    competitionStatus: "open",
    competitionKind: "contest",
    matchedKeywords: [],
    sourceName:
      readOptionalString(item.sourceName) ||
      readOptionalString(item.departmentName),
    sourceUrl:
      readOptionalString(item.sourceUrl) ||
      readOptionalString(item.departmentUrl),
    departmentNames,
    departmentUrls,
  };
}

function applyCompetitionAnalysis(
  announcement: CompetitionAnnouncement,
): CompetitionAnnouncement | null {
  const searchableText = getCompetitionAnalysisText(announcement);
  const matchedKeywords = getMatchedKeywords(searchableText);

  if (matchedKeywords.length === 0) return null;
  if (isExcludedCompetition(searchableText)) return null;

  return {
    ...announcement,
    competitionStatus: getCompetitionStatus(
      searchableText,
      announcement.aiSummary,
    ),
    competitionKind: getCompetitionKind(searchableText),
    matchedKeywords,
  };
}

function getMatchedKeywords(searchableText: string): string[] {
  return KEYWORD_RULES.flatMap((rule) =>
    rule.terms.some((term) => searchableText.includes(term))
      ? [rule.label]
      : [],
  );
}

function isExcludedCompetition(searchableText: string): boolean {
  if (searchableText.includes("수상안전")) return true;
  if (
    searchableText.includes("아산상") ||
    searchableText.includes("수상 후보") ||
    searchableText.includes("수상후보")
  ) {
    return !searchableText.includes("공모전");
  }

  if (
    searchableText.includes("체육대회") &&
    (searchableText.includes("수업") ||
      searchableText.includes("정상수업") ||
      searchableText.includes("진행요원") ||
      searchableText.includes("기간 중"))
  ) {
    return true;
  }

  if (
    searchableText.includes("학술대회") &&
    !searchableText.includes("논문 공모")
  ) {
    return true;
  }

  return false;
}

function getCompetitionStatus(
  searchableText: string,
  aiSummary: AnnouncementAiSummary | undefined,
): CompetitionStatus {
  if (RESULT_TERMS.some((term) => searchableText.includes(term))) {
    return "result";
  }

  const deadlineStatus = getAiDeadlineStatus(aiSummary?.deadline);
  if (deadlineStatus === "future") {
    return "open";
  }

  if (deadlineStatus === "past") {
    return "closed";
  }

  if (CLOSED_TERMS.some((term) => searchableText.includes(term))) {
    return "closed";
  }

  return "open";
}

function getCompetitionKind(searchableText: string): CompetitionKind {
  if (searchableText.includes("해커톤")) return "hackathon";
  if (searchableText.includes("hackathon")) return "hackathon";
  if (searchableText.includes("캡스톤디자인 경진")) return "capstone";
  if (searchableText.includes("캡스톤 디자인 경진")) return "capstone";
  if (searchableText.includes("아이디어톤")) return "idea";
  if (searchableText.includes("아이디어 공모")) return "idea";
  if (searchableText.includes("idea 공모")) return "idea";
  if (
    searchableText.includes("말하기대회") ||
    searchableText.includes("말하기 대회") ||
    searchableText.includes("토론대회") ||
    searchableText.includes("토론 대회") ||
    searchableText.includes("글쓰기 대회") ||
    searchableText.includes("스피치 릴레이") ||
    searchableText.includes("프레젠테이션 경진")
  ) {
    return "presentation";
  }
  if (
    searchableText.includes("경진대회") ||
    searchableText.includes("경시대회") ||
    searchableText.includes("발표대회") ||
    searchableText.includes("발명대회") ||
    searchableText.includes("선발대회") ||
    searchableText.includes("코딩테스트 대회") ||
    searchableText.includes("프로그래밍 경진")
  ) {
    return "competition";
  }
  if (
    searchableText.includes("프로젝트 공모") ||
    searchableText.includes("프로그램 공모") ||
    searchableText.includes("봉사 프로그램 공모")
  ) {
    return "program";
  }

  return "contest";
}

function getSearchText(announcement: CompetitionAnnouncement): string {
  return normalizeText(
    [
      announcement.title,
      announcement.content,
      announcement.author,
      announcement.sourceName,
      ...(announcement.departmentNames || []),
      announcement.sourceCategory,
      announcement.competitionStatus,
      announcement.competitionKind,
      ...announcement.matchedKeywords,
      announcement.aiSummary?.summary,
      announcement.aiSummary?.target,
      announcement.aiSummary?.deadline,
      announcement.aiSummary?.requiredAction,
      ...(announcement.aiSummary?.keywords || []),
    ].join(" "),
  );
}

function getCompetitionAnalysisText(
  announcement: CompetitionAnnouncement,
): string {
  return normalizeText(
    [
      announcement.title,
      announcement.content,
      announcement.author,
      announcement.sourceName,
      ...(announcement.departmentNames || []),
      announcement.aiSummary?.summary,
      announcement.aiSummary?.target,
      announcement.aiSummary?.deadline,
      announcement.aiSummary?.requiredAction,
      ...(announcement.aiSummary?.keywords || []),
    ].join(" "),
  );
}

function getAiDeadlineStatus(
  deadline: string | undefined,
): "future" | "past" | "unknown" {
  const normalizedDeadline = normalizeText(deadline || "");
  if (UNKNOWN_AI_VALUES.has(normalizedDeadline)) return "unknown";
  if (normalizedDeadline.includes("상시")) return "unknown";

  const parsed = parseDeadlineDate(deadline || "");
  if (!parsed) return "unknown";

  const endOfDeadline = new Date(parsed);
  endOfDeadline.setHours(23, 59, 59, 999);

  return Date.now() > endOfDeadline.getTime() ? "past" : "future";
}

function parseDeadlineDate(value: string): Date | null {
  const explicitYearMatch = value.match(
    /(20\d{2})\s*[년.\-/]\s*(\d{1,2})\s*[월.\-/]\s*(\d{1,2})/,
  );
  if (explicitYearMatch) {
    return buildDate(
      Number(explicitYearMatch[1]),
      Number(explicitYearMatch[2]),
      Number(explicitYearMatch[3]),
    );
  }

  const monthDayMatch = value.match(
    /(?:^|[^0-9])(\d{1,2})\s*[월.\-/]\s*(\d{1,2})\s*일?/,
  );
  if (!monthDayMatch) return null;

  return buildDate(
    new Date().getFullYear(),
    Number(monthDayMatch[1]),
    Number(monthDayMatch[2]),
  );
}

function buildDate(year: number, month: number, day: number): Date | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function toAnnouncementCategory(
  rawCategory: unknown,
  sourceCategory: CompetitionSourceCategory,
): AnnouncementCategory {
  if (
    rawCategory === "academic" ||
    rawCategory === "campus" ||
    rawCategory === "scholarship"
  ) {
    return rawCategory;
  }

  if (sourceCategory === "scholarship") return "scholarship";
  if (sourceCategory === "academic") return "academic";
  return "campus";
}

function sortCompetitionsByDate(
  a: CompetitionAnnouncement,
  b: CompetitionAnnouncement,
) {
  const dateDiff = parseAnnouncementDate(b.date) - parseAnnouncementDate(a.date);
  if (dateDiff !== 0) return dateDiff;

  if (a.isPinned && !b.isPinned) return -1;
  if (!a.isPinned && b.isPinned) return 1;
  if (a.isImportant && !b.isImportant) return -1;
  if (!a.isImportant && b.isImportant) return 1;

  return a.title.localeCompare(b.title, "ko");
}

function parseAnnouncementDate(date: string) {
  const normalizedDate = date.replace(/\./g, "-");
  const parsed = new Date(normalizedDate).getTime();

  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readOptionalString(value: unknown): string | undefined {
  const text = readString(value).trim();
  return text || undefined;
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(readString)
    .map((text) => text.trim())
    .filter(Boolean);
}
