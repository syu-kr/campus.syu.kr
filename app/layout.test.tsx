import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RootLayout, { generateMetadata } from "./layout";

const request = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-syu-pathname": request.pathname }),
}));
vi.mock("next/script", () => ({
  default: ({ id, dangerouslySetInnerHTML }: {
    id: string;
    dangerouslySetInnerHTML?: { __html: string };
  }) => <script id={id} dangerouslySetInnerHTML={dangerouslySetInnerHTML} />,
}));
vi.mock("./components/Header", () => ({ Header: () => null }));
vi.mock("./components/Footer", () => ({ Footer: () => null }));
vi.mock("./components/BottomNav", () => ({ BottomNav: () => null }));
vi.mock("./components/NotificationPermissionPrompt", () => ({
  NotificationPermissionPrompt: () => null,
}));
vi.mock("./components/LocaleProvider", () => ({ LocaleProvider: () => null }));
vi.mock("./providers", () => ({ Providers: () => null }));

async function renderDocument() {
  const html = renderToStaticMarkup(await RootLayout({ children: null }));
  return new DOMParser().parseFromString(html, "text/html");
}

const ANALYTICS_DISABLE_KEY = "ga-disable-G-SD8QFQWFVQ";

function runAnalyticsBootstrap(script: string, href: string, referrer = "", disabled = false) {
  const analyticsWindow = {
    location: new URL(href),
    dataLayer: undefined as IArguments[] | undefined,
    gtag: undefined as ((...args: unknown[]) => void) | undefined,
    [ANALYTICS_DISABLE_KEY]: disabled,
    setTimeout: vi.fn(),
    addEventListener: vi.fn(),
  };
  const analyticsDocument = {
    referrer,
    readyState: "complete",
    head: { appendChild: vi.fn() },
    createElement: vi.fn(() => ({})),
  };
  new Function("window", "document", script)(analyticsWindow, analyticsDocument);
  return { analyticsWindow, analyticsDocument };
}

async function getAnalyticsScript() {
  const document = await renderDocument();
  const script = document.querySelector("#google-analytics")?.textContent;
  expect(script).toBeTruthy();
  return script!;
}

beforeEach(() => { request.pathname = "/"; });
afterEach(() => { vi.unstubAllEnvs(); });

describe("search engine ownership verification", () => {
  it("renders configured tokens in the initial head while preserving Google verification", async () => {
    vi.stubEnv("NAVER_SITE_VERIFICATION", "  test-naver-token  ");
    vi.stubEnv("BING_SITE_VERIFICATION", "\ttest-bing-token\n");
    const document = await renderDocument();

    expect(document.head.querySelector('meta[name="naver-site-verification"]')?.getAttribute("content"))
      .toBe("test-naver-token");
    expect(document.head.querySelector('meta[name="msvalidate.01"]')?.getAttribute("content"))
      .toBe("test-bing-token");
    expect(document.body.querySelector('meta[name="naver-site-verification"], meta[name="msvalidate.01"]'))
      .toBeNull();
    expect(document.head.querySelector('meta[name="google-site-verification"]')?.getAttribute("content"))
      .toBe("Gy1EGZh0gfxtv6UGI1szYk9uo1YzjaDMyoHRca7EZj4");
    expect((await generateMetadata()).verification?.google)
      .toBe("5Ow1OdBZo0zgRn7w0rscMVMBYlw71tIxaw79JoYgCfY");
  });

  it.each([undefined, "", " \t\n "])("omits missing or blank tokens (%j)", async (value) => {
    vi.stubEnv("NAVER_SITE_VERIFICATION", value);
    vi.stubEnv("BING_SITE_VERIFICATION", value);
    const document = await renderDocument();

    expect(document.querySelector('meta[name="naver-site-verification"], meta[name="msvalidate.01"]'))
      .toBeNull();
  });

  it("allows independent verification and preserves roommate analytics suppression", async () => {
    vi.stubEnv("NAVER_SITE_VERIFICATION", "test-naver-token");
    vi.stubEnv("BING_SITE_VERIFICATION", "");
    request.pathname = "/en/campus/roommates";
    const document = await renderDocument();

    expect(document.head.querySelector('meta[name="naver-site-verification"]')?.getAttribute("content"))
      .toBe("test-naver-token");
    expect(document.querySelector('meta[name="msvalidate.01"]')).toBeNull();
    expect(document.querySelector("#google-analytics")).toBeNull();
  });
});

