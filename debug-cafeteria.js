const axios = require("axios");
const cheerio = require("cheerio");

(async () => {
  try {
    console.log("🔍 웹사이트 분석 시작...\n");

    const response = await axios.get(
      "https://www.syu.ac.kr/school-life/facility-information/cafeteria/",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );

    const $ = cheerio.load(response.data);

    // 테이블 분석
    const tables = $("table");
    console.log(`총 테이블 개수: ${tables.length}`);

    if (tables.length === 0) {
      console.log("\n❌ 테이블이 없습니다.");
      console.log("div 클래스 확인:");
      $(".menu-table, .cafeteria, .food, .menu").each((i, el) => {
        console.log(`  - ${$(el).attr("class")}: ${i}`);
      });
    }

    tables.each((tableIdx, tableElement) => {
      const $table = $(tableElement);
      const tableClass = $table.attr("class") || "no-class";
      console.log(`\n📋 테이블 ${tableIdx + 1} (class="${tableClass}")`);

      const tbody = $table.find("tbody");
      const rows = $table.find("tbody tr");

      console.log(`  - tbody 있음: ${tbody.length > 0}`);
      console.log(`  - 행 개수: ${rows.length}`);

      if (rows.length > 0) {
        console.log(`\n  첫 3행 상세 분석:`);
        rows.slice(0, 3).each((rowIdx, trEl) => {
          const $row = $(trEl);
          const cells = $row.find("td");

          console.log(`\n  행 ${rowIdx + 1}: ${cells.length}개 셀`);

          cells.slice(0, Math.min(5, cells.length)).each((cellIdx, tdEl) => {
            const $cell = $(tdEl);
            const text = $cell.text().trim().substring(0, 60);
            const html = $cell.html().substring(0, 100);

            console.log(`    셀 ${cellIdx + 1}:`);
            console.log(`      텍스트: "${text}"`);
            console.log(`      HTML: "${html.replace(/\n/g, "").substring(0, 80)}"`);
          });
        });
      }
    });

    console.log("\n\n=== 다른 가능한 구조 확인 ===");
    console.log(`총 tr 개수: ${$("tr").length}`);
    console.log(`총 td 개수: ${$("td").length}`);

    // 날짜가 포함된 셀 찾기
    const dateCells = [];
    $("td, th").each((i, el) => {
      const text = $(el).text().trim();
      if (/\d{4}[-.\s]\d{2}[-.\s]\d{2}|\d{2}[-.\s]\d{2}|\(.\)/.test(text)) {
        dateCells.push({
          text: text.substring(0, 50),
          parent: $(el).parent().attr("class") || "tr",
        });
      }
    });

    console.log(`\n날짜 패턴 발견: ${dateCells.length}개`);
    dateCells.slice(0, 5).forEach((cell, i) => {
      console.log(`  ${i + 1}. "${cell.text}" (부모: ${cell.parent})`);
    });
  } catch (error) {
    console.error("❌ 에러:", error.message);
  }
})();
