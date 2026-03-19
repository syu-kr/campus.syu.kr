/**
 * 스쿨버스 시간표 크롤링 스크립트
 * https://www.syu.ac.kr/school-life/school-bus/
 */

import axios from "axios";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

interface ShuttleBusSchedule {
  id: string;
  routeName: string;
  startLocation: string;
  endLocation: string;
  schedules: {
    weekday: string[];
    weekdayAlt?: string[]; // 금요일
    weekend: string[];
  };
  lastUpdated: string;
}

async function crawlShuttleBusSchedule() {
  const schedules: ShuttleBusSchedule[] = [];
  const baseUrl = "https://www.syu.ac.kr/school-life/school-bus/";

  console.log("🚌 스쿨버스 시간표 크롤링 시작...");

  try {
    const response = await axios.get(baseUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const $ = cheerio.load(response.data);

    let routeIndex = 0;

    // 모든 테이블 찾기
    const tables = $("table");
    console.log(`📊 총 ${tables.length}개의 테이블 발견`);

    // 테이블 쌍으로 처리 (월~목요일, 금요일)
    for (let i = 0; i < tables.length; i++) {
      const $table = $(tables[i]);
      
      // 테이블 앞의 제목 찾기 (예: "왕기중" 등)
      let headerTitle = $table.prev("h3, h4, strong, b, p").text().trim();
      if (!headerTitle) {
        headerTitle = $table.find("thead tr").first().find("td, th").eq(0).text().trim();
      }

      // 목적지 찾기 (예: "6호선 황정역(5번 출구), 산계")
      let routeTitle = "";
      const headerRow = $table.find("thead tr").first();
      if (headerRow.length > 0) {
        routeTitle = headerRow.text().trim();
      } else {
        routeTitle = $table.prev().text().trim();
      }

      // 첫 번째 tbody 행에서 목적지 추출
      const firstRow = $table.find("tbody tr").first();
      if (firstRow.length === 0) continue;

      const cells = firstRow.find("td");
      if (cells.length === 0) continue;

      const destination = $(cells[0]).text().trim() || routeTitle || headerTitle;

      // 시간 추출
      const times: string[] = [];
      $table.find("tbody tr").each((_idx, tr) => {
        $(tr)
          .find("td")
          .each((_cidx, td) => {
            const timeText = $(td).text().trim();
            if (/^\d{1,2}:\d{2}/.test(timeText)) {
              const time = timeText.substring(0, 5);
              if (!times.includes(time)) {
                times.push(time);
              }
            }
          });
      });

      if (times.length > 0) {
        times.sort();
        const isAltDay = $table.prev("b, p, h3, h4").text().includes("금");

        const routeName = headerTitle || `버스 ${i + 1}`;
        let existingRoute = schedules.find(
          (s) => s.routeName === routeName && s.endLocation === destination,
        );

        if (!existingRoute) {
          existingRoute = {
            id: `shuttle-${++routeIndex}`,
            routeName: routeName,
            startLocation: "캠퍼스",
            endLocation: destination,
            schedules: {
              weekday: [],
              weekend: [],
            },
            lastUpdated: new Date().toISOString().split("T")[0],
          };
          schedules.push(existingRoute);
        }

        if (isAltDay) {
          existingRoute.schedules.weekdayAlt = times;
        } else {
          if (existingRoute.schedules.weekday.length === 0) {
            existingRoute.schedules.weekday = times;
          } else {
            existingRoute.schedules.weekdayAlt = times;
          }
        }
      }
    }


    // 데이터가 너무 적으면 기본값으로 채우기
    if (schedules.length < 2) {
      console.log("📌 공개 페이지에서 충분한 데이터를 찾지 못했습니다.");
      console.log("   기본 예시 데이터로 저장합니다.");

      schedules.push(
        {
          id: "shuttle-001",
          routeName: "왕기중",
          startLocation: "캠퍼스",
          endLocation: "6호선 황정역(5번 출구), 산계",
          schedules: {
            weekday: [
              "08:10",
              "08:15",
              "08:20",
              "08:25",
              "08:30",
              "08:35",
              "08:40",
              "08:45",
              "08:50",
              "08:55",
              "09:00",
              "09:20",
              "09:40",
              "10:00",
              "10:20",
              "12:00",
              "12:25",
              "12:50",
              "13:15",
              "13:40",
              "14:05",
              "14:30",
              "15:00",
              "15:20",
              "15:40",
              "16:00",
              "16:20",
              "16:40",
              "17:00",
              "17:20",
              "17:40",
            ],
            weekdayAlt: [
              "08:10",
              "08:15",
              "08:20",
              "08:25",
              "08:30",
              "08:35",
              "08:40",
              "08:45",
              "08:50",
              "08:55",
              "09:00",
              "09:20",
              "09:40",
              "10:00",
              "10:20",
              "12:00",
              "12:25",
              "12:50",
              "13:15",
              "13:40",
              "14:05",
              "14:30",
              "15:00",
              "15:20",
              "15:40",
              "16:00",
              "16:20",
              "16:40",
              "17:00",
            ],
            weekend: ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"],
          },
          lastUpdated: new Date().toISOString().split("T")[0],
        },
      );
    }

    // JSON 파일로 저장
    const dataPath = path.join(
      process.cwd(),
      "public",
      "data",
      "shuttle-bus-schedule.json",
    );

    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(schedules, null, 2), "utf-8");

    console.log(
      `✅ 스쿨버스 시간표 ${schedules.length}개 노선 저장 완료: ${dataPath}`,
    );
  } catch (error) {
    console.error("❌ 스쿨버스 시간표 크롤링 실패:", error);
    throw error;
  }
}

// 실행
crawlShuttleBusSchedule();
