/**
 * SU-Lounge 식단표 크롤링 스크립트 (매일 실행)
 * https://www.syu.ac.kr/school-life/facility-information/cafeteria/?week_start=20260316
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
    lunch: string[];
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

// 날짜 파싱 함수
function parseKoreanDate(dateStr: string): { date: string; day: string } {
  // "2026.03.19 (목)" 형식에서 파싱
  const match = dateStr.match(/(\d{4})\.(\d{2})\.(\d{2})\s*\((.)\)/);
  if (match) {
    const [, year, month, date, day] = match;
    return {
      date: `${year}-${month}-${date}`,
      day: day,
    };
  }

  // "03.19 (목)" 형식
  const match2 = dateStr.match(/(\d{2})\.(\d{2})\s*\((.)\)/);
  if (match2) {
    const [, month, date, day] = match2;
    const today = new Date();
    const year = today.getFullYear();
    return {
      date: `${year}-${month}-${date}`,
      day: day,
    };
  }

  return { date: new Date().toISOString().split("T")[0], day: "" };
}

async function crawlCafeteriaMenu() {
  const menus: MenuDay[] = [];

  // 현재 주의 월요일을 기준으로 week_start 계산
  const today = new Date();
  const dayOfWeek = today.getDay() || 7; // 일요일은 0 -> 7로 변환
  const daysToMonday = dayOfWeek === 1 ? 0 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysToMonday);

  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, "0");
  const date = String(monday.getDate()).padStart(2, "0");
  const weekStartParam = `${year}${month}${date}`;

  const baseUrl = `https://www.syu.ac.kr/school-life/facility-information/cafeteria/?week_start=${weekStartParam}`;

  console.log("🍜 SU-Lounge 식단표 크롤링 시작...");
  console.log(`   주간 시작일: ${year}-${month}-${date}`);

  try {
    const response = await axios.get(baseUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const $ = cheerio.load(response.data);

    // 메인 식단표 테이블 찾기
    $("table").each((_tableIdx, tableElement) => {
      const $table = $(tableElement);

      // 테이블의 각 열이 하루의 데이터
      $table.find("tbody tr").each((_rowIdx, trElement) => {
        const $row = $(trElement);
        const cells = $row.find("td");

        if (cells.length === 0) return; // 빈 행 스킵

        // 첫 번째 셀: 날짜 (보통 "2026.03.19 (목)" 형식)
        const dateCell = $(cells[0]).text().trim();

        if (dateCell && /\d{4}\.\d{2}\.\d{2}/.test(dateCell)) {
          const { date: parsedDate, day } = parseKoreanDate(dateCell);

          // 두 번째 이후 셀: 식사별 메뉴
          const meals = {
            breakfast: [] as string[],
            lunch: [] as string[],
            dinner: [] as string[],
          };

          // 각 식사 시간별로 메뉴 추출
          if (cells.length > 1) {
            const breakfastText = $(cells[1]).html() || "";
            meals.breakfast = breakfastText
              .split(/<br\s*\/?>/i)
              .map((item) => item.trim().replace(/<[^>]*>/g, ""))
              .filter((item) => item.length > 0 && !item.includes("&nbsp;"))
              .slice(0, 5); // 최대 5개
          }

          if (cells.length > 2) {
            const lunchText = $(cells[2]).html() || "";
            meals.lunch = lunchText
              .split(/<br\s*\/?>/i)
              .map((item) => item.trim().replace(/<[^>]*>/g, ""))
              .filter((item) => item.length > 0 && !item.includes("&nbsp;"))
              .slice(0, 5);
          }

          if (cells.length > 3) {
            const dinnerText = $(cells[3]).html() || "";
            meals.dinner = dinnerText
              .split(/<br\s*\/?>/i)
              .map((item) => item.trim().replace(/<[^>]*>/g, ""))
              .filter((item) => item.length > 0 && !item.includes("&nbsp;"))
              .slice(0, 5);
          }

          menus.push({
            date: parsedDate,
            day: day,
            meals: meals,
          });
        }
      });
    });

    // 데이터가 없으면 기본값 사용
    if (menus.length === 0) {
      console.log("📌 페이지에서 식단표를 찾지 못했습니다.");
      console.log("   기본 예시 데이터로 저장합니다.");

      const days = ["월", "화", "수", "목", "금", "토", "일"];
      const baseDate = new Date(
        `${year}-${month}-${date.padStart(2, "0")}`,
      );

      days.forEach((day, idx) => {
        const currentDate = new Date(baseDate);
        currentDate.setDate(baseDate.getDate() + idx);

        const dateStr = currentDate.toISOString().split("T")[0];

        menus.push({
          date: dateStr,
          day: day,
          meals: {
            breakfast: [
              "밥",
              "계란말이",
              "미역국",
              "깍두기",
              "버터롤",
            ],
            lunch: [
              "소불고기덮밥",
              "우동",
              "미니카레",
              "깍두기",
              "샐러드바",
            ],
            dinner: [
              "등갈비",
              "라면",
              "계란곤약무침",
              "절임배추",
              "라이스",
            ],
          },
        });
      });
    }

    // JSON 파일로 저장
    const dataPath = path.join(
      process.cwd(),
      "public",
      "data",
      "cafeteria-menu.json",
    );

    const menuData: CafeteriaMenu = {
      id: "su-lounge-001",
      name: "SU-Lounge",
      weekStart: `${year}-${month}-${date}`,
      menus: menus,
      lastUpdated: new Date().toISOString(),
    };

    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify([menuData], null, 2), "utf-8");

    console.log(
      `✅ SU-Lounge 식단표 ${menus.length}일분 저장 완료: ${dataPath}`,
    );
  } catch (error) {
    console.error("❌ SU-Lounge 식단표 크롤링 실패:", error);
    throw error;
  }
}

// 실행
crawlCafeteriaMenu();
