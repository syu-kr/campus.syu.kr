export type LiveDataSourceStatus = "fresh" | "stale" | "error";

export interface LiveDataMeta {
  source: string;
  timestamp: string;
  stale: boolean;
  sourceStatus: LiveDataSourceStatus;
}

export interface LiveDataResponse<T> extends LiveDataMeta {
  success: boolean;
  data: T;
  error?: string;
}
