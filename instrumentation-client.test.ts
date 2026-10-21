import type { BrowserOptions, ErrorEvent } from "@sentry/nextjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  init: vi.fn<(options: BrowserOptions) => void>(),
  captureRouterTransitionStart: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => sentry);

beforeEach(() => {
  vi.resetModules();
  sentry.init.mockClear();
  sentry.captureRouterTransitionStart.mockClear();
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@sentry.invalid/1");
});

afterEach(async () => {
  const { initializePwaInstallPromptCapture } = await import("@/lib/pwa-install");
  initializePwaInstallPromptCapture()();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function loadOptions() {
  await import("./instrumentation-client");
  expect(sentry.init).toHaveBeenCalledOnce();
  return sentry.init.mock.calls[0][0];
}

describe("client error monitoring startup", () => {
  it("captures browser installation before the deferred home card mounts", async () => {
    await import("./instrumentation-client");
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    });
    window.dispatchEvent(event);
    const { takePwaInstallPrompt } = await import("@/lib/pwa-install");
    expect(event.defaultPrevented).toBe(true);
    expect(takePwaInstallPrompt()).toBe(event);
    expect(takePwaInstallPrompt()).toBeNull();
    expect(event.prompt).not.toHaveBeenCalled();
    expect(sentry.init).toHaveBeenCalledOnce();
  });

  it("initializes during module loading without waiting for a timer or interaction", async () => {
    vi.useFakeTimers();
    const options = await loadOptions();
    expect(options).toMatchObject({
      dsn: "https://public@sentry.invalid/1",
      enabled: false,
      enableLogs: false,
      enableMetrics: false,
      dataCollection: { userInfo: false, httpBodies: [] },
    });
    for (const option of ["defaultIntegrations", "integrations", "tracesSampleRate", "tracesSampler"]) {
      expect(options).not.toHaveProperty(option);
    }
  });

  it("keeps error, transaction and breadcrumb privacy filtering connected", async () => {
    const options = await loadOptions();
    const { scrubSentryBreadcrumb } = await import("@/lib/sentry-privacy");
    const event: ErrorEvent = {
      type: undefined,
      exception: { values: [{ type: "Error", value: "startup failure" }] },
      transaction: "/academic/timetable?token=secret",
      user: { email: "private@example.com" },
      request: { url: "https://campus.syu.kr/academic/timetable?token=secret", data: "private body" },
    };
    const results = await Promise.all([
      options.beforeSend!({ ...event, request: { ...event.request } }, {}),
      options.beforeSendTransaction!({ ...event, type: "transaction", request: { ...event.request } }, {}),
    ]);
    for (const result of results) {
      expect(result).toMatchObject({
        exception: event.exception,
        transaction: "/academic/timetable",
        request: { url: "https://campus.syu.kr/academic/timetable" },
      });
      expect(result).not.toHaveProperty("user");
      expect(result?.request).not.toHaveProperty("data");
      expect(JSON.stringify(result)).not.toContain("secret");
    }
    expect(options.beforeBreadcrumb).toBe(scrubSentryBreadcrumb);
    expect(options.beforeBreadcrumb!({ data: { from: "/academic?token=secret", to: "/academic/timetable#secret" } }, {}))
      .toMatchObject({ data: { from: "/academic", to: "/academic/timetable" } });
  });

  it.each(["/campus/roommates/verify/finish", "/en/campus/roommates/verify/finish"])(
    "keeps private authentication events excluded for %s", async (path) => {
      const options = await loadOptions();
      const request = { url: `https://campus.syu.kr${path}?oobCode=secret` };
      expect(await options.beforeSend!({ type: undefined, request }, {})).toBeNull();
      expect(await options.beforeSendTransaction!({ type: "transaction", request }, {})).toBeNull();
    },
  );

  it("exports the original Next.js router transition hook", async () => {
    const { onRouterTransitionStart } = await import("./instrumentation-client");
    expect(onRouterTransitionStart).toBe(sentry.captureRouterTransitionStart);
    onRouterTransitionStart("/academic/timetable", "push");
    expect(sentry.captureRouterTransitionStart).toHaveBeenCalledWith("/academic/timetable", "push");
  });
});
