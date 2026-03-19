/**
 * 동아리 정보 크롤링 스크립트
 * 월 1회 실행됨
 * https://www.syu.ac.kr/school-life/circles/
 */

import axios from "axios";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

interface Circle {
  id: string;
  name: string;
  category: "general" | "startup" | "employment";
  description?: string;
  url: string;
}

async function crawlClubs() {
  const circles: Circle[] = [];
  const categories = [
    {
      name: "general",
      url: "https://www.syu.ac.kr/school-life/circles/general-club/",
    },
    {
      name: "startup",
      url: "https://www.syu.ac.kr/school-life/circles/founding-club/",
    },
    {
      name: "employment",
      url: "https://www.syu.ac.kr/school-life/circles/employment-club/",
    },
  ];

  console.log("🎭 동아리 정보 크롤링 시작...");

  try {
    for (const cat of categories) {
      console.log(`  ${cat.name} 동아리 크롤링 중...`);

      const response = await axios.get(cat.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      const $ = cheerio.load(response.data);

      // 동아리 목록 추출
      $(".circle-item, .club-info, li, .item").each((_index, element) => {
        const $elem = $(element);

        // 여러 선택자 시도
        let name =
          $elem.find("h3, .title, .name").text().trim() ||
          $elem.find("a").first().text().trim() ||
          $elem.text().trim();

        const url = $elem.find("a").attr("href") || "";

        if (name && name.length > 2 && name.length < 100) {
          name = name.replace(/\s+/g, " ").substring(0, 100);

          circles.push({
            id: `circle-${Date.now()}-${_index}`,
            name: name,
            category: cat.name as "general" | "startup" | "employment",
            url: url,
          });
        }
      });
    }

    const dataPath = path.join(process.cwd(), "public", "data", "clubs.json");

    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(circles, null, 2), "utf-8");

    console.log(`✅ 동아리 ${circles.length}개 저장 완료: ${dataPath}`);
  } catch (error) {
    console.error("❌ 동아리 크롤링 실패:", error);
    throw error;
  }
}

crawlClubs();
