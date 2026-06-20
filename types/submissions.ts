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

export type AdminSubmissionAiCategory =
  | "bug"
  | "data-correction"
  | "feature-request"
  | "campus-tip"
  | "abuse-spam"
  | "privacy-security"
  | "other";

export type AdminSubmissionAiUrgency =
  | "low"
  | "normal"
  | "high"
  | "critical";

export type AdminSubmissionAiConfidence = "low" | "medium" | "high";

export interface AdminSubmissionAiClassification {
  category: AdminSubmissionAiCategory;
  urgency: AdminSubmissionAiUrgency;
  handlingHint: string;
  confidence: AdminSubmissionAiConfidence;
  generatedAt: string;
  sourceHash: string;
  model?: string;
}

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
  aiClassification?: AdminSubmissionAiClassification;
}

export interface AdminSubmissionPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminSubmissionPageResponse {
  submissions: AdminSubmissionItem[];
  counts: Record<SubmissionStatus, number>;
  pagination: AdminSubmissionPagination;
}

export class SubmissionValidationError extends Error {
  field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "SubmissionValidationError";
    this.field = field;
  }
}
