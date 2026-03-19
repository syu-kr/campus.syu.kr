/**
 * 캠퍼스맵 크롤링 스크립트
 * 월 1회 실행됨
 * https://www.syu.ac.kr/about-sahmyook/college-guide/campusmap/
 */

import axios from "axios";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

interface CampusBuilding {
  building: string;
  location: string;
  description?: string;
}

async function crawlCampusMap() {
  const buildings: CampusBuilding[] = [];
  const url = "https://www.syu.ac.kr/about-sahmyook/college-guide/campusmap/";

  console.log("🗺️ 캠퍼스맵 크롤링 시작...");

  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const $ = cheerio.load(response.data);

    // 건물 정보 추출
    $("table tbody tr").each((_index, element) => {
      const $row = $(element);
      const cells = $row.find("td");

      if (cells.length >= 2) {
        const building = cells.eq(0).text().trim();
        const location = cells.eq(1).text().trim();
        const description = cells.eq(2)?.text().trim();

        if (building && location) {
          buildings.push({
            building,
            location,
            description: description || undefined,
          });
        }
      }
    });

    // 리스트 형식 대체
    if (buildings.length === 0) {
      $(".building-info, .campus-info").each((_index, element) => {
        const $elem = $(element);
        const building = $elem.find(".building-name").text().trim();
        const location = $elem.find(".building-location").text().trim();

        if (building && location) {
          buildings.push({
            building,
            location,
          });
        }
      });
    }

    const dataPath = path.join(
      process.cwd(),
      "public",
      "data",
      "campus-map.json",
    );

    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(buildings, null, 2), "utf-8");

    console.log(`✅ 캠퍼스 건물 ${buildings.length}개 저장 완료: ${dataPath}`);
  } catch (error) {
    console.error("❌ 캠퍼스맵 크롤링 실패:", error);
    throw error;
  }
}

crawlCampusMap();
