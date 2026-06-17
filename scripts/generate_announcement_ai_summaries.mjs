import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

loadLocalEnvFiles();

const DATA_DIR = path.join(process.cwd(), "public", "data");
const OUTPUT_FILE = path.join(DATA_DIR, "announcement-ai-metadata.json");
const API_BASE_URL =
  process.env.SUPILOT_ANNOUNCEMENT_API_BASE_URL ||
  process.env.SUPILOT_API_BASE_URL ||
  "https://supilot.syu.ac.kr/api";
const API_KEY =
  process.env.SUPILOT_ANNOUNCEMENT_API_KEY || process.env.SUPILOT_API_KEY || "";
const MODEL_NAME = "claude-sonnet-4-6";
const DEFAULT_LIMIT = 25;
const DEFAULT_DELAY_MS = 2200;
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_DETAIL_FETCH_TIMEOUT_MS = 12000;
const DEFAULT_CHECKPOINT_EVERY = 5;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_MS = 3000;

const SOURCES = [
  { category: "academic", file: "announcements-academic.json" },
  { category: "campus", file: "announcements-campus-life.json" },
  { category: "scholarship", file: "announcements-scholarship.json" },
];

async function main() {
  if (!API_KEY) {
    console.log(
      "SUPILOT_API_KEY is not configured. Skipping announcement AI summaries.",
    );
    return;
  }

  const limit = readNumberEnv("ANNOUNCEMENT_AI_LIMIT", DEFAULT_LIMIT);
  const delayMs = readNumberEnv("ANNOUNCEMENT_AI_DELAY_MS", DEFAULT_DELAY_MS);
  const timeoutMs = readNumberEnv("ANNOUNCEMENT_AI_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
  const detailFetchTimeoutMs = readNumberEnv(
    "ANNOUNCEMENT_DETAIL_FETCH_TIMEOUT_MS",
    DEFAULT_DETAIL_FETCH_TIMEOUT_MS,
  );
  const checkpointEvery = readNumberEnv(
    "ANNOUNCEMENT_AI_CHECKPOINT_EVERY",
    DEFAULT_CHECKPOINT_EVERY,
  );
  const maxRetries = readNumberEnv(
    "ANNOUNCEMENT_AI_MAX_RETRIES",
    DEFAULT_MAX_RETRIES,
  );
  const retryBaseMs = readNumberEnv(
    "ANNOUNCEMENT_AI_RETRY_BASE_MS",
    DEFAULT_RETRY_BASE_MS,
  );
  const force = process.env.ANNOUNCEMENT_AI_FORCE === "true";
  const shouldFetchDetails =
    process.env.ANNOUNCEMENT_DETAIL_FETCH_ENABLED !== "false";
  const shouldCheckDetailChanges =
    shouldFetchDetails &&
    process.env.ANNOUNCEMENT_DETAIL_CHANGE_CHECK_ENABLED !== "false";
  const detailChangeCheckLimit = readNumberEnv(
    "ANNOUNCEMENT_DETAIL_CHANGE_CHECK_LIMIT",
    limit,
  );
  const announcements = await readAnnouncements();
  const existing = await readExistingMetadata();
  const currentKeys = new Set(announcements.map(getMetadataKey));
  const nextItems = {};
  const preEnrichedByKey = new Map();

  for (const announcement of announcements) {
    const key = getMetadataKey(announcement);
    const sourceHash = hashAnnouncement(announcement);
    const existingItem = findExistingMetadataItem(existing.metadata, announcement);

    if (existingItem && sourceHashMatches(existingItem, announcement) && currentKeys.has(key)) {
      nextItems[key] = {
        ...existingItem,
        sourceHash,
      };
    }
  }

  const candidates = [];
  let detailChangeChecks = 0;

  for (const announcement of announcements) {
    if (candidates.length >= limit) break;

    const key = getMetadataKey(announcement);
    const existingItem = nextItems[key];

    if (force || !existingItem || metadataNeedsRefresh(existingItem)) {
      candidates.push(announcement);
      continue;
    }

    if (
      shouldCheckDetailChanges &&
      existingItem.contentSource === "detail" &&
      detailChangeChecks < detailChangeCheckLimit
    ) {
      detailChangeChecks += 1;
      const enrichedAnnouncement = await enrichAnnouncementContent(announcement, {
        timeoutMs: detailFetchTimeoutMs,
      });

      if (enrichedAnnouncement.contentSource !== "detail") {
        continue;
      }

      if (existingItem.inputHash !== hashAnnouncementInput(enrichedAnnouncement)) {
        preEnrichedByKey.set(key, enrichedAnnouncement);
        candidates.push(announcement);
      }
    }
  }

  console.log(
    `Announcement AI summary candidates: ${candidates.length}/${announcements.length}`,
  );
  if (detailChangeChecks > 0) {
    console.log(`Checked ${detailChangeChecks} existing detail pages for changes.`);
  }

  let generatedCount = 0;
  for (const [index, announcement] of candidates.entries()) {
    const key = getMetadataKey(announcement);
    const sourceHash = hashAnnouncement(announcement);

    try {
      const enrichedAnnouncement =
        preEnrichedByKey.get(key) ||
        (shouldFetchDetails
          ? await enrichAnnouncementContent(announcement, {
              timeoutMs: detailFetchTimeoutMs,
            })
          : {
              ...announcement,
              contentSource: compactText(announcement.content)
                ? "json"
                : "metadata",
            });
      const summary = await summarizeAnnouncement(enrichedAnnouncement, {
        timeoutMs,
        maxRetries,
        retryBaseMs,
      });
      nextItems[key] = {
        ...summary,
        generatedAt: new Date().toISOString(),
        sourceHash,
        inputHash: hashAnnouncementInput(enrichedAnnouncement),
        model: MODEL_NAME,
        contentSource: enrichedAnnouncement.contentSource,
        ...(enrichedAnnouncement.detailContentHash
          ? { detailContentHash: enrichedAnnouncement.detailContentHash }
          : {}),
      };
      generatedCount += 1;
      console.log(
        `Generated AI summary ${index + 1}/${candidates.length}: ${key}`,
      );
      if (checkpointEvery > 0 && generatedCount % checkpointEvery === 0) {
        await writeMetadata(nextItems, {
          generatedCount,
          existingGeneratedAt: existing.metadata?.generatedAt,
        });
        console.log(`Checkpointed ${generatedCount} generated AI summaries.`);
      }
    } catch (error) {
      console.error(`Failed to generate AI summary for ${key}:`, error);
    }

    if (index < candidates.length - 1 && delayMs > 0) {
      await wait(delayMs);
    }
  }

  const didWrite = await writeMetadata(nextItems, {
    generatedCount,
    existingGeneratedAt: existing.metadata?.generatedAt,
    previousRaw: existing.raw,
  });

  if (!didWrite) {
    console.log("Announcement AI metadata is already up to date.");
    return;
  }
  console.log(`Wrote ${Object.keys(nextItems).length} AI summaries.`);
}

async function writeMetadata(
  items,
  { generatedCount, existingGeneratedAt, previousRaw = "" },
) {
  const output = {
    version: 1,
    generatedAt:
      generatedCount > 0
        ? new Date().toISOString()
        : existingGeneratedAt || new Date().toISOString(),
    items: sortObjectByKey(items),
  };
  const serialized = `${JSON.stringify(output, null, 2)}\n`;

  if (serialized === previousRaw) {
    return false;
  }

  const tempFile = `${OUTPUT_FILE}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempFile, serialized, "utf8");
  await rename(tempFile, OUTPUT_FILE);
  return true;
}

function loadLocalEnvFiles() {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(process.cwd(), fileName);
    if (!existsSync(filePath)) continue;

    const raw = readFileSync(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      if (!key || process.env[key] !== undefined) continue;

      process.env[key] = normalizeEnvValue(
        trimmed.slice(separatorIndex + 1).trim(),
      );
    }
  }
}

function normalizeEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).replace(/\\n/g, "\n");
  }

  return value;
}

async function readAnnouncements() {
  const groups = await Promise.all(
    SOURCES.map(async ({ category, file }) => {
      const raw = await readFile(path.join(DATA_DIR, file), "utf8");
      const items = JSON.parse(raw);

      return items.map((item) => ({
        id: String(item.id || ""),
        title: String(item.title || ""),
        content: String(item.content || ""),
        category: item.category || category,
        date: String(item.date || ""),
        author: String(item.author || ""),
        url: typeof item.url === "string" ? item.url : "",
        isImportant: Boolean(item.isImportant),
        isPinned: Boolean(item.isPinned),
      }));
    }),
  );

  return groups.flat().sort(compareAnnouncementPriority);
}

async function readExistingMetadata() {
  try {
    const raw = await readFile(OUTPUT_FILE, "utf8");
    return {
      raw,
      metadata: JSON.parse(raw),
    };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {
        raw: "",
        metadata: null,
      };
    }

    throw error;
  }
}

async function summarizeAnnouncement(
  announcement,
  { timeoutMs, maxRetries, retryBaseMs },
) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await requestAiSummary(announcement, { timeoutMs });
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries || !isRetryableAiError(error)) {
        throw error;
      }

      const waitMs = getRetryDelayMs(error, attempt, retryBaseMs);
      console.warn(
        `Retrying AI summary after ${waitMs}ms (${attempt + 1}/${maxRetries})`,
      );
      await wait(waitMs);
    }
  }

  throw lastError;
}

async function requestAiSummary(announcement, { timeoutMs }) {
  const response = await fetch(`${API_BASE_URL.replace(/\/$/, "")}/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      message: buildPrompt(announcement),
      stream: false,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(
      `AI API returned ${response.status}: ${body.slice(0, 300)}`,
    );
    error.status = response.status;
    error.retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
    throw error;
  }

  const data = await response.json();
  const content = typeof data.content === "string" ? data.content : "";
  return normalizeAiSummary(JSON.parse(extractJsonObject(content)));
}

