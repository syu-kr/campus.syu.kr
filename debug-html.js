const axios = require("axios");
const cheerio = require("cheerio");

async function analyzeHTML() {
  try {
    const response = await axios.get(
      "https://www.syu.ac.kr/academic/major-schedule/",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      },
    );

    const $ = cheerio.load(response.data);

    // md_gray_textcalendar의 HTML을 직접 출력
    const calendar = $(".md_gray_textcalendar");
    const html = calendar.html();

    // 처음 5000자만 출력
    console.log("=== 캘린더 HTML (처음 5000자) ===\n");
    console.log(html.substring(0, 5000));

    console.log("\n\n=== 캘린더 HTML (5000~10000자) ===\n");
    console.log(html.substring(5000, 10000));
  } catch (error) {
    console.error("Error:", error.message);
  }
}

analyzeHTML();
