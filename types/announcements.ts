export type AnnouncementCategory =
  | "academic"
  | "campus"
  | "scholarship";

export type HomeNoticeCategory = AnnouncementCategory | "service";

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
}

export interface ServiceNotice {
  id: string;
  slug: string;
  title: string;
  date: string;
  author: string;
  excerpt?: string;
}