function isRetryableAiError(error) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") {
    return true;
  }

  const status = Number(error?.status || 0);
  return status === 429 || status >= 500;
}

function getRetryDelayMs(error, attempt, retryBaseMs) {
  if (Number.isFinite(error?.retryAfterMs) && error.retryAfterMs > 0) {
    return error.retryAfterMs;
  }

  return retryBaseMs * 2 ** attempt;
}

function parseRetryAfterMs(value) {
  if (!value) return 0;

  const seconds = Number.parseFloat(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const dateMs = new Date(value).getTime();
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : 0;
}

async function enrichAnnouncementContent(announcement, { timeoutMs }) {
  const existingContent = compactText(announcement.content);
  if (existingContent.length >= 80) {
    return {
      ...announcement,
      content: existingContent,
      contentSource: "json",
    };
  }

  const detailContent = await fetchAnnouncementDetailContent(
    announcement.url,
    timeoutMs,
  );

  if (detailContent) {
    return {
      ...announcement,
      content: detailContent,
      contentSource: "detail",
      detailContentHash: hashText(detailContent),
    };
  }

  return {
    ...announcement,
    content: existingContent,
    contentSource: existingContent ? "json" : "metadata",
  };
}

async function fetchAnnouncementDetailContent(url, timeoutMs) {
  if (!canFetchDetailUrl(url)) return null;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      console.warn(`Detail fetch failed ${response.status}: ${url}`);
      return null;
    }

    const html = await response.text();
    const text = extractAnnouncementTextFromHtml(html);

    return text.length >= 80 ? text : null;
  } catch (error) {
    console.warn(`Detail fetch failed: ${url}`, error?.message || error);
    return null;
  }
}

