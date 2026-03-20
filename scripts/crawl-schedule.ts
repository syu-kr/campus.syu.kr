/**
 * 학사주요일정 크롤링 스크립트 (증분 크롤링)
 * 월 1회 실행됨
 * 기존 데이터는 유지하고 중복되지 않는 새 일정만 추가
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
  const newSchedules: Schedule[] = [];
  const url = "https://www.syu.ac.kr/academic/major-schedule/";

  const dataPath = path.join(
    process.cwd(),
    "public",
    "data",
    "schedules-major.json",
  );

  // 기존 데이터 로드
  let existingSchedules: Schedule[] = [];
  const existingTitles = new Set<string>(); // 중복 검사용

  if (fs.existsSync(dataPath)) {
    try {
      const data = fs.readFileSync(dataPath, "utf-8");
      existingSchedules = JSON.parse(data);
      existingSchedules.forEach((s) => {
        existingTitles.add(`${s.title}|${s.startDate}|${s.endDate}`);
      });
      console.log(`📌 기존 일정 ${existingSchedules.length}개 로드`);
    } catch (error) {
      console.log("⚠️ 기존 데이터 로드 실패, 새로 시작합니다.");
    }
  }

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
              const uniqueKey = `${eventText}|${startDate}|${endDate}`;

              // 기존 데이터에 없으면 신규 추가
              if (!existingTitles.has(uniqueKey)) {
                newSchedules.push({
                  id: `schedule-${currentYear}-${dateText.replace(/\s|~/g, "-")}-${_liIdx}`,
                  title: eventText,
                  startDate: startDate,
                  endDate: endDate,
                  category: "event", // 학사일정 분류
                  description: eventText,
                });
              }
            }
          }
        });
      });
    });

    // 새 일정과 기존 일정 합치기 (새것이 앞에 옴)
    const allSchedules = [...newSchedules, ...existingSchedules];

    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(allSchedules, null, 2), "utf-8");

    console.log(
      `✅ 학사일정 ${newSchedules.length}개 신규 추가, 총 ${allSchedules.length}개 저장 완료`,
    );
    if (newSchedules.length > 0) {
      console.log(
        `📝 신규 일정 샘플: ${newSchedules[0].title} (${newSchedules[0].startDate})`,
      );
    }
  } catch (error) {
    console.error("❌ 학사일정 크롤링 실패:", error);
    // 기존 데이터 유지
    if (existingSchedules.length > 0) {
      fs.mkdirSync(path.dirname(dataPath), { recursive: true });
      fs.writeFileSync(
        dataPath,
        JSON.stringify(existingSchedules, null, 2),
        "utf-8",
      );
      console.log(
        `⚠️ 크롤링 실패, 기존 데이터 ${existingSchedules.length}개 유지`,
      );
    }
  }
}

crawlSchedule();
