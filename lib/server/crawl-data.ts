import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { unstable_rethrow } from "next/navigation";
import {
  type CrawlDataManifest,
  type DailyCrawlDataFile,
  parseCrawlDataManifest,
} from "../crawl-data-contract";

const DEFAULT_CRAWL_DATA_BASE_URL =
  "https://syu-kr.github.io/campus.syu.kr/crawl-data";
const MANIFEST_CACHE_TTL_MS = 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_REMOTE_DATA_CACHE_ENTRIES = 24;

interface ManifestCacheEntry {
  expiresAt: number;
  promise: Promise<CrawlDataManifest>;
}

export interface CrawlDataSnapshot<T> {
  data: T;
  source: "github-pages" | "bundled-fallback";
  version: string;
  publishedAt?: string;
}

let manifestCache: ManifestCacheEntry | undefined;
let remoteWarningExpiresAt = 0;
const remoteDataCache = new Map<string, Promise<unknown>>();

export async function readDailyCrawlDataJson<T>(
  fileName: DailyCrawlDataFile,
): Promise<T> {
  const snapshot = await readDailyCrawlDataSnapshot<T>(fileName);
  return snapshot.data;
}

export async function readDailyCrawlDataSnapshot<T>(
  fileName: DailyCrawlDataFile,
): Promise<CrawlDataSnapshot<T>> {
  try {
    return await readRemoteSnapshot<T>(fileName);
  } catch (error) {
    unstable_rethrow(error);
    warnRemoteFallback(fileName, error);
    return readBundledSnapshot<T>(fileName);
  }
}

async function readRemoteSnapshot<T>(
  fileName: DailyCrawlDataFile,
): Promise<CrawlDataSnapshot<T>> {
  const baseUrl = getCrawlDataBaseUrl();
  const manifest = await getCurrentManifest(baseUrl);
  const cacheKey = `${baseUrl}/${manifest.version}/${fileName}`;
  let dataPromise = remoteDataCache.get(cacheKey);

  if (!dataPromise) {
    dataPromise = downloadAndParseJson(baseUrl, manifest, fileName);
    remoteDataCache.set(cacheKey, dataPromise);
    trimRemoteDataCache();
    dataPromise.catch(() => remoteDataCache.delete(cacheKey));
  }

  return {
    data: (await dataPromise) as T,
    source: "github-pages",
    version: manifest.version,
    publishedAt: manifest.publishedAt,
  };
}

async function getCurrentManifest(
  baseUrl: string,
): Promise<CrawlDataManifest> {
  const now = Date.now();
  if (manifestCache && manifestCache.expiresAt > now) {
    return manifestCache.promise;
  }

  const cacheWindow = Math.floor(now / MANIFEST_CACHE_TTL_MS);
  const promise = fetchText(`${baseUrl}/current.json?v=${cacheWindow}`)
    .then((content) => {
      if (Buffer.byteLength(content, "utf8") > MAX_MANIFEST_BYTES) {
        throw new Error("크롤링 데이터 manifest가 허용 크기를 초과했습니다.");
      }
      return parseCrawlDataManifest(JSON.parse(content) as unknown);
    });

  manifestCache = {
    expiresAt: now + MANIFEST_CACHE_TTL_MS,
    promise,
  };

  return promise;
}

async function downloadAndParseJson(
  baseUrl: string,
  manifest: CrawlDataManifest,
  fileName: DailyCrawlDataFile,
): Promise<unknown> {
  const entry = manifest.files[fileName];
  const payload = await fetchBuffer(`${baseUrl}/${entry.path}`);

  verifyPayload(fileName, payload, entry.sha256, entry.size);
  return JSON.parse(payload.toString("utf8")) as unknown;
}

function getCrawlDataBaseUrl(): string {
  const configured =
    process.env.CRAWL_DATA_BASE_URL ?? DEFAULT_CRAWL_DATA_BASE_URL;
  const url = new URL(configured);

  if (url.protocol !== "https:") {
    throw new Error("크롤링 데이터 URL은 HTTPS여야 합니다.");
  }

  return url.toString().replace(/\/+$/, "");
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`크롤링 데이터 응답 오류: ${response.status}`);
  }
  return response.text();
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    cache: "force-cache",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`크롤링 데이터 응답 오류: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function verifyPayload(
  fileName: DailyCrawlDataFile,
  payload: Buffer,
  expectedSha256: string,
  expectedSize: number,
) {
  if (payload.byteLength !== expectedSize) {
    throw new Error(`${fileName}의 크기가 manifest와 일치하지 않습니다.`);
  }

  const sha256 = createHash("sha256").update(payload).digest("hex");
  if (sha256 !== expectedSha256) {
    throw new Error(`${fileName}의 SHA-256 값이 manifest와 일치하지 않습니다.`);
  }
}

async function readBundledSnapshot<T>(
  fileName: DailyCrawlDataFile,
): Promise<CrawlDataSnapshot<T>> {
  const filePath = path.join(process.cwd(), "public", "data", fileName);
  const content = await readFile(filePath, "utf8");

  return {
    data: JSON.parse(content) as T,
    source: "bundled-fallback",
    version: "bundled",
  };
}

function warnRemoteFallback(fileName: DailyCrawlDataFile, error: unknown) {
  const now = Date.now();
  if (remoteWarningExpiresAt > now) return;
  remoteWarningExpiresAt = now + MANIFEST_CACHE_TTL_MS;
  console.warn(
    `[crawl-data] ${fileName} Pages 조회 실패, 번들 데이터로 대체합니다.`,
    error,
  );
}

function trimRemoteDataCache() {
  while (remoteDataCache.size > MAX_REMOTE_DATA_CACHE_ENTRIES) {
    const oldestKey = remoteDataCache.keys().next().value;
    if (typeof oldestKey !== "string") return;
    remoteDataCache.delete(oldestKey);
  }
}
