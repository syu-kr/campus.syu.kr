import { createHash } from "node:crypto";

export const MAX_SHUTTLE_RESPONSE_BYTES = 256 * 1024;

export function validateShuttleEndpoint(
  locationUrl: string,
  refererUrl: string,
  pageUrl: string,
): { url: URL; referer: string; pageUrl: URL } {
  let url: URL;
  let referer: URL;
  let page: URL;

  try {
    url = new URL(locationUrl);
    referer = new URL(refererUrl);
    page = new URL(pageUrl);
  } catch {
    throw new Error("셔틀 upstream URL 설정이 올바르지 않습니다");
  }

  if (
    ![url, referer, page].every(
      (item) => item.protocol === "http:" || item.protocol === "https:",
    )
  ) {
    throw new Error("셔틀 upstream은 HTTP 또는 HTTPS만 사용할 수 있습니다");
  }

  if (url.origin !== referer.origin || url.origin !== page.origin) {
    throw new Error(
      "셔틀 endpoint, page, Referer의 origin이 일치하지 않습니다",
    );
  }

  if (
    [url, referer, page].some((item) => item.username || item.password)
  ) {
    throw new Error("셔틀 upstream URL에 인증 정보를 포함할 수 없습니다");
  }

  return { url, referer: referer.toString(), pageUrl: page };
}

export function createShuttleChallengeBody(html: string, salt: string): string {
  const block = html.match(
    /(?:window\.)?BUS_CHALLENGE\s*=\s*\{([\s\S]*?)\}\s*;/,
  )?.[1];
  const seed = block?.match(
    /\bseed\s*:\s*["']([A-Za-z0-9_-]{8,128})["']/,
  )?.[1];
  const timestamp = block?.match(
    /\bts\s*:\s*["']?(\d{10,13})["']?/,
  )?.[1];
  const signature = block?.match(
    /\bsig\s*:\s*["']([A-Za-z0-9_-]{16,256})["']/,
  )?.[1];

  if (!seed || !timestamp || !signature || !salt) {
    throw new Error("셔틀 upstream challenge가 올바르지 않습니다");
  }

  const answer = createHash("sha256")
    .update(`${seed}:${salt}`)
    .digest("hex")
    .slice(0, 16);

  return new URLSearchParams({
    _s: seed,
    _t: timestamp,
    _g: signature,
    _a: answer,
  }).toString();
}
