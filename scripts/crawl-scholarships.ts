/**
 * 장학공지 크롤링 스크립트 (증분 크롤링)
 * 매일 00시에 실행됨
 * 기존 데이터는 유지하고 새로운 글만 추가
 * https://www.syu.ac.kr/academic/scholarship-information/scholarship-notice/page/1
 */

import axios from "axios";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

interface ScholarshipNotice {
  id: string;
  title: string;
  date: string;
  author: string;
  views: number;
  category: "scholarship";
  content: string;
  url: string;
  isImportant: boolean;
}

async function crawlScholarshipNotice() {
  const dataPath = path.join(
    process.cwd(),
    "public",
    "data",
    "announcements-scholarship.json",
  );

  // 기존 데이터 로드
  let existingNotices: ScholarshipNotice[] = [];
  let latestTitle = "";

  if (fs.existsSync(dataPath)) {
    try {
      const data = fs.readFileSync(dataPath, "utf-8");
      existingNotices = JSON.parse(data);
      if (existingNotices.length > 0) {
        latestTitle = existingNotices[0].title;
        console.log(`📌 최신 글: "${latestTitle}"`);
      }
    } catch (error) {
      console.log("⚠️ 기존 데이터 로드 실패, 새로 시작합니다.");
    }
  }

  const newNotices: ScholarshipNotice[] = [];
  const baseUrl =
    "https://www.syu.ac.kr/academic/scholarship-information/scholarship-notice/page";

  console.log("🎓 장학공지 크롤링 시작...");

  try {
    // 최신 글을 찾을 때까지 페이지 순회
    for (let page = 1; page <= 226; page++) {
      console.log(`  페이지 ${page} 크롤링 중...`);

      const response = await axios.get(`${baseUrl}/${page}/`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      const $ = cheerio.load(response.data);
      let foundLatest = false;

      // 공지사항 목록 추출
      $("table tbody tr").each((_index, element) => {
        if (foundLatest) return; // 최신 글 찾으면 이후는 스킵

        const $row = $(element);

        const titleElem = $row.find("td:nth-child(2) a");
        const title = titleElem.text().trim();
        let url = titleElem.attr("href") || "";
        // 상대 경로를 절대 경로로 변환
        if (url && !url.startsWith("http")) {
          url = "https://www.syu.ac.kr" + url;
        }

        const dateText = $row.find("td:nth-child(3)").text().trim();
        const author = $row.find("td:nth-child(4)").text().trim();
        const views = parseInt($row.find("td:nth-child(5)").text().trim()) || 0;

        const isImportant =
          title.includes("[공지]") || title.includes("[필독]");
        const cleanTitle = title.replace(/\[공지\]|\[필독\]/g, "").trim();

        // 최신 글과 같은 글을 찾았으면 중지
        if (cleanTitle === latestTitle) {
          console.log(`  ✓ 최신 글 "${latestTitle}" 발견, 크롤링 중지`);
          foundLatest = true;
          return;
        }

        if (title) {
          newNotices.push({
            id: `scholarship-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: cleanTitle,
            date: dateText,
            author: author || "장학팀",
            views: views,
            category: "scholarship",
            content: "",
            url: url,
            isImportant: isImportant,
          });
        }
      });

      if (foundLatest) break; // 최신 글 찾으면 페이지 순회 중지
    }

    // 새로운 글과 기존 글 합치기 (새 글이 앞에 옴)
    const allNotices = [...newNotices, ...existingNotices];

    // JSON 파일로 저장
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(allNotices, null, 2), "utf-8");

    console.log(
      `✅ 장학공지 ${newNotices.length}개 신규 추가, 총 ${allNotices.length}개 저장 완료`,
    );
  } catch (error) {
    console.error("❌ 장학공지 크롤링 실패:", error);
    throw error;
  }
}

crawlScholarshipNotice();
