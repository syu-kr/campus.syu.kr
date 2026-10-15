import { setTimeout as delay } from "node:timers/promises";
import { PUBLIC_ROUTES } from "../lib/public-routes";

export const INDEXNOW_ORIGIN = "https://campus.syu.kr";
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const INDEXNOW_KEY_LOCATION = `${INDEXNOW_ORIGIN}/indexnow-key.txt`;

const publicPaths = new Set<string>(PUBLIC_ROUTES.map(({ route }) => route));
const RETRY_AFTER_MS = 10 * 60 * 1000;

type SubmitOptions = {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  beforeAttempt?: () => Promise<void>;
  onAccepted?: (urls: string[], status: 200 | 202) => Promise<void> | void;
};

export function assertIndexNowUrl(value: string) {
  const url = new URL(value);
  if (url.origin !== INDEXNOW_ORIGIN || url.href !== value || url.search ||
    url.hash || url.username || url.password || /%(?:2f|5c|25)/i.test(url.pathname)) {
    throw new Error(`IndexNow URL must be a canonical public URL: ${value}`);
  }

  const decodedPath = decodeURIComponent(url.pathname);
  const path = url.pathname === "/en" ? "/" : url.pathname.replace(/^\/en\//, "/");
  if (/[\\?#\s%]/.test(decodedPath) || (url.pathname.length > 1 && url.pathname.endsWith("/")) || (!publicPaths.has(path) &&
    !/^\/announcements\/(academic|scholarship|campus|sw)\/[^/]+$/.test(path) &&
    !/^\/service\/notices\/[^/]+$/.test(path))) {
    throw new Error(`IndexNow URL is outside the public route allowlist: ${value}`);
  }
}

function rateLimitDelay(response: Response, now: () => number) {
  const retryAfter = response.headers.get("Retry-After");
  const requestedDelay = retryAfter && /^\d+$/.test(retryAfter)
    ? Number(retryAfter) * 1000
    : retryAfter ? Date.parse(retryAfter) - now() : 0;
  const wait = Math.max(RETRY_AFTER_MS, Number.isNaN(requestedDelay) ? 0 : requestedDelay);
  if (wait > RETRY_AFTER_MS) {
    throw new Error("IndexNow rate limited; Retry-After exceeds the 10-minute inline retry limit. Retry later.");
  }
  return wait;
}

export async function submitIndexNow(
  urls: string[],
  key: string,
  { fetchImpl = fetch, sleep = delay, now = Date.now, beforeAttempt, onAccepted }: SubmitOptions = {},
): Promise<{ accepted: number; pendingValidation: number; attempts: number }> {
  if (!/^[a-fA-F0-9-]{8,128}$/.test(key)) {
    throw new Error("IndexNow key must contain 8–128 hexadecimal characters or hyphens.");
  }
  urls.forEach(assertIndexNowUrl);
  const uniqueUrls = [...new Set(urls)];
  const result = { accepted: 0, pendingValidation: 0, attempts: 0 };

  for (let offset = 0; offset < uniqueUrls.length; offset += 10_000) {
    const batch = uniqueUrls.slice(offset, offset + 10_000);
    let failures = 0;
    let rateLimited = false;

    while (true) {
      await beforeAttempt?.();
      result.attempts++;
      let response: Response;
      try {
        response = await fetchImpl(INDEXNOW_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            host: new URL(INDEXNOW_ORIGIN).host,
            key,
            keyLocation: INDEXNOW_KEY_LOCATION,
            urlList: batch,
          }),
          signal: AbortSignal.timeout(15_000),
          redirect: "error",
        });
      } catch (error) {
        if (++failures >= 3) {
          throw new Error("IndexNow network request failed after 3 attempts.", { cause: error });
        }
        const wait = 1000 * 2 ** (failures - 1);
        console.warn(`[IndexNow] batch=${offset / 10_000 + 1} status=network attempt=${result.attempts} retry=${failures} waitMs=${wait}`);
        await sleep(wait);
        continue;
      }

      if (response.status === 200 || response.status === 202) {
        await onAccepted?.(batch, response.status);
        if (response.status === 200) {
          result.accepted += batch.length;
          console.info(`[IndexNow] Accepted ${batch.length} URL(s) (HTTP 200).`);
        } else {
          result.pendingValidation += batch.length;
          console.info(`[IndexNow] Received ${batch.length} URL(s); key validation pending (HTTP 202).`);
        }
        break;
      }

      if (response.status === 429) {
        if (rateLimited) throw new Error("IndexNow remained rate limited after one retry. Retry later.");
        const wait = rateLimitDelay(response, now);
        rateLimited = true;
        console.warn(`[IndexNow] batch=${offset / 10_000 + 1} status=429 attempt=${result.attempts} retry=1 waitMs=${wait}`);
        await sleep(wait);
      } else if (response.status >= 500 && response.status <= 599 && ++failures < 3) {
        const wait = 1000 * 2 ** (failures - 1);
        console.warn(`[IndexNow] batch=${offset / 10_000 + 1} status=${response.status} attempt=${result.attempts} retry=${failures} waitMs=${wait}`);
        await sleep(wait);
      } else {
        throw new Error(`IndexNow submission failed (HTTP ${response.status}).`);
      }
    }
  }
  return result;
}
