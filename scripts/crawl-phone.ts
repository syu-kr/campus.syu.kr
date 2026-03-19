/**
 * 업무별 전화번호 안내 크롤링 스크립트
 * 월 1회 실행됨
 * https://www.syu.ac.kr/about-sahmyook/phone-number-information/
 */

import axios from "axios";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

interface PhoneInfo {
  department: string;
  phone: string;
  description?: string;
}

async function crawlPhoneNumbers() {
  const phones: PhoneInfo[] = [];
  const url = "https://www.syu.ac.kr/about-sahmyook/phone-number-information/";

  console.log("📞 업무별 전화번호 크롤링 시작...");

  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const $ = cheerio.load(response.data);

    // 전화번호 정보 추출
    $(".phone-info, .contact-info").each((_index, element) => {
      const $elem = $(element);
      const department = $elem.find(".dept, .department").text().trim();
      const phone = $elem.find(".phone, .contact").text().trim();
      const description = $elem.find(".desc, .description").text().trim();

      if (department && phone) {
        phones.push({
          department,
          phone,
          description: description || undefined,
        });
      }
    });

    // 테이블 형식 대체
    if (phones.length === 0) {
      $("table tbody tr").each((_index, element) => {
        const $row = $(element);
        const cells = $row.find("td");

        if (cells.length >= 2) {
          const department = cells.eq(0).text().trim();
          const phone = cells.eq(1).text().trim();

          if (department && phone) {
            phones.push({
              department,
              phone,
            });
          }
        }
      });
    }

    const dataPath = path.join(
      process.cwd(),
      "public",
      "data",
      "phone-numbers.json"
    );

    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(phones, null, 2), "utf-8");

    console.log(`✅ 전화번호 ${phones.length}개 저장 완료: ${dataPath}`);
  } catch (error) {
    console.error("❌ 전화번호 크롤링 실패:", error);
    throw error;
  }
}

crawlPhoneNumbers();