function canFetchDetailUrl(value) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      (url.hostname === "syu.ac.kr" || url.hostname.endsWith(".syu.ac.kr"))
    );
  } catch {
    return false;
  }
}

function extractAnnouncementTextFromHtml(html) {
  const sections = [
    extractElementByAttributeKeyword(html, "single_cont"),
    extractElementByAttributeKeyword(html, "entry-content"),
    extractFirstElement(html, "article"),
    extractFirstElement(html, "main"),
    extractFirstElement(html, "body"),
  ].filter(Boolean);

  for (const section of sections) {
    const text = htmlToReadableText(section);
    if (text.length >= 80) return text.slice(0, 6000);
  }

  return "";
}

function extractElementByAttributeKeyword(html, keyword) {
  const pattern = new RegExp(
    `<([a-z][\\w:-]*)\\b[^>]*(?:class|id)=["'][^"']*\\b${escapeRegExp(
      keyword,
    )}\\b[^"']*["'][^>]*>`,
    "i",
  );
  const match = pattern.exec(html);
  if (!match) return "";

  return sliceBalancedElement(html, match.index, match[1]);
}

function extractFirstElement(html, tagName) {
  const pattern = new RegExp(`<${escapeRegExp(tagName)}\\b[^>]*>`, "i");
  const match = pattern.exec(html);
  if (!match) return "";

  return sliceBalancedElement(html, match.index, tagName);
}

