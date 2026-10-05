// @vitest-environment node
import "next/dist/server/node-environment-baseline";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { adapter } from "next/dist/server/web/adapter";
import { config, proxy } from "./proxy";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Sentry CSP connection permission", () => {
  it.each(["127.0.0.1:3045", "[::1]:3045"])("keeps loopback locale navigation on %s through the real Next adapter", async (host) => {
    const makeRequest = async (pathname: string) => (await adapter({
      page: "/proxy",
      handler: async (request) => proxy(request),
      request: {
        url: `http://${host}${pathname}?search=notice`, method: "GET",
        headers: { host, cookie: "syu-campus-locale=en" },
        signal: new AbortController().signal,
      },
    })).response;
    const redirect = await makeRequest("/");
    expect(redirect.status).toBe(307);
    expect(new URL(redirect.headers.get("location")!, `http://${host}`).pathname).toBe("/en");
    expect(new URL(redirect.headers.get("location")!, `http://${host}`).host).toBe(host);
    const rewrite = await makeRequest("/en");
    expect(rewrite.status).toBe(200);
    expect(rewrite.headers.get("x-middleware-rewrite")).toBe(`http://${host}/?search=notice`);
    expect(rewrite.headers.get("location")).toBeNull();
    expect(rewrite.headers.get("x-middleware-request-x-syu-locale")).toBe("en");
  });

  it.each([
    ["http://localhost:3045/en", { host: "evil.test:3045" }, "localhost:3045"],
    ["http://localhost:3045/en", { host: "127.0.0.1:3046" }, "localhost:3045"],
    ["http://localhost:3045/en", { host: "localhost:3045", "x-forwarded-host": "127.0.0.1:3045" }, "localhost:3045"],
    ["https://campus.syu.kr/en", { host: "127.0.0.1" }, "campus.syu.kr"],
  ])("does not restore an unrelated Host for %s", (url, headers, expectedHost) => {
    const rewrite = proxy(new NextRequest(url, { headers }));
    expect(new URL(rewrite.headers.get("x-middleware-rewrite")!).host).toBe(expectedHost);
  });

  it.each([
    ["/api", false], ["/api/meet/rooms", false], ["/api/contact?x=1", false],
    ["/", true], ["/en", true], ["/apiary", true], ["/_next/static/chunk.js", false],
  ])("matches %s only when locale proxy is needed", (url, expected) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(expected);
  });

  it.each(["/", "/en"])("passes the same CSP nonce to Next rendering and the browser: %s", (pathname) => {
    const response = proxy(new NextRequest(`https://campus.syu.kr${pathname}`, {
      headers: { "Content-Security-Policy": "script-src 'nonce-untrusted'" },
    }));
    const nonce = response.headers.get("x-middleware-request-x-csp-nonce");
    const csp = response.headers.get("Content-Security-Policy");

    expect(nonce).toMatch(/^[a-f0-9]{32}$/);
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(csp).not.toContain("untrusted");
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(csp);
  });

  it("allows only the configured HTTPS DSN origin without its key or project path", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SENTRY_DSN",
      "https://public-key@o123.ingest.us.sentry.io/456",
    );

    const response = proxy(new NextRequest("https://campus.syu.kr/"));
    const csp = response.headers.get("Content-Security-Policy") || "";
    const connectSrc = csp.split("; ").find((part) => part.startsWith("connect-src"));

    expect(connectSrc).toContain("https://o123.ingest.us.sentry.io");
    expect(csp).not.toContain("public-key");
    expect(csp).not.toContain("/456");
  });

  it.each(["", "malformed DSN", "http://o123.ingest.sentry.io/456"])(
    "keeps the page usable without allowing an invalid or insecure DSN: %s",
    (dsn) => {
      vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", dsn);

      const response = proxy(new NextRequest("https://campus.syu.kr/"));
      const csp = response.headers.get("Content-Security-Policy") || "";

      expect(response.status).toBe(200);
      expect(csp).toContain("connect-src 'self'");
      expect(csp).not.toContain("sentry.io");
    },
  );
});
