/**
 * 학사주요일정 크롤링 스크립트
 * 월 1회 실행됨
 * https://www.syu.ac.kr/academic/major-schedule/
 */

import axios from "axios";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

interface Schedule {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  category: string;
  description?: string;
}

async function crawlSchedule() {
  const schedules: Schedule[] = [];
  const url = "https://www.syu.ac.kr/academic/major-schedule/";

  console.log("📅 학사주요일정 크롤링 시작...");

  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const $ = cheerio.load(response.data);

    // 일정 추출
      $('table tbody tr').each((index, element) => {
      const $row = $(element);
      const cells = $row.find("td");

      if (cells.length >= 2) {
        const title = cells.eq(0).text().trim();
        const dateRange = cells.eq(1).text().trim();
        const category = cells.eq(2)?.text().trim() || "일반";

        // 날짜 파싱
        const dates = dateRange.split("~").map((d) => d.trim());
        const startDate = dates[0] || "";
        const endDate = dates[1] || dates[0] || "";

        if (title && startDate) {
          schedules.push({
            id: `schedule-${Date.now()}-${index}`,
            title,
            startDate,
            endDate,
            category,
          });
        }
      }
    });

    const dataPath = path.join(
      process.cwd(),
      "public",
      "data",
      "schedules-major.json"
    );

    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(schedules, null, 2), "utf-8");

    console.log(`✅ 학사일정 ${schedules.length}개 저장 완료: ${dataPath}`);
  } catch (error) {
    console.error("❌ 학사일정 크롤링 실패:", error);
    throw error;
  }
}

crawlSchedule();
