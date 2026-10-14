import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RootLayout, { generateMetadata } from "./layout";

const request = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-syu-pathname": request.pathname }),
}));
vi.mock("next/script", () => ({
  default: ({ id }: { id: string }) => <script id={id} />,
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
