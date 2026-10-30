// @vitest-environment node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import type { NextConfig } from "next";
import { expect, it, vi } from "vitest";

function loadConfig(env: Record<string, string> = {}) {
  const withSentryConfig = vi.fn((...args: unknown[]) => args[0]);
  const context = {
    module: { exports: {} },
    __dirname: fileURLToPath(new URL(".", import.meta.url)),
    process: { env },
    require: (name: string) => {
      if (name === "@next/bundle-analyzer") return () => (config: unknown) => config;
      if (name === "@sentry/nextjs/config") return { withSentryConfig };
      throw new Error(`Unexpected config dependency: ${name}`);
    },
  };
  runInNewContext(readFileSync(new URL("./next.config.js", import.meta.url), "utf8"), context);
  return { config: context.module.exports as NextConfig, withSentryConfig };
}

it("removes unused tracing consistently in Turbopack and webpack", () => {
  const { config, withSentryConfig } = loadConfig();
  expect(config).toMatchObject({
    compiler: { define: { __SENTRY_DEBUG__: false, __SENTRY_TRACING__: false } },
  });
  expect(withSentryConfig).toHaveBeenCalledWith(config, expect.objectContaining({
    webpack: { treeshake: { removeDebugLogging: true, removeTracing: true } },
  }));
});

it("routes legacy data paths through validated Firebase readers only after opt-in and traces fallback files", async () => {
  const { config } = loadConfig({ PUBLIC_DATA_BACKEND: "firebase" });
  expect(await config.rewrites!()).toMatchObject({ beforeFiles: [
    { source: "/data/:fileName", destination: "/api/public-data/:fileName" },
    { source: "/cafeteria/student-restaurant-1.json", destination: "/api/public-data/student-restaurant-1.json" },
  ] });
  expect(config.outputFileTracingIncludes?.["/*"]).toContain("./public/data/*.json");
  expect(await loadConfig().config.rewrites!()).toMatchObject({ beforeFiles: [] });
});

it("keeps Korean and English admin pages private and unindexed", async () => {
  const { config } = loadConfig();
  const headers = await config.headers!();

  for (const source of ["/admin/:path*", "/en/admin/:path*"]) {
    expect(headers.find((entry) => entry.source === source)?.headers).toEqual([
      { key: "Cache-Control", value: "private, no-store" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ]);
  }
});

it("lets crawlers follow suggestion redirects to the noindex form", async () => {
  const { config } = loadConfig();
  const redirects = await config.redirects!();
  const robots = readFileSync(new URL("./public/robots.txt", import.meta.url), "utf8");
  const generalRules = robots.split(/User-agent: \*/)[1].split(/User-agent:/)[0];

  for (const locale of ["", "/en"]) {
    expect(redirects).toContainEqual({
      source: `${locale}/more/campus-tips/suggest`,
      destination: `${locale}/campus/campus-tips/suggest`,
      permanent: true,
    });
    expect(generalRules).not.toContain(`Disallow: ${locale}/more/campus-tips/suggest`);
    expect(generalRules).not.toContain(`Disallow: ${locale}/campus/campus-tips/suggest`);
    expect(generalRules).toContain(`Disallow: ${locale}/api/`);
    expect(generalRules).toContain(`Disallow: ${locale}/admin`);
  }
  expect(robots).toContain("Sitemap: https://campus.syu.kr/sitemap.xml");
});


it.each([false, true])("generates private Sentry maps only when uploads are authenticated (%s)", (authenticated) => {
  const { config, withSentryConfig } = loadConfig(authenticated ? { SENTRY_AUTH_TOKEN: "test-build-token" } : {});
  expect(config.productionBrowserSourceMaps).toBe(authenticated);
  expect(withSentryConfig).toHaveBeenCalledWith(config, expect.objectContaining({
    sourcemaps: { disable: !authenticated, deleteSourcemapsAfterUpload: true },
    release: { create: authenticated, finalize: authenticated },
    telemetry: false,
  }));
});
