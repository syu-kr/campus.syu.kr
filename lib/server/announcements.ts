import { readFile } from "fs/promises";
import path from "path";
import type { Announcement, AnnouncementCategory } from "@/types";

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
}

const SOURCE_BY_CATEGORY: Record<AnnouncementCategory, string> = {
  academic: "announcements-academic.json",
  campus: "announcements-campus-life.json",
  scholarship: "announcements-scholarship.json",
};

const CATEGORY_ORDER: AnnouncementCategory[] = [
  "academic",
  "campus",
  "scholarship",
];
const ANNOUNCEMENT_CACHE_TTL_MS = 60 * 1000;
const announcementCache = new Map<
  AnnouncementCategory,
  {
    expiresAt: number;
    promise: Promise<Announcement[]>;
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

  const filtered = sourceItems
    .flat()
    .filter((announcement) => {
      if (!normalizedQuery) return true;
      return (
        announcement.title.toLowerCase().includes(normalizedQuery) ||
        announcement.author.toLowerCase().includes(normalizedQuery) ||
        announcement.content?.toLowerCase().includes(normalizedQuery)
      );
    })
    .sort(category === "all" ? sortAnnouncementsByDate : sortAnnouncements);

  const start = (normalizedPage - 1) * normalizedLimit;
  const items = filtered.slice(start, start + normalizedLimit);

  return {
    items,
    total: filtered.length,
    page: normalizedPage,
    limit: normalizedLimit,
    totalPages: Math.max(1, Math.ceil(filtered.length / normalizedLimit)),
  };
}

export async function getAnnouncementSummary(limit = 12) {
  const sourceItems = await Promise.all(
    CATEGORY_ORDER.map((sourceCategory) => readAnnouncements(sourceCategory)),
  );

  return sourceItems
    .flat()
    .sort(sortAnnouncementsByDate)
    .slice(0, limit)
    .map((item) => ({
      ...item,
      content: item.content ? item.content.slice(0, 240) : "",
    }));
}

async function readAnnouncements(
  category: AnnouncementCategory,
): Promise<Announcement[]> {
  const now = Date.now();
  const cached = announcementCache.get(category);

  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = readAnnouncementsFromDisk(category).catch((error) => {
    announcementCache.delete(category);
    throw error;
  });
  announcementCache.set(category, {
    expiresAt: now + ANNOUNCEMENT_CACHE_TTL_MS,
    promise,
  });

  return promise;
}

async function readAnnouncementsFromDisk(
  category: AnnouncementCategory,
): Promise<Announcement[]> {
  const fileName = SOURCE_BY_CATEGORY[category];
  const filePath = path.join(process.cwd(), "public", "data", fileName);
  const content = await readFile(filePath, "utf8");
  const items = JSON.parse(content) as Announcement[];

  return items.map((item) => ({
    ...item,
    category: item.category || category,
  }));
}

function sortAnnouncements(a: Announcement, b: Announcement) {
  if (a.isPinned && !b.isPinned) return -1;
  if (!a.isPinned && b.isPinned) return 1;
  if (a.isImportant && !b.isImportant) return -1;
  if (!a.isImportant && b.isImportant) return 1;
  return sortAnnouncementsByDate(a, b);
}

function sortAnnouncementsByDate(a: Announcement, b: Announcement) {
  return parseAnnouncementDate(b.date) - parseAnnouncementDate(a.date);
}

function parseAnnouncementDate(date: string) {
  const normalizedDate = date.replace(/\./g, "-");
  const parsed = new Date(normalizedDate).getTime();

  return Number.isNaN(parsed) ? 0 : parsed;
}
