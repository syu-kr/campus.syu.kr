export type AnnouncementCategory =
  | "academic"
  | "campus"
  | "scholarship";

export type HomeNoticeCategory = AnnouncementCategory | "service";

export interface AnnouncementAiSummary {
  summary: string;
  target: string;
  deadline: string;
  requiredAction: string;
  keywords: string[];
  importance: "low" | "normal" | "high";
  confidence: "low" | "medium" | "high";
  generatedAt: string;
  sourceHash: string;
  inputHash?: string;
  contentSource?: "detail" | "json" | "metadata";
  detailContentHash?: string;
  model?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  date: string;
  author: string;
  views: number;
  isImportant: boolean;
  isPinned?: boolean;
  url?: string;
  aiSummary?: AnnouncementAiSummary;
}

export interface ServiceNotice {
  id: string;
  slug: string;
  title: string;
  date: string;
  author: string;
  excerpt?: string;
}
