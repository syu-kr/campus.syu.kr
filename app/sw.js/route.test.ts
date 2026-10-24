import vm from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import lockfile from "../../package-lock.json";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Firebase service worker version alignment", () => {
  it("loads app and messaging compat from the installed Firebase SDK version", async () => {
    const config = {
      NEXT_PUBLIC_FIREBASE_API_KEY: "public-test-key",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "campus.test",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "campus-test",
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "campus-test.appspot.com",
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789",
      NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789:web:test",
    };
    for (const [key, value] of Object.entries(config)) vi.stubEnv(key, value);

    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Content-Type")).toContain("javascript");

    const imports: string[] = [];
    const initializeApp = vi.fn();
    const messaging = vi.fn();
    vm.runInNewContext(await response.text(), {
      importScripts: (url: string) => imports.push(url),
      firebase: { initializeApp, messaging },
      self: { addEventListener: vi.fn() },
    }, { timeout: 1000 });

    const version = lockfile.packages["node_modules/firebase"].version;
    expect(imports).toEqual([
      `https://www.gstatic.com/firebasejs/${version}/firebase-app-compat.js`,
      `https://www.gstatic.com/firebasejs/${version}/firebase-messaging-compat.js`,
    ]);
    expect(initializeApp).toHaveBeenCalledOnce();
    expect(messaging).toHaveBeenCalledOnce();
  });
});
