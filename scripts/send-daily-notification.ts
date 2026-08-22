// scripts/send-daily-notification.ts
import { createHash } from "crypto";
import type { DailyCrawlDataFile } from "../lib/crawl-data-contract";
import { readDailyCrawlDataJson } from "../lib/server/crawl-data";
import {
  buildDailyPushCopy,
  type AnnouncementStats,
  type DailyPushCopyResult,
} from "../lib/server/daily-push-copy";
import { admin, initializeScriptFirestore } from "./firebase-admin";

interface AnnouncementData {
  title: string;
  date: string;
  category: string;
  [key: string]: unknown;
}

interface DailyNotificationContext {
  dedupeKey: string;
  koreaDate: string;
  targetDate: string;
}

interface KoreaDayWindow {
  dateKey: string;
}

const DAILY_ANNOUNCEMENT_SOURCES: Record<string, DailyCrawlDataFile> = {
  academic: "announcements-academic.json",
  scholarship: "announcements-scholarship.json",
};

async function getAnnouncementStats(
  targetWindow: KoreaDayWindow,
): Promise<AnnouncementStats[]> {
  return Promise.all(
    Object.entries(DAILY_ANNOUNCEMENT_SOURCES).map(([category, filename]) =>
      getAnnouncementStatsFromJSON(category, filename, targetWindow),
    ),
  );
}

async function getAnnouncementStatsFromJSON(
  category: string,
  filename: DailyCrawlDataFile,
  targetWindow: KoreaDayWindow,
): Promise<AnnouncementStats> {
  try {
    const announcements =
      await readDailyCrawlDataJson<AnnouncementData[]>(filename);

    const filtered = announcements.filter((announcement) => {
      return (
        normalizeKoreaDateString(announcement.date) === targetWindow.dateKey
      );
    });

    const items = filtered
      .map((announcement) => ({
        category,
        title: readAnnouncementTitle(announcement.title),
        date: normalizeKoreaDateString(announcement.date),
      }))
      .filter((item) => item.title);

    return {
      category,
      count: filtered.length,
      titles: items.map((item) => item.title).slice(0, 3),
      items: items.slice(0, 8),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${filename} 공지 JSON을 읽지 못했습니다: ${reason}`);
  }
}

async function sendNotification(
  stats: AnnouncementStats[],
  context: DailyNotificationContext,
  copyResult: DailyPushCopyResult,
) {
  const apiUrl = process.env.API_URL;
  const apiKey = process.env.PUSH_API_KEY;

  if (!apiUrl) {
    throw new Error("API_URL 환경 변수가 필요합니다");
  }

  if (
    process.env.GITHUB_ACTIONS === "true" &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(apiUrl)
  ) {
    throw new Error("GitHub Actions에서는 localhost API_URL을 사용할 수 없습니다");
  }

  if (!apiKey) {
    throw new Error("PUSH_API_KEY 환경 변수가 필요합니다");
  }

  // 한국 시간으로 변환
  const koreaTime = new Date().toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // 공지사항 개수 정보
  const academic = stats.find((s) => s.category === "academic");
  const scholarship = stats.find((s) => s.category === "scholarship");

  const academicCount = academic?.count || 0;
  const scholarshipCount = scholarship?.count || 0;

  const { title, body } = copyResult.copy;

  // API 호출
  try {
    const requestBody = JSON.stringify({
      title,
      body,
      category: "daily-summary",
      url: "/academic/announcements",
      dedupeKey: context.dedupeKey,
      timestamp: koreaTime,
      stats: {
        academic: academicCount,
        scholarship: scholarshipCount,
      },
    });

    // UTF-8 인코딩된 body의 정확한 길이 계산
    const bodyBuffer = Buffer.from(requestBody, "utf-8");

    const response = await fetch(`${apiUrl}/api/notifications/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": bodyBuffer.length.toString(),
        "x-api-key": apiKey,
      },
      body: requestBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Script] API 응답 오류:`, {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(
        `API 응답: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const result = await response.json();
    console.log("✅ 알림 발송 성공:", JSON.stringify(result, null, 2));

    // 실제 발송된 토큰 수 로깅
    if (result.data) {
      console.log(`   - 전체 토큰: ${result.data.tokensCount}`);
      console.log(`   - 성공: ${result.data.successCount}`);
      console.log(`   - 실패: ${result.data.failureCount}`);
    }

    return result;
  } catch (error) {
    console.error("❌ 알림 발송 실패:", error);
    throw error;
  }
}

