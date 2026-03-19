/**
 * 정적 데이터 일회성 크롤링 스크립트
 * 다음 항목들을 크롤링합니다:
 * - 등록금 관련 정보
 * - 장학금 정보
 * - 학생복지 시설 정보
 * - 증명서 정보
 * - 상담 정보
 */

import axios from "axios";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

interface StaticContent {
  title: string;
  content: string;
  url: string;
  lastUpdated: string;
}

const staticPages = [
  {
    name: "tuition-payment",
    url: "https://www.syu.ac.kr/academic/registration-information/payment-of-tuition/",
    description: "등록금 납부",
  },
  {
    name: "installment-payment",
    url: "https://www.syu.ac.kr/academic/registration-information/installment-payment/",
    description: "분할 납부",
  },
  {
    name: "returning-tuition",
    url: "https://www.syu.ac.kr/academic/registration-information/returning-tuition-delinquent/",
    description: "등록금 반환/체납",
  },
  {
    name: "scholarships-internal",
    url: "https://www.syu.ac.kr/academic/scholarship-information/scholarships/",
    description: "교내 장학금",
  },
  {
    name: "scholarships-external",
    url: "https://www.syu.ac.kr/academic/scholarship-information/suburban-scholarship-information/",
    description: "교외 장학금",
  },
  {
    name: "government-scholarship",
    url: "https://www.syu.ac.kr/academic/scholarship-information/government-scholarship/",
    description: "국가장학금",
  },
  {
    name: "health-center",
    url: "https://www.syu.ac.kr/school-life/guide-to-welfare/health-promotion-center/",
    description: "건강증진센터",
  },
  {
    name: "disability-support",
    url: "https://www.syu.ac.kr/school-life/guide-to-welfare/disability-student-support-center/",
    description: "장애학생지원센터",
  },
  {
    name: "facilities",
    url: "https://www.syu.ac.kr/school-life/guide-to-welfare/welfare-facilities-guide/",
    description: "컴퓨터자율실습실",
  },
  {
    name: "cafeteria-su",
    url: "https://www.syu.ac.kr/school-life/facility-information/cafeteria/",
    description: "SU Lounge",
  },
  {
    name: "dorm-cafeteria",
    url: "https://www.syu.ac.kr/school-life/facility-information/dorm-cafeteria/",
    description: "생활관 식당",
  },
  {
    name: "certificate",
    url: "https://www.syu.ac.kr/school-life/certificate/proof-of-report-card/",
    description: "증명서 발급",
  },
  {
    name: "counseling",
    url: "https://www.syu.ac.kr/school-life/life-counseling/",
    description: "전인상담",
  },
];

async function crawlStaticPages() {
  console.log("📄 정적 페이지 크롤링 시작...\n");

  const results: Record<string, StaticContent> = {};
  const dataPath = path.join(process.cwd(), "public", "data", "static-pages.json");

  for (const page of staticPages) {
    try {
      console.log(`  🔄 <${page.description}> 크롤링 중...`);

      const response = await axios.get(page.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      const $ = cheerio.load(response.data);

      // 메인 콘텐츠 추출
      const content = $(".content-area, .post-content, main, article")
        .text()
        .trim()
        .substring(0, 2000); // 처음 2000자로 제한

      results[page.name] = {
        title: page.description,
        content: content || "콘텐츠를 로드할 수 없습니다.",
        url: page.url,
        lastUpdated: new Date().toISOString(),
      };

      console.log(`  ✅ 완료`);
    } catch (error) {
      console.log(`  ⚠️  실패 - ${page.url}`);
      results[page.name] = {
        title: page.description,
        content: "크롤링 실패",
        url: page.url,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, JSON.stringify(results, null, 2), "utf-8");

  console.log(`\n✅ 정적 페이지 데이터 저장 완료: ${dataPath}`);
}

crawlStaticPages();
