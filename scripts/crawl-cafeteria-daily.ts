/**
 * SU-Lounge 식단표 크롤링 스크립트 (매일 실행)
 * https://www.syu.ac.kr/school-life/facility-information/cafeteria/
 *
 * HTML 구조:
 * - .weekly-menu-table 테이블
 * - thead: 헤더 (날짜: 3월 16일(월), 3월 17일(화) 등)
 * - tbody:
 *   - 행 0: 중식 (각 날짜별 5셀)
 *   - 행 1: A코너 (6셀 - 구분 + 각 날짜별)
 *   - 행 2: B코너 (6셀 - 구분 + 각 날짜별)
 *   - 행 3: 석식 (5셀)
 */

import axios from "axios";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

interface MenuDay {
  date: string;
  day: string; // 월~일
  meals: {
    breakfast: string[];
    lunch: {
      a_corner: string[];
      b_corner: string[];
    };
    dinner: string[];
  };
}

interface CafeteriaMenu {
  id: string;
  name: string;
  weekStart: string;
  menus: MenuDay[];
  lastUpdated: string;
}

function parseKoreanDate(dateStr: string): { date: string; day: string } {
  // "3월 16일 (월)" 형식 파싱
  const match = dateStr.match(/(\d{1,2})월\s*(\d{1,2})일\s*\((.)\)/);
  if (match) {
    const [, month, day, dayOfWeek] = match;
    const today = new Date();
    const year = today.getFullYear();
    return {
      date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      day: dayOfWeek,
    };
  }
  return { date: new Date().toISOString().split("T")[0], day: "" };
}

function parseMenuItems(html: string): string[] {
  return html
    .split(/<br\s*\/?>/i)
    .map((item) => {
      const cleaned = item
        .trim()
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();
      return cleaned;
    })
    .filter((item) => item.length > 0);
}

async function crawlCafeteriaMenu() {
  const menus: MenuDay[] = [];
  const baseUrl =
    "https://www.syu.ac.kr/school-life/facility-information/cafeteria/";

  console.log("🍜 SU-Lounge 식단표 크롤링 시작...");

  try {
    const response = await axios.get(baseUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const $ = cheerio.load(response.data);

    // 주간 메뉴 테이블 찾기
    const table = $(".weekly-menu-table");
    if (table.length === 0) {
      console.log("⚠️ weekly-menu-table을 찾을 수 없습니다.");
      throw new Error("Table not found");
    }

    // 헤더에서 날짜 추출
    const headerCells = table.find("thead th");
    const dates: { date: string; day: string }[] = [];

    for (let i = 1; i < headerCells.length; i++) {
      // 첫 셀(구분)은 스킵
      const dateStr = $(headerCells[i]).text().trim();
      if (dateStr) {
        const parsed = parseKoreanDate(dateStr);
        dates.push(parsed);
      }
    }

    console.log(`📊 발견된 날짜: ${dates.length}개`);
    dates.forEach((d) => console.log(`   - ${d.date} (${d.day})`));

    // 테이블 body 행 처리
    const bodyRows = table.find("tbody tr");
    console.log(`📋 Body 행: ${bodyRows.length}개`);

    // 행 0: 중식 (각 날짜별)
    const lunchRow = bodyRows.eq(0);
    const lunchCells = lunchRow.find("td");

    // 행 1: A코너
    const aCornerRow = bodyRows.eq(1);
    const aCornerCells = aCornerRow.find("td").slice(1); // 첫 셀(구분) 제외

    // 행 2: B코너
    const bCornerRow = bodyRows.eq(2);
    const bCornerCells = bCornerRow.find("td").slice(1); // 첫 셀(구분) 제외

    // 행 3: 석식 (각 날짜별, 1~5번 셀)
    const dinnerRow = bodyRows.eq(3);
    const dinnerCells = dinnerRow.find("td");

    console.log(`\nA코너 셀: ${aCornerCells.length}개`);
    console.log(`B코너 셀: ${bCornerCells.length}개`);

    // 각 날짜별로 메뉴 구성
    for (let dateIdx = 0; dateIdx < dates.length; dateIdx++) {
      const { date, day } = dates[dateIdx];
      const cellIdx = dateIdx + 1; // 헤더에서 1번부터 시작

      const meals = {
        breakfast: [] as string[], // 아침은 없음
        lunch: {
          a_corner: [] as string[],
          b_corner: [] as string[],
        },
        dinner: [] as string[],
      };

      // 중식
      const lunchCell = lunchCells.eq(cellIdx);
      if (lunchCell.length > 0) {
        // 중식은 A/B 코너 구분 전 통합 메뉴
        const lunchText = lunchCell.html() || "";
        const lunchItems = parseMenuItems(lunchText);
        // A/B 모두에 추가
        meals.lunch.a_corner = lunchItems.slice();
        meals.lunch.b_corner = lunchItems.slice();
      }

      // A코너 (재정의 - 있으면)
      const aCell = aCornerCells.eq(dateIdx);
      if (aCell.length > 0) {
        const aText = aCell.html() || "";
        meals.lunch.a_corner = parseMenuItems(aText);
      }

      // B코너 (재정의 - 있으면)
      const bCell = bCornerCells.eq(dateIdx);
      if (bCell.length > 0) {
        const bText = bCell.html() || "";
        meals.lunch.b_corner = parseMenuItems(bText);
      }

      // 석식
      const dinnerCell = dinnerCells.eq(cellIdx);
      if (dinnerCell.length > 0) {
        const dinnerText = dinnerCell.html() || "";
        meals.dinner = parseMenuItems(dinnerText);
      }

      // 유효한 메뉴가 있으면 추가
      if (
        meals.lunch.a_corner.length > 0 ||
        meals.lunch.b_corner.length > 0 ||
        meals.dinner.length > 0
      ) {
        menus.push({
          date,
          day,
          meals,
        });
        console.log(
          `   ✓ ${date} (${day}): 중${meals.lunch.a_corner.length} A${meals.lunch.a_corner.length} B${meals.lunch.b_corner.length} 석${meals.dinner.length}`,
        );
      }
    }

    // JSON 파일로 저장
    const dataPath = path.join(
      process.cwd(),
      "public",
      "data",
      "cafeteria-menu.json",
    );

    const weekStartDate =
      dates[0]?.date || new Date().toISOString().split("T")[0];

    const menuData: CafeteriaMenu = {
      id: "su-lounge-001",
      name: "SU-Lounge",
      weekStart: weekStartDate,
      menus: menus,
      lastUpdated: new Date().toISOString(),
    };

    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify([menuData], null, 2), "utf-8");

    if (menus.length > 0) {
      console.log(
        `\n✅ SU-Lounge 식단표 ${menus.length}일분 저장 완료: ${dataPath}`,
      );
    } else {
      console.log(`\n⚠️ 추출된 데이터가 없습니다.`);
    }
  } catch (error) {
    console.error("❌ SU-Lounge 식단표 크롤링 실패:", error);
    throw error;
  }
}

// 실행
crawlCafeteriaMenu();
