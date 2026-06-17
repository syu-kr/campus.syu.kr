// scripts/send-daily-notification.ts
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import {
  compactAiText,
  readNumberEnv,
  requestSupilotJsonObject,
} from "../lib/server/supilot-json";
import { admin, initializeScriptFirestore } from "./firebase-admin";

interface AnnouncementDigestItem {
  category: string;
  title: string;
  date: string;
}

interface AnnouncementStats {
  category: string;
  count: number;
  titles: string[];
  items: AnnouncementDigestItem[];
}

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
  start: Date;
  end: Date;
}

interface DailyPushCopy {
  title: string;
  body: string;
}

interface RawDailyPushCopy {
  title?: unknown;
  body?: unknown;
}

const DEFAULT_PUSH_COPY_TIMEOUT_MS = 12000;
const DEFAULT_PUSH_COPY_MAX_RETRIES = 2;
const DEFAULT_PUSH_COPY_RETRY_BASE_MS = 1500;
const MAX_ANNOUNCEMENT_ITEMS_FOR_AI = 12;

async function getAnnouncementStats(
  targetWindow: KoreaDayWindow,
): Promise<AnnouncementStats[]> {

  const categories = ["academic", "scholarship"];
  const results: AnnouncementStats[] = [];
  let db: admin.firestore.Firestore | null = null;
  let firestoreUnavailableReason = "";

  try {
    db = await initializeScriptFirestore();
  } catch (error) {
    firestoreUnavailableReason =
      error instanceof Error ? error.message : String(error);
    console.warn(
      "Firestore 공지 통계 조회를 사용할 수 없어 JSON fallback으로 진행합니다:",
      firestoreUnavailableReason,
    );
  }

  for (const category of categories) {
    // Firestore 시도
    let success = false;
    if (db) {
      try {
        const snapshot = await db
          .collection("announcements")
          .where("category", "==", category)
          .where(
            "created_at",
            ">=",
            admin.firestore.Timestamp.fromDate(targetWindow.start),
          )
          .where(
            "created_at",
            "<",
            admin.firestore.Timestamp.fromDate(targetWindow.end),
          )
          .orderBy("created_at", "desc")
          .get();

        const items = snapshot.docs.map((doc) => {
          const data = doc.data();

          return {
            category,
            title: readAnnouncementTitle(data.title),
            date: targetWindow.dateKey,
          };
        });

        results.push({
          category,
          count: snapshot.size,
          titles: items.map((item) => item.title).filter(Boolean).slice(0, 3),
          items: items.filter((item) => item.title).slice(0, 8),
        });

        success = true;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(
          `${category} Firestore 공지 통계 조회 실패, JSON fallback 사용:`,
          reason,
        );
      }
    }

    // Firestore 실패 시 JSON 파일에서 로드
    if (!success) {
      const jsonData = await getAnnouncementStatsFromJSON(
        category,
        targetWindow,
      );
      results.push(jsonData);
    }
  }

  return results;
}

async function getAnnouncementStatsFromJSON(
  category: string,
  targetWindow: KoreaDayWindow,
): Promise<AnnouncementStats> {
  const fileMap: { [key: string]: string } = {
    academic: "announcements-academic.json",
    scholarship: "announcements-scholarship.json",
  };

  const filename = fileMap[category];
  if (!filename) {
    return { category, count: 0, titles: [], items: [] };
  }

  try {
    const filepath = path.join(process.cwd(), "public/data", filename);

    if (!fs.existsSync(filepath)) {
      return { category, count: 0, titles: [], items: [] };
    }

    const rawData = fs.readFileSync(filepath, "utf-8");
    const announcements: AnnouncementData[] = JSON.parse(rawData);

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
  } catch {
    return { category, count: 0, titles: [], items: [] };
  }
}

