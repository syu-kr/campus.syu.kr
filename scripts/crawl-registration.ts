/**
 * 수강신청 안내 크롤링 스크립트
 * 일회성 실행 (매 학기마다 수동 실행)
 * https://www.syu.ac.kr/academic/academic-info/application-for-classes/
 */

import axios from "axios";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

interface RegistrationGuide {
  period: string;
  startDate: string;
  endDate: string;
  description: string;
  targetGrade?: string;
}

async function crawlRegistrationGuide() {
  const guides: RegistrationGuide[] = [];
  const url =
    "https://www.syu.ac.kr/academic/academic-info/application-for-classes/";

  console.log("📝 수강신청 안내 크롤링 시작...");

  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const $ = cheerio.load(response.data);

    // 수강신청 일정 추출
    $("table tbody tr").each((_index, element) => {
      const $row = $(element);
      const cells = $row.find("td");

      if (cells.length >= 2) {
        const period = cells.eq(0).text().trim();
        const dates = cells.eq(1).text().trim();
        const description = cells.eq(2)?.text().trim() || "";
        const targetGrade = cells.eq(3)?.text().trim();

        // 날짜 파싱
        const dateArr = dates.split("~").map((d) => d.trim());
        const startDate = dateArr[0] || "";
        const endDate = dateArr[1] || dateArr[0] || "";

        if (period && startDate) {
          guides.push({
            period,
            startDate,
            endDate,
            description,
            targetGrade: targetGrade || undefined,
          });
        }
      }
    });

    const dataPath = path.join(
      process.cwd(),
      "public",
      "data",
      "registration-guide.json",
    );

    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(guides, null, 2), "utf-8");

    console.log(`✅ 수강신청 안내 ${guides.length}개 저장 완료: ${dataPath}`);
  } catch (error) {
    console.error("❌ 수강신청 안내 크롤링 실패:", error);
    throw error;
  }
}

crawlRegistrationGuide();
