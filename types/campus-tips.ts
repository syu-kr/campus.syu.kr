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

export interface CampusTip {
  id: string;
  title: string;
  description?: string;
  category: CampusTipCategory;
  sortPriority?: number;
  url: string;
  urlLabel?: string;
  tags: string[];
  sourceType: CampusTipSourceType;
  isExternal: true;
  note?: string;
}
