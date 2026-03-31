// scripts/send-daily-notification.ts
import * as admin from "firebase-admin";

interface AnnouncementStats {
  category: string;
  count: number;
  titles: string[];
}

async function initializeFirebase() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT 환경 변수가 필요합니다");
  }

  const serviceAccount = JSON.parse(serviceAccountJson);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }

  return admin.firestore();
}

async function getAnnouncementStats(): Promise<AnnouncementStats[]> {
  const db = await initializeFirebase();

  // 어제 자정 기준으로 새로운 공지사항 조회
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  yesterday.setHours(0, 0, 0, 0);

  const categories = ["academic", "scholarship"];
  const results: AnnouncementStats[] = [];

  console.log(
    `📊 조회 기간: ${yesterday.toISOString()} ~ ${today.toISOString()}`,
  );

  for (const category of categories) {
    try {
      const snapshot = await db
        .collection("announcements")
        .where("category", "==", category)
        .where(
          "created_at",
          ">=",
          admin.firestore.Timestamp.fromDate(yesterday),
        )
        .orderBy("created_at", "desc")
        .get();

      const titles = snapshot.docs.map((doc) => doc.data().title);

      results.push({
        category,
        count: snapshot.size,
        titles: titles.slice(0, 3), // 상위 3개만
      });

      console.log(`✅ ${category}: ${snapshot.size}개`);
    } catch (error) {
      console.error(`❌ ${category} 조회 실패:`, error);
      results.push({
        category,
        count: 0,
        titles: [],
      });
    }
  }

  return results;
}

async function sendNotification(stats: AnnouncementStats[]) {
  const apiUrl = process.env.API_URL || "http://localhost:3000";
  const apiKey = process.env.PUSH_API_KEY;

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

  console.log("\n📤 발송할 알림:");
  console.log(`   제목: ${title}`);
  console.log(`   내용: ${body}`);
  console.log(`   시간: ${koreaTime} KST\n`);

  // API 호출
  try {
    const response = await fetch(`${apiUrl}/api/notifications/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        title,
        body,
        category: "daily-summary",
        url: "/academic/announcements",
        timestamp: koreaTime,
        stats: {
          academic: academicCount,
          scholarship: scholarshipCount,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`API 응답: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log("✅ 알림 발송 성공:", result);
    return result;
  } catch (error) {
    console.error("❌ 알림 발송 실패:", error);
    throw error;
  }
}

async function logNotificationRecord(stats: AnnouncementStats[]) {
  const db = await initializeFirebase();

  await db.collection("notifications_scheduled").add({
    type: "daily-summary",
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
    // 1. 공지사항 통계 조회
    console.log("1️⃣ 공지사항 통계 조회 중...");
    const stats = await getAnnouncementStats();

    // 2. 알림 발송
    console.log("\n2️⃣ FCM 알림 발송 중...");
    await sendNotification(stats);

    // 3. 기록 저장
    console.log("\n3️⃣ 실행 기록 저장 중...");
    await logNotificationRecord(stats);

    console.log("\n✅ Job 완료!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Job 실패:", error);
    process.exit(1);
  }
}

main();