describe("Meet invitation analytics privacy", () => {
  it.each([
    "/more/meet/dummy-private-invite",
    "/en/more/meet/dummy-private-invite/",
    "/campus/roommates/verify/finish",
    "/en/campus/roommates",
  ])("omits the analytics script from private initial HTML (%s)", async (pathname) => {
    request.pathname = pathname;
    expect((await renderDocument()).querySelector("#google-analytics")).toBeNull();
  });

  it.each(["/more/meet", "/en/more/meet", "/more/meeting"])(
    "keeps ordinary public analytics (%s)", async (pathname) => {
      request.pathname = pathname;
      expect((await renderDocument()).querySelector("#google-analytics")).not.toBeNull();
    },
  );

  it.each([
    "/more/meet/dummy-private-invite",
    "/en/more/meet/dummy-private-invite",
    "/campus/roommates/verify/finish",
  ])("stops a delayed bootstrap before any private config is queued (%s)", async (pathname) => {
    const { analyticsWindow, analyticsDocument } = runAnalyticsBootstrap(
      await getAnalyticsScript(), `https://campus.test${pathname}?private=query#fragment`,
    );
    expect(analyticsWindow[ANALYTICS_DISABLE_KEY]).toBe(true);
    expect(analyticsWindow.dataLayer).toBeUndefined();
    expect(analyticsWindow.gtag).toBeUndefined();
    expect(analyticsWindow.setTimeout).not.toHaveBeenCalled();
    expect(analyticsDocument.head.appendChild).not.toHaveBeenCalled();
  });

  it("keeps analytics disabled after returning to a public route in the same document", async () => {
    const { analyticsWindow } = runAnalyticsBootstrap(
      await getAnalyticsScript(), "https://campus.test/more", "", true,
    );
    expect(analyticsWindow.dataLayer).toBeUndefined();
    expect(analyticsWindow.setTimeout).not.toHaveBeenCalled();
  });

  it.each(["/more/meet/dummy-private-invite", "/en/more/meet/dummy-private-invite/"])(
    "removes the previous invitation from a public document's referrer (%s)", async (pathname) => {
      const { analyticsWindow } = runAnalyticsBootstrap(
        await getAnalyticsScript(), "https://campus.test/more?filter=value#section",
        `https://campus.test${pathname}?private=query#fragment`,
      );
      const commands = analyticsWindow.dataLayer?.map((args) => Array.from(args));
      expect(commands?.find(([command]) => command === "config")).toEqual([
        "config", "G-SD8QFQWFVQ",
        { page_location: "https://campus.test/more", page_referrer: "https://campus.test" },
      ]);
      expect(JSON.stringify(commands)).not.toContain("dummy-private-invite");
    },
  );

  it("preserves the public queue, global gtag, and query/hash removal", async () => {
    const { analyticsWindow, analyticsDocument } = runAnalyticsBootstrap(
      await getAnalyticsScript(), "https://campus.test/more/meet?private=query#fragment",
      "https://example.test/public?private=query#fragment",
    );
    const commands = analyticsWindow.dataLayer?.map((args) => Array.from(args));
    expect(commands?.find(([command]) => command === "config")).toEqual([
      "config", "G-SD8QFQWFVQ",
      { page_location: "https://campus.test/more/meet", page_referrer: "https://example.test/public" },
    ]);
    analyticsWindow.gtag!("event", "public-event");
    expect(Array.from(analyticsWindow.dataLayer!.at(-1)!)).toEqual(["event", "public-event"]);
    expect(analyticsWindow.setTimeout).toHaveBeenCalledWith(expect.any(Function), 4000);

    const loadAnalytics = analyticsWindow.setTimeout.mock.calls[0][0];
    loadAnalytics();
    expect(analyticsDocument.head.appendChild).toHaveBeenCalledWith(expect.objectContaining({
      async: true,
      src: "https://www.googletagmanager.com/gtag/js?id=G-SD8QFQWFVQ",
    }));
    analyticsDocument.head.appendChild.mockClear();
    analyticsWindow[ANALYTICS_DISABLE_KEY] = true;
    loadAnalytics();
    expect(analyticsDocument.head.appendChild).not.toHaveBeenCalled();
  });
});
