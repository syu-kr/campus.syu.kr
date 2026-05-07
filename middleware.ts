import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const phpSessionId = request.cookies.get("PHPSESSID")?.value;

  if (phpSessionId) {
    requestHeaders.set("cookie", `PHPSESSID=${phpSessionId}`);
  } else {
    requestHeaders.delete("cookie");
  }

  requestHeaders.set("accept", "*/*");
  requestHeaders.set("cache-control", "no-cache");
  requestHeaders.set("pragma", "no-cache");

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: "/bus/shuttle",
};
