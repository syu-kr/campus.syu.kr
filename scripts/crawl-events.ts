/**
 * 행사공지 크롤링 스크립트
 * 매일 00시에 실행됨
 * https://www.syu.ac.kr/university-square/notice/event/page/1 ~
 */

import axios from "axios";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

interface EventNotice {
  id: string;
  title: string;
  date: string;
  author: string;
  views: number;
  category: "event";
  content: string;
  url: string;
  isImportant: boolean;
}

async function crawlEventNotices() {
  const events: EventNotice[] = [];
  const baseUrl = "https://www.syu.ac.kr/university-square/notice/event/page";

  console.log("🎉 행사공지 크롤링 시작...");

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
          title.includes("[중요]") || title.includes("[공지]");

        if (title) {
          events.push({
            id: `event-${Date.now()}-${index}`,
            title: title.replace(/\[중요\]|\[공지\]/g, "").trim(),
            date: dateText,
            author: author || "행사팀",
            views: views,
            category: "event",
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
      "announcements-events.json",
    );

    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(events, null, 2), "utf-8");

    console.log(`✅ 행사공지 ${events.length}개 저장 완료: ${dataPath}`);
  } catch (error) {
    console.error("❌ 행사공지 크롤링 실패:", error);
    throw error;
  }
}

crawlEventNotices();
