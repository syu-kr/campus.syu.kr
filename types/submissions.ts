import type { CampusTipCategory } from "./campus-tips";

export type SubmissionStatus =
  | "pending"
  | "reviewing"
  | "accepted"
  | "rejected"
  | "done";

export type SiteInquiryType =
  | "bug"
  | "suggestion"
  | "data-correction"
  | "feature"
  | "other";

export interface CampusTipSuggestionInput {
  title: string;
  category: CampusTipCategory;
  description: string;
  url: string;
  tags: string[];
  note: string;
  contact: string;
}

export interface SiteInquiryInput {
  type: SiteInquiryType;
  title: string;
  message: string;
  pageUrl: string;
  contact: string;
}

export type AdminSubmissionKind = "inquiry" | "campus-tip";

export interface AdminSubmissionItem {
  id: string;
  kind: AdminSubmissionKind;
  status: SubmissionStatus;
  title: string;
  contact: string;
  createdAt: string | null;
  updatedAt: string | null;
  userAgent: string;
  type?: SiteInquiryType;
  message?: string;
  pageUrl?: string;
  category?: CampusTipCategory;
  description?: string;
  url?: string;
  tags?: string[];
  note?: string;
}

export class SubmissionValidationError extends Error {
  field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "SubmissionValidationError";
    this.field = field;
  }
}
