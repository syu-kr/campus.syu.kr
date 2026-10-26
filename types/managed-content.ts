export type ManagedContentKind = "notice" | "banner";
export type ContentAction = "save" | "publish" | "unpublish" | "archive" | "restore";

interface PublicationWindow { startsAt: string | null; endsAt: string | null }
export interface ManagedNoticeDraft extends PublicationWindow {
  kind: "notice";
  slug: string;
  title: string;
  summary: string;
  content: string;
  english?: { title: string; summary: string; content: string };
}
export interface ManagedBannerDraft extends PublicationWindow {
  kind: "banner";
  category: "notice" | "event" | "ad";
  placement: "site-top" | "home";
  title: string;
  description: string;
  imageDesktop: string;
  imageMobile: string;
  imageAlt: string;
  link: string;
  priority: number;
  dismissible: boolean;
}
export type ManagedContentDraft = ManagedNoticeDraft | ManagedBannerDraft;
export interface NoticeOriginalMetadata {
  publicId: string;
  date: string;
  author: string;
  lang: "ko" | "en";
  sourceSha256: string;
  reviewedEnglishSourceSha256?: string;
  excerpt?: string;
  description?: string;
  english?: { excerpt: string; description: string };
}
export interface ManagedContentRecord {
  id: string;
  draft: ManagedContentDraft;
  published: ManagedContentDraft | null;
  publishedAt: string | null;
  publishedRevision?: number;
  publishedUpdatedAt?: string | null;
  revision: number;
  updatedAt: string;
  archived: boolean;
  source: "repository" | "database";
  noticeMetadata?: NoticeOriginalMetadata;
}
export interface ContentMutation {
  id: string;
  expectedRevision: number;
  action: ContentAction;
  draft?: ManagedContentDraft;
  englishReviewed?: boolean;
}
export interface AdminContentResponse { items: ManagedContentRecord[]; mediaAvailable: boolean }
export interface PublicBanner extends ManagedBannerDraft {
  id: string;
  revision: number;
}

type PublicPublicationIdentity = Pick<ManagedContentRecord, "id" | "archived" | "publishedAt"> & {
  kind: ManagedContentKind;
  publishedRevision: number;
  publishedUpdatedAt: string | null;
  noticeMetadata?: NoticeOriginalMetadata;
};
type PublicManagedNoticeMetadata = Omit<ManagedNoticeDraft, "content" | "english"> & {
  english?: Pick<NonNullable<ManagedNoticeDraft["english"]>, "title" | "summary">;
};
export type PublicManagedContentMetadata = PublicPublicationIdentity & { published: PublicManagedNoticeMetadata | ManagedBannerDraft | null };
export type PublicManagedPublication = PublicPublicationIdentity & { published: ManagedContentDraft | null };
