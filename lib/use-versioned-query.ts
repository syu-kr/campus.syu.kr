/**
 * 버전 기반 캐싱을 지원하는 useQuery Custom Hook
 * 데이터 버전이 변경되면 자동으로 캐시가 무효화되고 새로운 데이터를 로드합니다.
 */

import {
  useQuery,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { getDataVersions } from "./cache-version";

interface UseVersionedQueryOptions<TData, TError> extends Omit<
  UseQueryOptions<TData, TError>,
  "queryKey" | "queryFn"
> {
  queryKey: (string | number)[];
  queryFn: () => Promise<TData>;
  // 버전 변경 시 자동 refetch 활성화
  autoRefetchOnVersionChange?: boolean;
}

export function useVersionedQuery<TData, TError = Error>(
  options: UseVersionedQueryOptions<TData, TError>,
): UseQueryResult<TData, TError> {
  const [versionHash, setVersionHash] = useState<string | null>(null);
  const initialVersionRef = useRef<string | null>(null);

  // 컴포넌트 마운트 시 버전 초기화
  useEffect(() => {
    async function initializeVersion() {
      try {
        const versionData = await getDataVersions();
        const hash = Object.values(versionData.versions)
          .join("-")
          .substring(0, 10);

        // 처음 초기화
        if (!initialVersionRef.current) {
          initialVersionRef.current = hash;
          setVersionHash(hash);
        }
      } catch {
        // Version initialization failed silently
      }
    }

    initializeVersion();

    // 30초마다 버전 변경 확인
    const interval = setInterval(async () => {
      if (!options.autoRefetchOnVersionChange) return;

      try {
        const versionData = await getDataVersions();
        const hash = Object.values(versionData.versions)
          .join("-")
          .substring(0, 10);

        // 버전이 변경되었으면 refetch 트리거
        if (initialVersionRef.current && hash !== initialVersionRef.current) {
          initialVersionRef.current = hash;
          setVersionHash(hash); // queryKey가 변경되어 자동으로 refetch
        }
      } catch {
        // Version check failed silently
      }
    }, 30000); // 30초마다 확인

    return () => clearInterval(interval);
  }, [options.autoRefetchOnVersionChange]);

  // queryKey에 버전 해시 포함
  const queryKey = versionHash
    ? [...options.queryKey, versionHash]
    : options.queryKey;

  const query = useQuery<TData, TError>({
    ...options,
    queryKey,
  });

  return query;
}
