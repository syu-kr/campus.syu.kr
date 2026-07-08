import type { Announcement, AnnouncementCategory } from "./announcements";

export type CompetitionSourceCategory =
  | AnnouncementCategory
  | "event"
  | "department";

export type CompetitionSourceFilter = CompetitionSourceCategory | "all";

export type CompetitionStatus = "open" | "result" | "closed";

export type CompetitionStatusFilter = CompetitionStatus | "all";

export type CompetitionKind =
  | "contest"
  | "competition"
  | "hackathon"
  | "idea"
  | "capstone"
  | "presentation"
  | "program";

export interface CompetitionAnnouncement
  extends Omit<Announcement, "category"> {
  category: AnnouncementCategory;
  sourceCategory: CompetitionSourceCategory;
  competitionStatus: CompetitionStatus;
  competitionKind: CompetitionKind;
  matchedKeywords: string[];
  sourceName?: string;
  sourceUrl?: string;
}

export interface CompetitionPageResponse {
  items: CompetitionAnnouncement[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
