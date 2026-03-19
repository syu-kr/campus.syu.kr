/**
 * 학사공지 크롤링 스크립트
 * 매일 00시에 실행됨
 * https://www.syu.ac.kr/academic/academic-notice/page/1 - /page/127
 */

import axios from "axios";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

interface Announcement {
  id: string;
  title: string;
  date: string;
  author: string;
  views: number;
  category: "academic";
  content: string;
  url: string;
  isImportant: boolean;
}

async function crawlAcademicNotice() {
  const announcements: Announcement[] = [];
  const baseUrl = "https://www.syu.ac.kr/academic/academic-notice/page";

  console.log("📚 학사공지 크롤링 시작...");

  try {
    // 첫 5페이지만 크롤링 (테스트용)
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

        // 필드 추출
        const titleElem = $row.find("td:nth-child(2) a");
        const title = titleElem.text().trim();
        const url = titleElem.attr("href") || "";

        const dateText = $row.find("td:nth-child(3)").text().trim();
        const author = $row.find("td:nth-child(4)").text().trim();
        const views = parseInt($row.find("td:nth-child(5)").text().trim()) || 0;

        // "[공지]" 또는 "[중요]" 텍스트 확인
        const isImportant =
          title.includes("[공지]") || title.includes("[중요]");

        if (title) {
          announcements.push({
            id: `academic-${Date.now()}-${index}`,
            title: title.replace(/\[공지\]|\[중요\]/g, "").trim(),
            date: dateText,
            author: author || "삼육대학교",
            views: views,
            category: "academic",
            content: "", // 상세 페이지 크롤링은 별도 처리
            url: url,
            isImportant: isImportant,
          });
        }
      });
    }

    // JSON 파일로 저장
    const dataPath = path.join(
      process.cwd(),
      "public",
      "data",
      "announcements-academic.json",
    );

    // 디렉토리 생성
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });

    fs.writeFileSync(dataPath, JSON.stringify(announcements, null, 2), "utf-8");

    console.log(`✅ 학사공지 ${announcements.length}개 저장 완료: ${dataPath}`);
  } catch (error) {
    console.error("❌ 학사공지 크롤링 실패:", error);
    throw error;
  }
}

// 실행
crawlAcademicNotice();
