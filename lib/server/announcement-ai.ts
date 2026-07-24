import { createHash } from "crypto";
import type { Announcement, AnnouncementAiSummary } from "@/types";
import { readDailyCrawlDataJson } from "./crawl-data";

interface AnnouncementAiMetadataFile {
  version: number;
  generatedAt: string;
  items: Record<string, AnnouncementAiSummary>;
}

const METADATA_CACHE_TTL_MS = 60 * 1000;

let metadataCache:
  | {
      expiresAt: number;
      promise: Promise<AnnouncementAiMetadataFile | null>;
    }
  | undefined;

export async function attachAnnouncementAiSummaries(
  announcements: Announcement[],
): Promise<Announcement[]> {
  if (announcements.length === 0) return announcements;

  const metadata = await readAnnouncementAiMetadata();
  if (!metadata) return announcements;

  return announcements.map((announcement) => {
    const key = getAnnouncementAiMetadataKey(announcement);
    const aiSummary =
      metadata.items[key] ??
      metadata.items[getLegacyAnnouncementAiMetadataKey(announcement)];

    if (!aiSummary || !sourceHashMatches(aiSummary, announcement)) {
      return announcement;
    }

    return {
      ...announcement,
      aiSummary,
    };
  });
}

function getAnnouncementAiMetadataKey(announcement: Announcement) {
  const canonicalUrl = canonicalizeAnnouncementUrl(announcement.url);
  if (canonicalUrl) {
    return `${announcement.category}:url:${hashText(canonicalUrl)}`;
  }

  return `${announcement.category}:legacy:${hashText(
    [announcement.title, announcement.date, announcement.author].join("\n"),
  )}`;
}

function getLegacyAnnouncementAiMetadataKey(announcement: Announcement) {
  return `${announcement.category}:${announcement.id}`;
}

function sourceHashMatches(
  aiSummary: AnnouncementAiSummary,
  announcement: Announcement,
) {
  return (
    aiSummary.sourceHash === hashAnnouncementForAi(announcement) ||
    aiSummary.sourceHash === hashAnnouncementForAiLegacy(announcement)
  );
}

function hashAnnouncementForAi(announcement: Announcement) {
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

function hashAnnouncementForAiLegacy(announcement: Announcement) {
  return hashText(
    [
      announcement.category,
      announcement.id,
      announcement.title,
      announcement.date,
      announcement.author,
      announcement.content,
      announcement.url ?? "",
    ].join("\n"),
  );
}

function canonicalizeAnnouncementUrl(value: string | undefined) {
  if (!value) return "";

  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return value.split(/[?#]/, 1)[0].replace(/\/+$/, "");
  }
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

async function readAnnouncementAiMetadata() {
  const now = Date.now();

  if (metadataCache && metadataCache.expiresAt > now) {
    return metadataCache.promise;
  }

  const promise = readAnnouncementAiMetadataFromSource();
  metadataCache = {
    expiresAt: now + METADATA_CACHE_TTL_MS,
    promise,
  };

  return promise;
}

async function readAnnouncementAiMetadataFromSource() {
  try {
    const parsed =
      await readDailyCrawlDataJson<AnnouncementAiMetadataFile>(
        "announcement-ai-metadata.json",
      );

    if (!parsed || parsed.version !== 1 || !parsed.items) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("Failed to read announcement AI metadata:", error);
    return null;
  }
}
