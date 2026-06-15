// scripts/send-daily-notification.ts
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { admin, initializeScriptFirestore } from "./firebase-admin";

interface AnnouncementStats {
  category: string;
  count: number;
  titles: string[];
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
}

interface KoreaDayWindow {
  dateKey: string;
  start: Date;
  end: Date;
}

async function getAnnouncementStats(): Promise<AnnouncementStats[]> {
  const targetWindow = createPreviousKoreaDayWindow(new Date());

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

        const titles = snapshot.docs.map((doc) => doc.data().title);

        results.push({
          category,
          count: snapshot.size,
          titles: titles.slice(0, 3),
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
    return { category, count: 0, titles: [] };
  }

  try {
    const filepath = path.join(process.cwd(), "public/data", filename);

    if (!fs.existsSync(filepath)) {
      return { category, count: 0, titles: [] };
    }

    const rawData = fs.readFileSync(filepath, "utf-8");
    const announcements: AnnouncementData[] = JSON.parse(rawData);

    const filtered = announcements.filter((announcement) => {
      return (
        normalizeKoreaDateString(announcement.date) === targetWindow.dateKey
      );
    });

    const titles = filtered.map((a) => a.title);

    return {
      category,
      count: filtered.length,
      titles: titles.slice(0, 3), // 상위 3개만
    };
  } catch {
    return { category, count: 0, titles: [] };
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

  // 메시지 구성
  const titleParts: string[] = [];
  if (academicCount > 0) titleParts.push(`학사공지 ${academicCount}개`);
  if (scholarshipCount > 0) titleParts.push(`장학공지 ${scholarshipCount}개`);

  const title =
    titleParts.length > 0
      ? `🆕 오늘의 새로운 공지사항 | ${titleParts.join(", ")}`
      : "📌 오늘은 새로운 공지사항이 없습니다";

  const bodyParts: string[] = [];
  if (academicCount === 0 && scholarshipCount === 0) {
    bodyParts.push("새로운 공지사항을 확인하려면 앱을 확인해주세요!");
  } else {
    if (academicCount > 0 && academic) {
      bodyParts.push(`📚 학사: ${academic.titles[0] || "새 공지사항"}`);
    }
    if (scholarshipCount > 0 && scholarship) {
      bodyParts.push(`💰 장학: ${scholarship.titles[0] || "새 공지사항"}`);
    }
  }

  const body = bodyParts.join(" | ");

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
) {
  const db = await initializeScriptFirestore();
  const recordId = createHash("sha256").update(context.dedupeKey).digest("hex");

  await db.collection("notifications_scheduled").doc(recordId).set({
    type: "daily-summary",
    dedupeKey: context.dedupeKey,
    koreaDate: context.koreaDate,
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
    const context = createDailyNotificationContext();
    console.log(`중복 방지 키: ${context.dedupeKey}`);

    // 1. 공지사항 통계 조회
    console.log("1️⃣ 공지사항 통계 조회 중...");
    const stats = await getAnnouncementStats();

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

function createDailyNotificationContext(): DailyNotificationContext {
  const koreaDate = formatKoreaDate(new Date());
  return {
    koreaDate,
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

main();
