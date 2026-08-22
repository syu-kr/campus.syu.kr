import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { appendFile, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ANNOUNCEMENT_AI_DEFAULT_MODEL,
  ANNOUNCEMENT_AI_PROMPT_VERSION,
  ANNOUNCEMENT_AI_PROVIDER,
  ANNOUNCEMENT_AI_SCHEMA_VERSION,
  AnnouncementAiError,
  requestAnnouncementSummary,
} from "./announcement-openai.mjs";

loadLocalEnvFiles();

const DATA_DIR = path.join(process.cwd(), "public", "data");
const OUTPUT_FILE = path.join(DATA_DIR, "announcement-ai-metadata.json");
const API_KEY = process.env.OPENAI_API_KEY?.trim() || "";
const MODEL_NAME =
  process.env.OPENAI_ANNOUNCEMENT_MODEL?.trim() ||
  ANNOUNCEMENT_AI_DEFAULT_MODEL;
const DEFAULT_LIMIT = 25;
const DEFAULT_DELAY_MS = 2200;
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_DETAIL_FETCH_TIMEOUT_MS = 12000;
const DEFAULT_CHECKPOINT_EVERY = 5;
const DEFAULT_MAX_RETRIES = 3;
const GENERATION_FINGERPRINT = hashText(
  JSON.stringify({
    provider: ANNOUNCEMENT_AI_PROVIDER,
    model: MODEL_NAME,
    promptVersion: ANNOUNCEMENT_AI_PROMPT_VERSION,
    schemaVersion: ANNOUNCEMENT_AI_SCHEMA_VERSION,
  }),
);

const SOURCES = [
  { category: "academic", file: "announcements-academic.json" },
  { category: "campus", file: "announcements-campus-life.json" },
  { category: "scholarship", file: "announcements-scholarship.json" },
  { category: "campus", file: "announcements-events.json" },
  { category: "campus", file: "announcements-departments.json" },
];