async function logNotificationRecord(
  stats: AnnouncementStats[],
  context: DailyNotificationContext,
  copyResult: DailyPushCopyResult,
) {
  const db = await initializeScriptFirestore();
  const recordId = createHash("sha256").update(context.dedupeKey).digest("hex");

  await db.collection("notifications_scheduled").doc(recordId).set({
    type: "daily-summary",
    dedupeKey: context.dedupeKey,
    koreaDate: context.koreaDate,
    targetDate: context.targetDate,
    dataSource: "public-data-json",
    timestamp: admin.firestore.Timestamp.now(),
    stats: {
      academic: stats.find((s) => s.category === "academic")?.count || 0,
      scholarship: stats.find((s) => s.category === "scholarship")?.count || 0,
    },
    executedBy: "github-actions",
    status: "success",
    copySource: copyResult.source,
    aiModel: copyResult.model,
    promptVersion: copyResult.promptVersion,
    copyFallbackReason: copyResult.reason,
  });

  console.log("📝 Firestore에 기록 저장됨");
}

interface DailyNotificationJobOptions {
  now?: Date;
  dryRun?: boolean;
  getStats?: typeof getAnnouncementStats;
  buildCopy?: typeof buildDailyPushCopy;
  send?: typeof sendNotification;
  logRecord?: typeof logNotificationRecord;
}

export async function runDailyNotificationJob(
  options: DailyNotificationJobOptions = {},
) {
  console.log("🚀 Daily Announcement Notification Job 시작\n");
  const now = options.now ?? new Date();
  const targetWindow = createPreviousKoreaDayWindow(now);
  const context = createDailyNotificationContext(now, targetWindow);
  const dryRun = options.dryRun ?? process.env.DRY_RUN === "true";
  console.log(`중복 방지 키: ${context.dedupeKey}`);
  console.log(`공지 기준일: ${context.targetDate}`);

  console.log("1️⃣ 공지사항 통계 조회 중...");
  const stats = await (options.getStats ?? getAnnouncementStats)(targetWindow);
  const copyResult = await (options.buildCopy ?? buildDailyPushCopy)(stats, context);
  console.log("[Push copy AI] selection", {
    source: copyResult.source,
    model: copyResult.model,
    promptVersion: copyResult.promptVersion,
    reason: copyResult.reason,
    usage: copyResult.usage,
  });

  if (dryRun) {
    console.log("DRY_RUN=true: FCM 호출과 Firestore 기록을 건너뜁니다.");
    return { dryRun: true, stats, context, copyResult };
  }

  console.log("\n2️⃣ FCM 알림 발송 중...");
  await (options.send ?? sendNotification)(stats, context, copyResult);

  console.log("\n3️⃣ 실행 기록 저장 중...");
  await (options.logRecord ?? logNotificationRecord)(stats, context, copyResult);

  console.log("\n✅ Job 완료!");
  return { dryRun: false, stats, context, copyResult };
}

async function main() {
  try {
    await runDailyNotificationJob();
  } catch (error) {
    console.error("\n❌ Job 실패:", error);
    process.exitCode = 1;
  }
}

function createDailyNotificationContext(
  now: Date,
  targetWindow: KoreaDayWindow,
): DailyNotificationContext {
  const koreaDate = formatKoreaDate(now);
  return {
    koreaDate,
    targetDate: targetWindow.dateKey,
    dedupeKey: `daily-summary:${koreaDate}`,
  };
}

function createPreviousKoreaDayWindow(now: Date): KoreaDayWindow {
  const todayStart = startOfKoreaDate(getKoreaDateParts(now));
  const start = new Date(todayStart.getTime() - 86400000);

  return {
    dateKey: formatKoreaDate(start),
  };
}

function formatKoreaDate(date: Date): string {
  const { year, month, day } = getKoreaDateParts(date);
  return `${year}-${month}-${day}`;
}

function getKoreaDateParts(date: Date): {
  year: string;
  month: string;
  day: string;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("한국 날짜를 계산하지 못했습니다");
  }

  return { year, month, day };
}

function startOfKoreaDate({
  year,
  month,
  day,
}: {
  year: string;
  month: string;
  day: string;
}): Date {
  return new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)) - 9 * 60 * 60 * 1000,
  );
}

function normalizeKoreaDateString(value: string): string {
  const match = value.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
  if (!match) return "";

  const [, year, month, day] = match;
  if (!year || !month || !day) return "";

  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function readAnnouncementTitle(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

if (typeof require !== "undefined" && require.main === module) {
  void main();
}