async function sendNotification(
  stats: AnnouncementStats[],
  context: DailyNotificationContext,
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

  const { title, body } = await buildDailyPushCopy(stats, context);

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

async function buildDailyPushCopy(
  stats: AnnouncementStats[],
  context: DailyNotificationContext,
): Promise<DailyPushCopy> {
  const fallback = buildFallbackDailyPushCopy(stats);
  const apiKey = readOptionalEnv("SUPILOT_PUSH_COPY_API_KEY", "SUPILOT_API_KEY");

  if (!apiKey) {
    console.log("SUPILOT_PUSH_COPY_API_KEY가 없어 기본 푸시 문구를 사용합니다.");
    return fallback;
  }

  try {
    const raw = await requestSupilotJsonObject<RawDailyPushCopy>({
      apiKey,
      baseUrl: readOptionalEnv(
        "SUPILOT_PUSH_COPY_API_BASE_URL",
        "SUPILOT_API_BASE_URL",
      ),
      message: buildDailyPushCopyPrompt(stats, context),
      timeoutMs: readNumberEnv(
        "SUPILOT_PUSH_COPY_TIMEOUT_MS",
        DEFAULT_PUSH_COPY_TIMEOUT_MS,
      ),
      maxRetries: readNumberEnv(
        "SUPILOT_PUSH_COPY_MAX_RETRIES",
        DEFAULT_PUSH_COPY_MAX_RETRIES,
      ),
      retryBaseMs: readNumberEnv(
        "SUPILOT_PUSH_COPY_RETRY_BASE_MS",
        DEFAULT_PUSH_COPY_RETRY_BASE_MS,
      ),
    });

    return normalizeDailyPushCopy(raw, fallback);
  } catch (error) {
    console.warn("AI 푸시 문구 생성 실패, 기본 문구를 사용합니다:", error);
    return fallback;
  }
}

function buildDailyPushCopyPrompt(
  stats: AnnouncementStats[],
  context: DailyNotificationContext,
) {
  const announcements = stats
    .flatMap((stat) =>
      stat.items.map((item) => ({
        category: item.category,
        title: item.title,
        date: item.date,
      })),
    )
    .slice(0, MAX_ANNOUNCEMENT_ITEMS_FOR_AI);

  return `당신은 SYU CAMPUS 푸시 알림 문구 작성 어시스턴트입니다.
지정된 날짜에 새로 수집된 공지 목록을 학생용 짧은 알림 제목과 본문으로 압축하세요.

규칙:
- 반드시 제공된 목록과 개수만 근거로 작성하세요.
- 없는 마감, 혜택, 긴급성을 추측하지 마세요.
- 한국어로 작성하세요.
- title은 45자 이내입니다.
- body는 100자 이내입니다.
- title과 body는 줄바꿈 없이 한 문장 또는 짧은 구로 작성하세요.
- 공지가 없으면 새 공지가 없다는 사실만 담으세요.
- JSON 외의 문장, 마크다운, 코드블록을 출력하지 마세요.

출력 JSON:
{
  "title": "45자 이내 알림 제목",
  "body": "100자 이내 알림 본문"
}

알림 실행일: ${context.koreaDate}
공지 기준일: ${context.targetDate}
공지 개수:
${stats.map((stat) => `- ${stat.category}: ${stat.count}개`).join("\n")}
공지 목록:
${announcements.length > 0 ? JSON.stringify(announcements, null, 2) : "없음"}`;
}

function normalizeDailyPushCopy(
  raw: RawDailyPushCopy,
  fallback: DailyPushCopy,
): DailyPushCopy {
  const title = compactAiText(raw.title, 45);
  const body = compactAiText(raw.body, 100);

  if (!title || !body) {
    return fallback;
  }

  return { title, body };
}

function buildFallbackDailyPushCopy(stats: AnnouncementStats[]): DailyPushCopy {
  const academic = stats.find((stat) => stat.category === "academic");
  const scholarship = stats.find((stat) => stat.category === "scholarship");
  const academicCount = academic?.count || 0;
  const scholarshipCount = scholarship?.count || 0;
  const titleParts: string[] = [];

  if (academicCount > 0) titleParts.push(`학사 ${academicCount}개`);
  if (scholarshipCount > 0) titleParts.push(`장학 ${scholarshipCount}개`);

  if (titleParts.length === 0) {
    return {
      title: "새 공지사항 없음",
      body: "새로 수집된 학사·장학 공지가 없습니다.",
    };
  }

  const bodyParts = [
    academicCount > 0 ? `학사: ${academic?.titles[0] || "새 공지"}` : "",
    scholarshipCount > 0 ? `장학: ${scholarship?.titles[0] || "새 공지"}` : "",
  ].filter(Boolean);

  return {
    title: compactAiText(`새 공지 ${titleParts.join(", ")}`, 45),
    body: compactAiText(bodyParts.join(" / "), 100),
  };
}

async function logNotificationRecord(
  stats: AnnouncementStats[],
  context: DailyNotificationContext,
) {
  const db = await initializeScriptFirestore();
  const recordId = createHash("sha256").update(context.dedupeKey).digest("hex");

  await db.collection("notifications_scheduled").doc(recordId).set({
    type: "daily-summary",
    dedupeKey: context.dedupeKey,
    koreaDate: context.koreaDate,
    targetDate: context.targetDate,
    timestamp: admin.firestore.Timestamp.now(),
    stats: {
      academic: stats.find((s) => s.category === "academic")?.count || 0,
      scholarship: stats.find((s) => s.category === "scholarship")?.count || 0,
    },
    executedBy: "github-actions",
    status: "success",
  });

  console.log("📝 Firestore에 기록 저장됨");
}

async function main() {
  console.log("🚀 Daily Announcement Notification Job 시작\n");

  try {
    const now = new Date();
    const targetWindow = createPreviousKoreaDayWindow(now);
    const context = createDailyNotificationContext(now, targetWindow);
    console.log(`중복 방지 키: ${context.dedupeKey}`);
    console.log(`공지 기준일: ${context.targetDate}`);

    // 1. 공지사항 통계 조회
    console.log("1️⃣ 공지사항 통계 조회 중...");
    const stats = await getAnnouncementStats(targetWindow);

    // 2. 알림 발송
    console.log("\n2️⃣ FCM 알림 발송 중...");
    await sendNotification(stats, context);

    // 3. 기록 저장
    console.log("\n3️⃣ 실행 기록 저장 중...");
    await logNotificationRecord(stats, context);

    console.log("\n✅ Job 완료!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Job 실패:", error);
    process.exit(1);
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
  const end = todayStart;

  return {
    dateKey: formatKoreaDate(start),
    start,
    end,
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

function readOptionalEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }

  return undefined;
}

main();
