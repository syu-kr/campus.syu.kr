/**
 * 생활공지 크롤링 스크립트
 * 매일 00시에 실행됨
 * https://www.syu.ac.kr/university-square/notice/campus-notice/page/1 ~
 */

import axios from "axios";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

interface CampusNotice {
  id: string;
  title: string;
  date: string;
  author: string;
  views: number;
  category: "campus-life";
  content: string;
  url: string;
  isImportant: boolean;
}

async function crawlCampusNotices() {
  const notices: CampusNotice[] = [];
  const baseUrl =
    "https://www.syu.ac.kr/university-square/notice/campus-notice/page";

  console.log("🏫 생활공지 크롤링 시작...");

  try {
    // 첫 5페이지 크롤링 (테스트용)
    for (let page = 1; page <= 5; page++) {
      console.log(`  페이지 ${page} 크롤링 중...`);

      const response = await axios.get(`${baseUrl}/${page}/`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      const $ = cheerio.load(response.data);

      // 공지사항 목록 추출
      $("table tbody tr").each((index, element) => {
        const $row = $(element);

        const titleElem = $row.find("td:nth-child(2) a");
        const title = titleElem.text().trim();
        const url = titleElem.attr("href") || "";

        const dateText = $row.find("td:nth-child(3)").text().trim();
        const author = $row.find("td:nth-child(4)").text().trim();
        const views = parseInt($row.find("td:nth-child(5)").text().trim()) || 0;

        const isImportant =
          title.includes("[긴급]") || title.includes("[필독]");

        if (title) {
          notices.push({
            id: `campus-${Date.now()}-${index}`,
            title: title.replace(/\[긴급\]|\[필독\]/g, "").trim(),
            date: dateText,
            author: author || "학생지원팀",
            views: views,
            category: "campus-life",
            content: "",
            url: url,
            isImportant: isImportant,
          });
        }
      });
    }

    const dataPath = path.join(
      process.cwd(),
      "public",
      "data",
      "announcements-campus-life.json",
    );

    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(notices, null, 2), "utf-8");

    console.log(`✅ 생활공지 ${notices.length}개 저장 완료: ${dataPath}`);
  } catch (error) {
    console.error("❌ 생활공지 크롤링 실패:", error);
    throw error;
  }
}

crawlCampusNotices();