function sliceBalancedElement(html, startIndex, tagName) {
  const tagPattern = new RegExp(`</?${escapeRegExp(tagName)}\\b[^>]*>`, "gi");
  tagPattern.lastIndex = startIndex;

  let depth = 0;
  let match;
  while ((match = tagPattern.exec(html))) {
    const token = match[0];
    const isClosing = token.startsWith("</");
    const isSelfClosing = token.endsWith("/>");

    if (isClosing) {
      depth -= 1;
      if (depth === 0) {
        return html.slice(startIndex, match.index + token.length);
      }
    } else if (!isSelfClosing) {
      depth += 1;
    }
  }

  return "";
}

function htmlToReadableText(html) {
  const withoutNoise = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<form\b[\s\S]*?<\/form>/gi, " ");
  const withBreaks = withoutNoise
    .replace(/<(br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|table|section|article)>/gi, "\n")
    .replace(/<\/(td|th)>/gi, " ");
  const text = decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " "));

  return text
    .split(/\r?\n/)
    .map((line) => compactText(line))
    .filter((line) => line && !isNoiseLine(line))
    .filter((line, index, lines) => index === 0 || line !== lines[index - 1])
    .join("\n");
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    );
}

function isNoiseLine(line) {
  return [
    "facebook",
    "twitter",
    "kakaotalk",
    "share",
    "복사",
    "목록",
    "이전글",
    "다음글",
  ].includes(line.toLowerCase());
}

function buildPrompt(announcement) {
  const content = compactText(announcement.content).slice(0, 3500);
  const fallbackNotice = content
    ? ""
    : "본문이 비어 있으면 제목, 작성부서, 날짜만 근거로 요약하고 confidence를 low로 두세요.";

  return `당신은 SYU CAMPUS 공지 요약 어시스턴트입니다.
아래 공지를 학생이 빠르게 판단할 수 있도록 요약하세요.

규칙:
- 반드시 제공된 공지 정보만 사용하세요.
- 추측하지 마세요. 명시되지 않은 값은 "unknown"으로 쓰세요.
- 한국어로 답하세요.
- summary는 120자 이내 한 문장으로 쓰세요.
- target, deadline, requiredAction은 각각 80자 이내로 쓰세요.
- keywords는 2~8개의 짧은 명사구로 쓰세요.
- importance는 "low", "normal", "high" 중 하나입니다.
- confidence는 "low", "medium", "high" 중 하나입니다.
- JSON 외의 문장, 마크다운, 코드블록을 출력하지 마세요.
${fallbackNotice}

출력 JSON:
{
  "summary": "학생용 핵심 요약",
  "target": "대상자 또는 unknown",
  "deadline": "신청/제출/확인 마감 또는 unknown",
  "requiredAction": "학생이 해야 할 일 또는 unknown",
  "keywords": ["키워드"],
  "importance": "low|normal|high",
  "confidence": "low|medium|high"
}

공지:
- category: ${announcement.category}
- title: ${announcement.title}
- date: ${announcement.date}
- author: ${announcement.author}
- url: ${announcement.url || "unknown"}
- isImportant: ${announcement.isImportant}
- isPinned: ${announcement.isPinned}
- content: ${content || "unknown"}`;
}

