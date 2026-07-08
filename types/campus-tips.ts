export type CampusTipCategory =
  | "school"
  | "campus-life"
  | "career"
  | "certificate"
  | "activity"
  | "culture"
  | "local"
  | "finance"
  | "reference";

export type CampusTipSourceType =
  | "official"
  | "public"
  | "community"
  | "external";

export type CampusTipContentKind =
  | "official-link"
  | "public-link"
  | "department-channel"
  | "study-review"
  | "external-directory"
  | "community-post"
  | "local-life";

export type CampusTipVisibility = "featured" | "default" | "archive";

export interface CampusTip {
  id: string;
  title: string;
  description?: string;
  category: CampusTipCategory;
  contentKind?: CampusTipContentKind;
  visibility?: CampusTipVisibility;
  sortPriority?: number;
  url: string;
  urlLabel?: string;
  tags: string[];
  sourceType: CampusTipSourceType;
  isExternal: true;
  note?: string;
  lastVerifiedAt?: string;
}
