// @vitest-environment node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

it("removes unused tracing consistently in Turbopack and webpack", () => {
  const withSentryConfig = vi.fn((...args: unknown[]) => args[0]);
  const context = {
    module: { exports: {} },
    __dirname: fileURLToPath(new URL(".", import.meta.url)),
    process: { env: {} },
    require: (name: string) => {
      if (name === "@next/bundle-analyzer") return () => (config: unknown) => config;
      if (name === "@sentry/nextjs") return { withSentryConfig };
      throw new Error(`Unexpected config dependency: ${name}`);
    },
  };
  runInNewContext(readFileSync(new URL("./next.config.js", import.meta.url), "utf8"), context);

  expect(context.module.exports).toMatchObject({
    compiler: { define: { __SENTRY_DEBUG__: false, __SENTRY_TRACING__: false } },
  });
  expect(withSentryConfig).toHaveBeenCalledWith(context.module.exports, expect.objectContaining({
    webpack: { treeshake: { removeDebugLogging: true, removeTracing: true } },
  }));
});
