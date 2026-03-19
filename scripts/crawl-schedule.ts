/**
 * 학사주요일정 크롤링 스크립트
 * 월 1회 실행됨
 * https://www.syu.ac.kr/academic/major-schedule/
 *
 * HTML 구조분석:
 * - .md_gray_textcalendar 내부에 달별 일정이 있음
 * - 각 year/month는 dt 하위의 div로 구성
 * - 실제 일정은 각 li > dl > dd에 있음
 * - 예: <dt>03.01</dt> <dd>삼일절</dd>
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

    // 일정 추출 - .md_gray_textcalendar 내의 list 형식
    const calendarBoxes = $(".md_gray_textcalendar");
    console.log(`📊 캘린더 박스 찾음: ${calendarBoxes.length}개`);

    // 모든 dl을 순회하면서 year/month를 추적
    calendarBoxes.each((_boxIdx, calendarBox) => {
      const $calendar = $(calendarBox);

      // 모든 dl 선택자 순회 (연도와 월별로 구분된 구조)
      $calendar.find("dl").each((_dlIdx, dlElement) => {
        const $dl = $(dlElement);

        // dt에서 year와 month 추출 (구조: dt > div.year/month)
        const yearElem = $dl.find("dt .year").text().trim();
        const monthElem = $dl.find("dt .month").text().trim();

        let currentYear = yearElem;
        let currentMonth = monthElem;

        // year/month가 없으면 이전 값 사용 (같은 연도/월 그룹 계속 유지)
        if (!currentYear && !currentMonth) {
          return; // 이 이상한 경우는 스킵
        }

        // ul > li > dl 구조에서 개별 일정 추출
        $dl.find("ul li").each((_liIdx, liElement) => {
          const $li = $(liElement);
          const $itemDl = $li.find("dl");

          const dateText = $itemDl.find("dt").text().trim(); // "03.01" 또는 "03.03 ~ 03.09"
          const eventText = $itemDl.find("dd").text().trim(); // "삼일절"

          if (dateText && eventText && currentYear && currentMonth) {
            // 날짜 파싱: "03.01" 또는 "03.03 ~ 03.09"
            let startDate = "";
            let endDate = "";

            if (dateText.includes("~")) {
              // 범위 형식: "03.03 ~ 03.09" 또는 "03.16 ~ 04.20"
              const parts = dateText.split("~").map((p) => p.trim());
              const startPart = parts[0]; // "03.03"
              const endPart = parts[1]; // "03.09" 또는 "04.20"

              // startDate 파싱
              const startSplit = startPart.split(".");
              if (startSplit.length === 2) {
                startDate = `${currentYear}.${startSplit[0]}.${startSplit[1]}`;
              }

              // endDate 파싱
              const endSplit = endPart.split(".");
              if (endSplit.length === 2) {
                // 월이 달라진 경우 (예: "03.16 ~ 04.20")
                // 또는 같은 월 (예: "03.03 ~ 03.09")
                const endMonth = endSplit[0];
                const endDay = endSplit[1];
                endDate = `${currentYear}.${endMonth}.${endDay}`;
              } else if (endSplit.length === 1) {
                // 날짜만 있는 경우: "03.03 ~ 09" (같은 월의 9일)
                endDate = `${currentYear}.${currentMonth}.${endSplit[0]}`;
              }
            } else {
              // 단일 날짜: "03.01"
              const [month, day] = dateText.split(".");
              startDate = `${currentYear}.${month}.${day}`;
              endDate = startDate;
            }

            // 유효한 날짜만 저장
            if (startDate && endDate) {
              schedules.push({
                id: `schedule-${currentYear}-${dateText.replace(/\s|~/g, "-")}-${_liIdx}`,
                title: eventText,
                startDate: startDate,
                endDate: endDate,
                category: "event", // 학사일정 분류
                description: eventText,
              });
            }
          }
        });
      });
    });

    const dataPath = path.join(
      process.cwd(),
      "public",
      "data",
      "schedules-major.json",
    );

    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(schedules, null, 2), "utf-8");

    console.log(`✅ 학사일정 ${schedules.length}개 저장 완료: ${dataPath}`);
    if (schedules.length > 0) {
      console.log(
        `📝 샘플 일정: ${schedules[0].title} (${schedules[0].startDate})`,
      );
    }
  } catch (error) {
    console.error("❌ 학사일정 크롤링 실패:", error);
    // 빈 배열 저장
    const dataPath = path.join(
      process.cwd(),
      "public",
      "data",
      "schedules-major.json",
    );
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify([], null, 2), "utf-8");
    console.log(`⚠️ 빈 학사일정 저장: ${dataPath}`);
  }
}

crawlSchedule();
