/**
 * 데이터 버전 관리 유틸
 * 각 데이터 소스의 업데이트 시간을 기반으로 캐시를 관리합니다.
 * 버전이 변경되면 React Query의 캐시가 자동으로 무효화됩니다.
 */

let cachedVersions: Record<string, number> | null = null;
let versionCacheTime = 0;
const VERSION_CACHE_DURATION = 60000; // 1분

export interface DataVersions {
  versions: Record<string, number>;
  timestamp: number;
}

/**
 * 데이터 버전 정보 조회 (캐시 적용)
 */
export async function getDataVersions(): Promise<DataVersions> {
  const now = Date.now();

  // 캐시된 버전이 유효한 경우
  if (
    cachedVersions &&
    versionCacheTime > 0 &&
    now - versionCacheTime < VERSION_CACHE_DURATION
  ) {
    return {
      versions: cachedVersions,
      timestamp: versionCacheTime,
    };
  }

  try {
    const response = await fetch("/api/version", {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });

    if (!response.ok) {
      return {
        versions: cachedVersions || {},
        timestamp: versionCacheTime,
      };
    }

    const data = await response.json();
    cachedVersions = data.versions;
    versionCacheTime = now;

    return data;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return {
      versions: cachedVersions || {},
      timestamp: versionCacheTime,
    };
  }
}

/**
 * React Query queryKey에 사용할 버전 문자열 생성
 * 파일 버전이 변경되면 새로운 키가 생성되어 캐시가 무효화됩니다.
 */
export async function getQueryKeyWithVersion(
  baseKey: (string | number)[],
): Promise<(string | number)[]> {
  try {
    const versionData = await getDataVersions();
    // 모든 파일의 버전을 합쳐서 해시 생성
    const versionHash = Object.values(versionData.versions)
      .join("-")
      .substring(0, 10);
    return [...baseKey, `v${versionHash}`];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return baseKey;
  }
}
