export interface SearchResult {
  id: string;
  title: string;
  category: string;
  type: "announcement" | "page" | "menu" | "schedule";
  path?: string;
  highlight?: string;
}
