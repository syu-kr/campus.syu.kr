import { NextResponse, type NextRequest } from "next/server";

function createPhpSessionId() {
  return crypto.randomUUID().replace(/-/g, "");
}

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const phpSessionId =
    request.cookies.get("PHPSESSID")?.value ?? createPhpSessionId();

  requestHeaders.set("cookie", `PHPSESSID=${phpSessionId}`);
  requestHeaders.set("accept", "*/*");
  requestHeaders.set("cache-control", "no-cache");
  requestHeaders.set("pragma", "no-cache");

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.cookies.set("PHPSESSID", phpSessionId, {
    path: "/",
    maxAge: 60 * 30,
    sameSite: "lax",
  });

  return response;
}

export const config = {
  matcher: "/bus/shuttle",
};
