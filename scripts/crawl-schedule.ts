/**
 * 학사주요일정 크롤링 스크립트 (1년치 증분 크롤링)
 * 월 1회 실행됨
 * 기존 데이터는 유지하고 중복되지 않는 새 일정만 추가
 * https://www.syu.ac.kr/academic/major-schedule/?week_start=YYYYMMDD를 여러 주 순회
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

  const dataPath = path.join(
    process.cwd(),
    "public",
    "data",
    "schedules-major.json",
  );

  // 기존 데이터 로드
  let existingSchedules: Schedule[] = [];
  const existingKeys = new Set<string>();

  if (fs.existsSync(dataPath)) {
    try {
      const data = fs.readFileSync(dataPath, "utf-8");
      existingSchedules = JSON.parse(data);
      existingSchedules.forEach((s) => {
        existingKeys.add(`${s.title}|${s.startDate}|${s.endDate}`);
      });
      console.log(`📌 기존 일정 ${existingSchedules.length}개 로드`);
    } catch (error) {
      console.log("⚠️ 기존 데이터 로드 실패, 새로 시작합니다.");
    }
  }

  console.log("📅 학사주요일정 1년치 크롤링 시작...");

  try {
    // 2026년 1월부터 12월까지 월별로 크롤링
    for (let month = 1; month <= 12; month++) {
      // 각 월 첫 번째 날에서 크롤링 시작
      const year = 2026;
      const monthStr = String(month).padStart(2, "0");
      const dateStr = "01";
      const weekStartParam = `${year}${monthStr}${dateStr}`;

      const baseUrl = `https://www.syu.ac.kr/academic/major-schedule/?week_start=${weekStartParam}`;

      console.log(`  📍 ${year}-${monthStr} 크롤링 중...`);

      try {
        const response = await axios.get(baseUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          timeout: 10000,
        });

        const $ = cheerio.load(response.data);
        const calendarBoxes = $(".md_gray_textcalendar");

        calendarBoxes.each((_boxIdx, calendarBox) => {
          const $calendar = $(calendarBox);

          let currentYear = "";
          let currentMonth = "";

          $calendar.find("dl").each((_dlIdx, dlElement) => {
            const $dl = $(dlElement);

            const yearElem = $dl.find("dt .year").text().trim();
            const monthElem = $dl.find("dt .month").text().trim();

            if (yearElem) {
              currentYear = yearElem;
            }
            if (monthElem) {
              currentMonth = monthElem;
            }

            if (!currentYear || !currentMonth) {
              return;
            }

            $dl.find("ul li").each((_liIdx, liElement) => {
              const $li = $(liElement);
              const $itemDl = $li.find("dl");

              const dateText = $itemDl.find("dt").text().trim();
              const eventText = $itemDl.find("dd").text().trim();

              if (dateText && eventText) {
                let startDate = "";
                let endDate = "";

                if (dateText.includes("~")) {
                  const parts = dateText.split("~").map((p) => p.trim());
                  const startPart = parts[0];
                  const endPart = parts[1];

                  const startSplit = startPart.split(".");
                  if (startSplit.length === 2) {
                    startDate = `${currentYear}.${startSplit[0]}.${startSplit[1]}`;
                  }

                  const endSplit = endPart.split(".");
                  if (endSplit.length === 2) {
                    endDate = `${currentYear}.${endSplit[0]}.${endSplit[1]}`;
                  } else if (endSplit.length === 1) {
                    endDate = `${currentYear}.${currentMonth}.${endSplit[0]}`;
                  }
                } else {
                  const [m, d] = dateText.split(".");
                  startDate = `${currentYear}.${m}.${d}`;
                  endDate = startDate;
                }

                if (startDate && endDate) {
                  const uniqueKey = `${eventText}|${startDate}|${endDate}`;

                  if (!existingKeys.has(uniqueKey)) {
                    newSchedules.push({
                      id: `schedule-${currentYear}-${dateText.replace(/\s|~/g, "-")}-${_liIdx}`,
                      title: eventText,
                      startDate: startDate,
                      endDate: endDate,
                      category: "event",
                      description: eventText,
                    });
                  }
                }
              }
            });
          });
        });
      } catch (weekError) {
        console.log(
          `    ⚠️ ${year}-${monthStr} 실패: ${(weekError as Error).message}`,
        );
      }

      // 요청 사이에 딜레이
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // 새 일정과 기존 일정 합치기
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