async function main() {
  const limit = readLimitEnv("ANNOUNCEMENT_AI_LIMIT", DEFAULT_LIMIT);
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
  const enabled = process.env.ANNOUNCEMENT_AI_ENABLED !== "false";
  const refreshGeneration =
    process.env.ANNOUNCEMENT_AI_REFRESH_GENERATION === "true";
  const refreshSince = parseRefreshSince(
    process.env.ANNOUNCEMENT_AI_REFRESH_SINCE,
    refreshGeneration,
  );
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

    if (
      existingItem &&
      sourceHashMatches(existingItem, announcement) &&
      currentKeys.has(key)
    ) {
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

    if (!existingItem) {
      candidates.push(announcement);
      continue;
    }

    if (
      refreshGeneration &&
      isOnOrAfterRefreshSince(announcement.date, refreshSince) &&
      existingItem.generationFingerprint !== GENERATION_FINGERPRINT
    ) {
      candidates.push(announcement);
      continue;
    }

    if (!enabled || !API_KEY) continue;

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

  const report = {
    status: "healthy",
    candidates: candidates.length,
    succeeded: 0,
    failed: 0,
    preserved: Object.keys(nextItems).length,
    provider: ANNOUNCEMENT_AI_PROVIDER,
    model: MODEL_NAME,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
  };

  if (!enabled) {
    report.status = "no-op";
    await ensureMetadataArtifact(nextItems, existing);
    await writeAnnouncementAiSummary(report, "AI generation is disabled.");
    console.log("Announcement AI generation is disabled.");
    return;
  }

  if (!API_KEY) {
    report.status = "degraded";
    report.failed = candidates.length;
    await ensureMetadataArtifact(nextItems, existing);
    await writeAnnouncementAiSummary(report, "OPENAI_API_KEY is not configured.");
    console.warn("OPENAI_API_KEY is not configured. Existing summaries were preserved.");
    return;
  }

  let generatedCount = 0;
  for (const [index, announcement] of candidates.entries()) {
    const key = getMetadataKey(announcement);
    const sourceHash = hashAnnouncement(announcement);
    const requestStartedAt = Date.now();

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
      const result = await requestAnnouncementSummary({
        announcement: enrichedAnnouncement,
        apiKey: API_KEY,
        model: MODEL_NAME,
        timeoutMs,
        maxRetries,
      });
      nextItems[key] = {
        ...result.value,
        generatedAt: new Date().toISOString(),
        sourceHash,
        inputHash: hashAnnouncementInput(enrichedAnnouncement),
        provider: result.provider,
        model: result.model,
        promptVersion: result.promptVersion,
        schemaVersion: result.schemaVersion,
        generationFingerprint: GENERATION_FINGERPRINT,
        contentSource: enrichedAnnouncement.contentSource,
        ...(enrichedAnnouncement.detailContentHash
          ? { detailContentHash: enrichedAnnouncement.detailContentHash }
          : {}),
      };
      generatedCount += 1;
      report.succeeded += 1;
      addUsage(report.usage, result.usage);
      console.log(
        `Generated AI summary ${index + 1}/${candidates.length}.`,
      );
      if (checkpointEvery > 0 && generatedCount % checkpointEvery === 0) {
        await writeMetadata(nextItems, {
          generatedCount,
          existingGeneratedAt: existing.metadata?.generatedAt,
        });
        console.log(`Checkpointed ${generatedCount} generated AI summaries.`);
      }
    } catch (error) {
      report.failed += 1;
      logAnnouncementAiError(
        error,
        index + 1,
        candidates.length,
        Date.now() - requestStartedAt,
      );
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
  } else {
    console.log(`Wrote ${Object.keys(nextItems).length} AI summaries.`);
  }

  report.status =
    report.failed > 0
      ? "degraded"
      : report.candidates === 0
        ? "no-op"
        : "healthy";
  await writeAnnouncementAiSummary(report);
}

async function ensureMetadataArtifact(items, existing) {
  const didWrite = await writeMetadata(items, {
    generatedCount: 0,
    existingGeneratedAt: existing.metadata?.generatedAt,
    previousRaw: existing.raw,
  });

  if (didWrite) {
    console.log(`Wrote ${Object.keys(items).length} preserved AI summaries.`);
  }
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
        category: toAnnouncementCategory(item.category, category),
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

function toAnnouncementCategory(value, fallback) {
  return ["academic", "campus", "scholarship"].includes(value)
    ? value
    : fallback;
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
    .replace(stripElementContentPattern("script"), " ")
    .replace(stripElementContentPattern("style"), " ")
    .replace(stripElementContentPattern("noscript"), " ")
    .replace(stripElementContentPattern("svg"), " ")
    .replace(stripElementContentPattern("iframe"), " ")
    .replace(stripElementContentPattern("form"), " ");
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
  return value.replace(
    /&(nbsp|amp|lt|gt|quot|apos|#39|#160|#\d+|#x[0-9a-f]+);/gi,
    (entity) => decodeHtmlEntity(entity),
  );
}

function stripElementContentPattern(tagName) {
  return new RegExp(
    `<${escapeRegExp(tagName)}\\b[\\s\\S]*?<\\/${escapeRegExp(tagName)}\\s*>`,
    "gi",
  );
}

function decodeHtmlEntity(entity) {
  const normalized = entity.toLowerCase();

  switch (normalized) {
    case "&nbsp;":
    case "&#160;":
      return " ";
    case "&amp;":
      return "&";
    case "&lt;":
      return "<";
    case "&gt;":
      return ">";
    case "&quot;":
      return '"';
    case "&apos;":
    case "&#39;":
      return "'";
    default:
      return decodeNumericHtmlEntity(normalized) || entity;
  }
}

function decodeNumericHtmlEntity(entity) {
  const hexMatch = entity.match(/^&#x([0-9a-f]+);$/i);
  const decimalMatch = entity.match(/^&#(\d+);$/);
  const codePoint = hexMatch
    ? Number.parseInt(hexMatch[1], 16)
    : decimalMatch
      ? Number.parseInt(decimalMatch[1], 10)
      : NaN;

  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return "";
  }

  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return "";
  }
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
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;

  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function readLimitEnv(name, fallback) {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (["all", "unlimited", "none"].includes(raw)) return Number.POSITIVE_INFINITY;

  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function parseRefreshSince(value, refreshGeneration) {
  if (!refreshGeneration) return null;

  const normalized = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    console.warn(
      "ANNOUNCEMENT_AI_REFRESH_GENERATION requires ANNOUNCEMENT_AI_REFRESH_SINCE=YYYY-MM-DD. Refresh was disabled.",
    );
    return null;
  }

  return normalized;
}

function isOnOrAfterRefreshSince(value, refreshSince) {
  if (!refreshSince) return false;
  const announcementTime = parseAnnouncementDate(value);
  const sinceTime = parseAnnouncementDate(refreshSince);
  return announcementTime > 0 && sinceTime > 0 && announcementTime >= sinceTime;
}

function addUsage(target, usage) {
  target.inputTokens += Number(usage?.inputTokens || 0);
  target.outputTokens += Number(usage?.outputTokens || 0);
  target.totalTokens += Number(usage?.totalTokens || 0);
}

function logAnnouncementAiError(error, index, total, latencyMs) {
  const metadata =
    error instanceof AnnouncementAiError
      ? {
          kind: error.kind,
          status: error.status,
          code: error.code,
          requestId: error.requestId,
        }
      : { kind: "unknown", name: error?.name || "Error" };

  console.error("[Announcement AI] generation failed", {
    index,
    total,
    latencyMs,
    ...metadata,
  });
}

async function writeAnnouncementAiSummary(report, note = "") {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY?.trim();
  if (!summaryPath) return;

  const lines = [
    "### Announcement AI summaries",
    `- Status: ${report.status}`,
    `- Candidates: ${report.candidates}`,
    `- Succeeded: ${report.succeeded}`,
    `- Failed: ${report.failed}`,
    `- Preserved: ${report.preserved}`,
    `- Provider/model: ${report.provider}/${report.model}`,
    `- Token usage: input ${report.usage.inputTokens}, output ${report.usage.outputTokens}, total ${report.usage.totalTokens}`,
  ];
  if (note) lines.push(`- Note: ${note}`);
  await appendFile(summaryPath, `${lines.join("\n")}\n`, "utf8");
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

main().catch(async (error) => {
  console.error("[Announcement AI] fatal error", {
    name: error?.name || "Error",
    code: error?.code,
  });
  await writeAnnouncementAiSummary(
    {
      status: "degraded",
      candidates: 0,
      succeeded: 0,
      failed: 0,
      preserved: 0,
      provider: ANNOUNCEMENT_AI_PROVIDER,
      model: MODEL_NAME,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    },
    "The AI summary step failed before generation completed.",
  ).catch(() => undefined);
  process.exitCode = 1;
});
