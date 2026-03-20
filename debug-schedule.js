const axios = require("axios");
const cheerio = require("cheerio");

async function analyzeScheduleStructure() {
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

    console.log("=== 캘린더 박스 분석 ===");
    const calendarBoxes = $(".md_gray_textcalendar");
    console.log(`총 ${calendarBoxes.length}개 캘린더 박스\n`);

    calendarBoxes.each((boxIdx, box) => {
      const $box = $(box);
      const dls = $box.find("dl");
      console.log(`박스 ${boxIdx + 1}: ${dls.length}개 dl 요소\n`);

      dls.each((dlIdx, dl) => {
        const $dl = $(dl);
        const yearText = $dl.find("dt .year").text().trim();
        const monthText = $dl.find("dt .month").text().trim();
        const lis = $dl.find("ul li");

        console.log(
          `DL ${dlIdx}: year="${yearText}" month="${monthText}" 일정=${lis.length}`,
        );

        if (lis.length > 0) {
          lis.each((liIdx, li) => {
            const $li = $(li);
            const dateText = $li.find("dl dt").text().trim();
            const eventText = $li.find("dl dd").text().trim();
            if (dateText && eventText) {
              console.log(
                `  [${liIdx}] ${dateText}: ${eventText.substring(0, 40)}`,
              );
            }
          });
        }
      });
    });
  } catch (error) {
    console.error("Error:", error.message);
  }
}

analyzeScheduleStructure();
