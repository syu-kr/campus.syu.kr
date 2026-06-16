import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appDir = path.join(root, "app");
const koreanPattern = /[가-힣]/;

const excludedPathParts = [
  `${path.sep}admin${path.sep}`,
  `${path.sep}api${path.sep}`,
  `${path.sep}campus${path.sep}map${path.sep}data${path.sep}`,
];

const fileWideAllowList = new Map([
  [
    normalizePath("app/privacy/page.tsx"),
    "Korean privacy policy is the authoritative legal original.",
  ],
  [
    normalizePath("app/terms/page.tsx"),
    "Korean terms are the authoritative legal original.",
  ],
]);

const blockAllowList = [
  {
    file: "app/more/privacy/page.tsx",
    start: /^const pushErrorKeys: Record</,
    end: /^};$/,
    reason: "Maps Korean notification errors from the push-notification helper to locale keys.",
  },
  {
    file: "app/more/meet/page.tsx",
    start: /^const meetErrorKeys: Record<string, keyof MeetErrors> = {$/,
    end: /^};$/,
    reason: "Maps Korean server validation errors to locale keys.",
  },
  {
    file: "app/more/meet/[roomId]/page.tsx",
    start: /^const meetRoomErrorKeys: Record<string, keyof MeetRoomErrors> = {$/,
    end: /^};$/,
    reason: "Maps Korean server validation errors to locale keys.",
  },
];

const lineAllowList = [
  {
    file: "app/components/AnnouncementListPage.tsx",
    pattern: /label\.startsWith\("개"\)/,
    reason: "Korean counter suffix spacing rule.",
  },
  {
    file: "app/academic/page.tsx",
    pattern: /"학사,학사일정,학사공지,졸업요건,시간표"/,
    reason: "Korean metadata keywords for the ko branch.",
  },
  {
    file: "app/campus/page.tsx",
    pattern: /"캠퍼스,동아리,식당,도서관,셔틀버스,캠퍼스 지도"/,
    reason: "Korean metadata keywords for the ko branch.",
  },
  {
    file: "app/academic/schedule/page.tsx",
    pattern: /currentMonth\.getFullYear\(\).*년.*월/,
    reason: "Korean month label in the ko branch.",
  },
  {
    file: "app/features/meet/availability-grid.tsx",
    pattern: /locale === "en".*"마감 시간 정보 없음"/,
    reason: "Korean fallback is only used for the ko locale.",
  },
  {
    file: "app/academic/graduation/page.tsx",
    pattern: /categoryCredits\["(교필|전필|전선)"\]/,
    reason: "Graduation category keys come from source data.",
  },
  {
    file: "app/academic/timetable/TimetableBuilderClient.tsx",
    pattern:
      /const DAYS|label: "(전공|교양|연계|교직|채플|일반|기타)"|types: \[.*"(전공필수|전공선택|교양필수|교양선택|연계필수|연계선택|교직필수|채플|일반선택)".*\]|normalizedYear.*년|^\s*(월|화|수|목|금|전공필수|전공선택|교양필수|교양선택|연계필수|연계선택|교직필수|채플|일반선택):|가-힣/,
    reason: "Timetable parser and category keys depend on Korean source data.",
  },
  {
    file: "app/features/shuttle/ShuttleMap.tsx",
    pattern: /[1-4]: "(화랑대역|석계역|별내역|구리)"/,
    reason: "Shuttle route names are source data.",
  },
  {
    file: "app/campus/bus-info/ShuttleSection.tsx",
    pattern:
      /formatRouteBoundLabel\("(화랑대|석계|별내|구리)"|[1-4]: "(화랑대역|석계역|별내역|구리)"|locale === "ko".*\$\{routeName\}행/,
    reason: "Shuttle route names are source data or ko-only formatting.",
  },
  {
    file: "app/campus/bus-info/PublicTransitSection.tsx",
    pattern: /arrival\.arrivalMsg1 === "정보 없음"|includes\("운행종료"\)/,
    reason: "Transit arrival status comes from the upstream Korean API.",
  },
  {
    file: "app/campus/library/page.tsx",
    pattern: /room\.schedule\["(월-목|금|일)"\]|"휴관"|1\/3|2\/3/,
    reason: "Library schedule keys and closed status come from source data.",
  },
  {
    file: "app/campus/map/components/FacilityPanel.tsx",
    pattern: /facility\.category === "(식당|카페|의료|도서관|체육|편의)"/,
    reason: "Map facility categories come from source data.",
  },
  {
    file: "app/features/cafeteria/CafeteriaMenuCards.tsx",
    pattern: /^\s*(월|화|수|목|금|토|일):/,
    reason: "Cafeteria weekday keys come from source data.",
  },
  {
    file: "app/more/meet/page.tsx",
    pattern: /요청이 많습니다.*초/,
    reason: "Parses a Korean server rate-limit error before localizing it.",
  },
  {
    file: "app/more/meet/page.tsx",
    pattern: /날짜 범위는 최대.*일까지 가능합니다/,
    reason: "Parses a Korean server date-range error before localizing it.",
  },
  {
    file: "app/more/meet/[roomId]/page.tsx",
    pattern: /요청이 많습니다.*초/,
    reason: "Parses a Korean server rate-limit error before localizing it.",
  },
];

const violations = [];

for (const filePath of walk(appDir)) {
  if (!filePath.endsWith(".tsx")) continue;
  if (excludedPathParts.some((part) => filePath.includes(part))) continue;

  const relativePath = normalizePath(path.relative(root, filePath));
  const fileWideReason = fileWideAllowList.get(relativePath);
  if (fileWideReason) continue;

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const blockAllowedLines = getAllowedBlockLineNumbers(relativePath, lines);

  lines.forEach((line, index) => {
    if (!koreanPattern.test(line)) return;
    if (isCommentOnlyLine(line)) return;
    if (blockAllowedLines.has(index)) return;
    if (isAllowedLine(relativePath, line)) return;

    violations.push({
      path: relativePath,
      line: index + 1,
      text: line.trim(),
    });
  });
}

if (violations.length > 0) {
  console.error("Korean UI strings found outside the i18n dictionary:");
  for (const violation of violations) {
    console.error(
      `- ${violation.path}:${violation.line} ${violation.text}`,
    );
  }
  console.error(
    "\nMove reusable UI copy to lib/i18n.ts, or document intentional source-data exceptions in scripts/check_i18n_strings.mjs.",
  );
  process.exit(1);
}

console.log("i18n string audit passed.");

function* walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      yield* walk(entryPath);
    } else {
      yield entryPath;
    }
  }
}

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function isCommentOnlyLine(line) {
  const trimmed = line.trim();
  const firstKoreanIndex = line.search(koreanPattern);
  const inlineCommentIndex = line.indexOf("//");

  if (inlineCommentIndex !== -1 && inlineCommentIndex < firstKoreanIndex) {
    return true;
  }

  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("{/*")
  );
}

function isAllowedLine(relativePath, line) {
  return lineAllowList.some(
    (entry) =>
      normalizePath(entry.file) === relativePath && entry.pattern.test(line),
  );
}

function getAllowedBlockLineNumbers(relativePath, lines) {
  const allowedLines = new Set();

  for (const entry of blockAllowList) {
    if (normalizePath(entry.file) !== relativePath) continue;

    let isInsideBlock = false;
    lines.forEach((line, index) => {
      if (!isInsideBlock && entry.start.test(line)) {
        isInsideBlock = true;
      }

      if (!isInsideBlock) return;

      allowedLines.add(index);
      if (entry.end.test(line)) {
        isInsideBlock = false;
      }
    });
  }

  return allowedLines;
}
