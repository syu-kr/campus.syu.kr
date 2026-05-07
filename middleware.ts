import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const phpSessionId = request.cookies.get("PHPSESSID")?.value;

  if (phpSessionId) {
    requestHeaders.set("cookie", `PHPSESSID=${phpSessionId}`);
  } else {
    requestHeaders.delete("cookie");
  }

  requestHeaders.set(
    "accept",
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  );
  requestHeaders.set("cache-control", "no-cache");
  requestHeaders.set("pragma", "no-cache");
  requestHeaders.set("upgrade-insecure-requests", "1");
  requestHeaders.set("sec-fetch-dest", "document");
  requestHeaders.set("sec-fetch-mode", "navigate");
  requestHeaders.set("sec-fetch-site", "none");
  requestHeaders.set("sec-fetch-user", "?1");
  requestHeaders.delete("referer");
  requestHeaders.delete("origin");

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: "/bus/shuttle",
};
