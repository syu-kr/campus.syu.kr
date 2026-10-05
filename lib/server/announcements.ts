import type { Announcement, AnnouncementCategory } from "@/types";
import type { DailyCrawlDataFile } from "@/lib/crawl-data-contract";
import { attachAnnouncementAiSummaries } from "./announcement-ai";
import { readDailyCrawlDataSnapshot } from "./crawl-data";

export interface AnnouncementQuery {
  category?: AnnouncementCategory | "all";
  query?: string;
  page?: number;
  limit?: number;
}

export interface AnnouncementPage {
  items: Announcement[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  fallbackSources: { category: AnnouncementCategory; latestDate: string }[];
}

interface AnnouncementSource {
  items: Announcement[];
  categorySortedItems: Announcement[];
  fallback: boolean;
  latestDate: string;
}

const SOURCE_BY_CATEGORY: Record<
  AnnouncementCategory,
  DailyCrawlDataFile
> = {
  academic: "announcements-academic.json",
  campus: "announcements-campus-life.json",
  scholarship: "announcements-scholarship.json",
  sw: "announcements-sw.json",
};

const CATEGORY_ORDER: AnnouncementCategory[] = [
  "academic",
  "campus",
  "scholarship",
  "sw",
];
const ANNOUNCEMENT_CACHE_TTL_MS = 60 * 1000;
const announcementDates = new WeakMap<Announcement, number>();
let mergedAnnouncements: { sources: AnnouncementSource[]; items: Announcement[] } | undefined;
const announcementCache = new Map<
  AnnouncementCategory,
  {
    expiresAt: number;
    promise: Promise<AnnouncementSource>;
  }
>();

export async function getAnnouncementPage({
  category = "all",
  query = "",
  page = 1,
  limit = 10,
}: AnnouncementQuery): Promise<AnnouncementPage> {
  const normalizedPage = Math.max(1, Math.floor(page));
  const normalizedLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const normalizedQuery = query.trim().toLowerCase();
  const categories =
    category === "all" || !category ? CATEGORY_ORDER : [category];

  const sourceItems = await Promise.all(
    categories.map((sourceCategory) => readAnnouncements(sourceCategory)),
  );

  const ordered = orderedAnnouncements(sourceItems, category === "all");
  const filtered = normalizedQuery
    ? ordered.filter((announcement) => (
        announcement.title.toLowerCase().includes(normalizedQuery) ||
        announcement.author.toLowerCase().includes(normalizedQuery) ||
        announcement.content?.toLowerCase().includes(normalizedQuery)
      ))
    : ordered;

  const start = (normalizedPage - 1) * normalizedLimit;
  const items = await attachAnnouncementAiSummaries(
    filtered.slice(start, start + normalizedLimit),
  );

  return {
    items,
    total: filtered.length,
    page: normalizedPage,
    limit: normalizedLimit,
    totalPages: Math.max(1, Math.ceil(filtered.length / normalizedLimit)),
    fallbackSources: sourceItems.flatMap((source, index) =>
      source.fallback
        ? [{ category: categories[index], latestDate: source.latestDate }]
        : [],
    ),
  };
}

export async function getAnnouncementSummary(limit = 12) {
  const sourceItems = await Promise.all(
    CATEGORY_ORDER.map((sourceCategory) => readAnnouncements(sourceCategory)),
  );

  const items = await attachAnnouncementAiSummaries(
    orderedAnnouncements(sourceItems, true).slice(0, limit),
  );

  return items.map((item) => ({
    ...item,
    content: item.content ? item.content.slice(0, 240) : "",
  }));
}

export async function getAnnouncementById(
  category: AnnouncementCategory,
  id: string,
) {
  const { items } = await readAnnouncements(category);
  const announcement = items.find((item) => item.id === id);

  if (!announcement) return null;

  const [withAiSummary] = await attachAnnouncementAiSummaries([announcement]);
  return withAiSummary ?? announcement;
}

async function readAnnouncements(
  category: AnnouncementCategory,
): Promise<AnnouncementSource> {
  const now = Date.now();
  const cached = announcementCache.get(category);

  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = readAnnouncementsFromSource(category).catch((error) => {
    announcementCache.delete(category);
    throw error;
  });
  announcementCache.set(category, {
    expiresAt: now + ANNOUNCEMENT_CACHE_TTL_MS,
    promise,
  });

  return promise;
}

async function readAnnouncementsFromSource(
  category: AnnouncementCategory,
): Promise<AnnouncementSource> {
  const fileName = SOURCE_BY_CATEGORY[category];
  const snapshot = await readDailyCrawlDataSnapshot<Announcement[]>(fileName);
  const items = snapshot.data.map((item) => {
    const announcement = { ...item, category: item.category || category };
    announcementDates.set(announcement, parseAnnouncementDate(announcement.date));
    return announcement;
  });
  return {
    items,
    categorySortedItems: [...items].sort(sortAnnouncements),
    fallback: snapshot.source === "bundled-fallback",
    latestDate: snapshot.data.reduce(
      (latest, item) => (item.date > latest ? item.date : latest),
      "",
    ),
  };
}

function orderedAnnouncements(sources: AnnouncementSource[], all: boolean) {
  if (!all) return sources[0].categorySortedItems;
  const previousSources = mergedAnnouncements?.sources;
  if (!previousSources || sources.some((source, index) => source !== previousSources[index])) {
    mergedAnnouncements = { sources, items: sources.flatMap((source) => source.items).sort(sortAnnouncementsByDate) };
  }
  return mergedAnnouncements!.items;
}

function sortAnnouncements(a: Announcement, b: Announcement) {
  if (a.isPinned && !b.isPinned) return -1;
  if (!a.isPinned && b.isPinned) return 1;
  if (a.isImportant && !b.isImportant) return -1;
  if (!a.isImportant && b.isImportant) return 1;
  return sortAnnouncementsByDate(a, b);
}

function sortAnnouncementsByDate(a: Announcement, b: Announcement) {
  return announcementDates.get(b)! - announcementDates.get(a)!;
}

function parseAnnouncementDate(date: string) {
  const normalizedDate = date.replace(/\./g, "-");
  const parsed = new Date(normalizedDate).getTime();

  return Number.isNaN(parsed) ? 0 : parsed;
}
