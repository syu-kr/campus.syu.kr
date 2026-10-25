"use client";

import { useQuery } from "@tanstack/react-query";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import type {
  CrawlSourceHealth,
  DailyCrawlDataFile,
} from "@/lib/crawl-data-contract";
import { fetchJson } from "@/lib/fetch-json";

interface CrawlDataStatusResponse {
  sourceHealth: Partial<Record<DailyCrawlDataFile, CrawlSourceHealth>>;
}

export function CrawlDataStatus({ fileNames }: { fileNames: DailyCrawlDataFile[] }) {
  const text = useDictionary().crawlDataStatus;
  const locale = useLocale();
  const { data, isError } = useQuery({
    queryKey: ["crawl-data-status"],
    queryFn: () =>
      fetchJson<CrawlDataStatusResponse>("/api/crawl-data/status", {
        fallback: { sourceHealth: {} },
        throwOnError: true,
        timeoutMs: 12_000,
      }),
    staleTime: 60 * 1000,
  });
  const staleFiles = fileNames.filter(
    (fileName) => data?.sourceHealth?.[fileName]?.status === "stale",
  );
  const formatTime = (timestamp: string) =>
    new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Seoul",
      timeZoneName: "short",
    }).format(new Date(timestamp));

  if (!isError && staleFiles.length === 0) return null;

  return (
    <div role="status" aria-label={text.label} className="mb-4 text-xs leading-relaxed text-neutral-600">
      {staleFiles.length > 0 && (
        <ul className="space-y-1">
          {staleFiles.map((fileName) => {
            const health = data!.sourceHealth[fileName]!;
            const timestamp = health.lastSuccessAt && Number.isFinite(Date.parse(health.lastSuccessAt))
              ? health.lastSuccessAt : undefined;
            return (
              <li key={fileName}>
                {text.fileLabels[fileName]} · {timestamp ? <>
                  {text.asOf}{" "}<time dateTime={timestamp}>{formatTime(timestamp)}</time>
                  {" "}({text.retained})
                </> : text.unknownBasis}
              </li>
            );
          })}
        </ul>
      )}
      {isError && <p>{text.statusUnavailable}</p>}
    </div>
  );
}
