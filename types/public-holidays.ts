export interface PublicHolidaySnapshot {
  schemaVersion: 1;
  sourceUrl: string;
  lastSuccessAt: string | null;
  years: number[];
  holidays: { date: string; names: string[] }[];
  /** Runtime source health; never used as proof of a successful collection. */
  stale?: boolean;
}
