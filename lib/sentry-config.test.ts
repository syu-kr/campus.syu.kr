import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { init } = vi.hoisted(() => ({ init: vi.fn() }));

vi.mock("@sentry/nextjs", () => ({
  init,
  captureRouterTransitionStart: vi.fn(),
}));
vi.mock("@/lib/pwa-install", () => ({
  initializePwaInstallPromptCapture: vi.fn(),
}));

describe("Sentry deployment environment", () => {
  beforeEach(() => {
    vi.resetModules();
    init.mockClear();
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.com/1");
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["development", undefined, false],
    ["test", undefined, false],
    ["production", undefined, false],
    ["development", "production", false],
    ["production", "development", false],
    ["production", "production", true],
    ["production", "preview", true],
  ])("NODE_ENV=%s, deployment=%s: enabled=%s", async (nodeEnv, deployment, enabled) => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    vi.stubEnv("VERCEL_ENV", deployment);
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", deployment);

    await import("../instrumentation-client");
    await import("../sentry.server.config");
    await import("../sentry.edge.config");

    expect(init).toHaveBeenCalledTimes(3);
    for (const [options] of init.mock.calls) {
      expect(options).toMatchObject({
        dsn: "https://public@example.com/1",
        enabled,
      });
    }
  });
});
