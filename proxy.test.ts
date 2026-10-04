import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Sentry CSP connection permission", () => {
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
