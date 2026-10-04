"use client";

import { useQuery } from "@tanstack/react-query";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { StateCard } from "@/app/components/StateCard";
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
    <div className="mb-4 space-y-3">
      {staleFiles.length > 0 && (
        <StateCard
          type="warning"
          title={text.staleTitle}
          message={text.staleMessage}
          action={
            <ul className="space-y-3 text-xs text-amber-900">
              {staleFiles.map((fileName) => {
                const health = data!.sourceHealth[fileName]!;
                return (
                  <li key={fileName}>
                    <p className="font-semibold">{text.fileLabels[fileName]}</p>
                    <p className="mt-1">
                      {health.lastSuccessAt ? (
                        <>
                          {text.lastSuccess}:{" "}
                          <time dateTime={health.lastSuccessAt}>
                            {formatTime(health.lastSuccessAt)}
                          </time>
                        </>
                      ) : text.unknownSuccess}
                    </p>
                    <p className="mt-1">
                      {text.lastAttempt}:{" "}
                      <time dateTime={health.lastAttemptAt}>
                        {formatTime(health.lastAttemptAt)}
                      </time>
                    </p>
                  </li>
                );
              })}
            </ul>
          }
        />
      )}
      {isError && <StateCard type="warning" message={text.statusUnavailable} />}
    </div>
  );
}