function normalizeAiSummary(input) {
  const summary = normalizeRequiredText(input.summary, 140, "summary");

  return {
    summary,
    target: normalizeOptionalText(input.target, 100),
    deadline: normalizeOptionalText(input.deadline, 100),
    requiredAction: normalizeOptionalText(input.requiredAction, 100),
    keywords: normalizeKeywords(input.keywords),
    importance: normalizeEnum(
      input.importance,
      ["low", "normal", "high"],
      "normal",
    ),
    confidence: normalizeEnum(
      input.confidence,
      ["low", "medium", "high"],
      "medium",
    ),
  };
}

function normalizeRequiredText(value, maxLength, field) {
  const text = normalizeOptionalText(value, maxLength);

  if (!text || text === "unknown") {
    throw new Error(`AI summary field is missing: ${field}`);
  }

  return text;
}

function normalizeOptionalText(value, maxLength) {
  if (typeof value !== "string") return "unknown";
  const text = compactText(value);
  if (!text) return "unknown";
  return text.slice(0, maxLength);
}

function normalizeKeywords(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => typeof item === "string")
    .map((item) => compactText(item).slice(0, 30))
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeEnum(value, allowed, fallback) {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

function extractJsonObject(content) {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new Error("AI response did not contain a JSON object.");
  }

  return withoutFence.slice(start, end + 1);
}

function getMetadataKey(announcement) {
  const canonicalUrl = canonicalizeAnnouncementUrl(announcement.url);
  if (canonicalUrl) {
    return `${announcement.category}:url:${hashText(canonicalUrl)}`;
  }

  return `${announcement.category}:legacy:${hashText(
    [announcement.title, announcement.date, announcement.author].join("\n"),
  )}`;
}

function getLegacyMetadataKey(announcement) {
  return `${announcement.category}:${announcement.id}`;
}

function findExistingMetadataItem(metadata, announcement) {
  if (!metadata?.items) return undefined;

  return (
    metadata.items[getMetadataKey(announcement)] ||
    metadata.items[getLegacyMetadataKey(announcement)]
  );
}

function sourceHashMatches(item, announcement) {
  return (
    item.sourceHash === hashAnnouncement(announcement) ||
    item.sourceHash === hashAnnouncementLegacy(announcement)
  );
}

function metadataNeedsRefresh(item) {
  if (!item.inputHash || !item.contentSource) return true;
  if (item.contentSource === "detail" && !item.detailContentHash) return true;
  return false;
}

function hashAnnouncement(announcement) {
  return hashText(
    [
      announcement.category,
      announcement.title,
      announcement.date,
      announcement.author,
      announcement.content,
      canonicalizeAnnouncementUrl(announcement.url) || announcement.url || "",
    ].join("\n"),
  );
}

function hashAnnouncementLegacy(announcement) {
  return hashText(
    [
      announcement.category,
      announcement.id,
      announcement.title,
      announcement.date,
      announcement.author,
      announcement.content,
      announcement.url || "",
    ].join("\n"),
  );
}

function hashAnnouncementInput(announcement) {
  return hashText(
    [
      announcement.category,
      announcement.title,
      announcement.date,
      announcement.author,
      canonicalizeAnnouncementUrl(announcement.url) || announcement.url || "",
      String(Boolean(announcement.isImportant)),
      String(Boolean(announcement.isPinned)),
      announcement.contentSource || "metadata",
      compactText(announcement.content),
    ].join("\n"),
  );
}

function canonicalizeAnnouncementUrl(value) {
  if (!value) return "";

  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return String(value).split(/[?#]/, 1)[0].replace(/\/+$/, "");
  }
}

function hashText(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function compareAnnouncementPriority(a, b) {
  if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
  if (a.isImportant !== b.isImportant) return a.isImportant ? -1 : 1;
  return parseAnnouncementDate(b.date) - parseAnnouncementDate(a.date);
}

function parseAnnouncementDate(date) {
  const parsed = new Date(String(date).replace(/\./g, "-")).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function compactText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sortObjectByKey(value) {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function readNumberEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
