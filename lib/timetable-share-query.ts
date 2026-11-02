import { queryOptions } from "@tanstack/react-query";
import type { TimetableWorkspace } from "./timetable-workspace";

export interface TimetableShareResponse {
  success: boolean;
  data?: {
    shareId: string;
    courseIds: string[];
    year: string | null;
    semester: string | null;
    createdAt: string | null;
    workspace?: TimetableWorkspace;
  };
}

export class TimetableShareError extends Error {
  constructor(readonly status: number) {
    super("Could not load shared timetable");
  }
}

export function timetableShareQueryOptions(shareId: string) {
  return queryOptions({
    queryKey: ["lecture-timetable-share", shareId],
    queryFn: async (): Promise<TimetableShareResponse> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await fetch(
          `/api/lecture/timetable/shares/${encodeURIComponent(shareId)}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) throw new TimetableShareError(response.status);
        const result = (await response.json()) as TimetableShareResponse | null;
        if (!result?.success || !result.data) throw new TimetableShareError(502);
        return result;
      } finally {
        clearTimeout(timer);
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) =>
      failureCount < 1 &&
      !(error instanceof TimetableShareError && error.status < 500),
  });
}
