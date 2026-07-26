export const MAX_SHUTTLE_RESPONSE_BYTES = 256 * 1024;

export function validateShuttleEndpoint(
  locationUrl: string,
  refererUrl: string,
): { url: URL; referer: string } {
  let url: URL;
  let referer: URL;

  try {
    url = new URL(locationUrl);
    referer = new URL(refererUrl);
  } catch {
    throw new Error("셔틀 upstream URL 설정이 올바르지 않습니다");
  }

  if (url.protocol !== "https:" || referer.protocol !== "https:") {
    throw new Error("셔틀 upstream은 HTTPS만 사용할 수 있습니다");
  }

  if (url.origin !== referer.origin) {
    throw new Error("셔틀 endpoint와 Referer의 origin이 일치하지 않습니다");
  }

  if (url.username || url.password) {
    throw new Error("셔틀 upstream URL에 인증 정보를 포함할 수 없습니다");
  }

  return { url, referer: referer.toString() };
}
