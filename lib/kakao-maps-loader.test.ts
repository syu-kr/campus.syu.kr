import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mockKakaoMaps } from "@/tests/kakao-maps-mock";

beforeEach(() => { vi.resetModules();vi.useFakeTimers();vi.stubEnv("NEXT_PUBLIC_KAKAO_MAP_KEY", "public-test-key");delete window.kakao;document.getElementById("kakao-maps-sdk")?.remove(); });
afterEach(() => { vi.useRealTimers();vi.unstubAllEnvs();vi.unstubAllGlobals();delete window.kakao;document.getElementById("kakao-maps-sdk")?.remove(); });

it("does not request a script without a public key", async () => {
  vi.stubEnv("NEXT_PUBLIC_KAKAO_MAP_KEY", "");
  const { loadKakaoMapsSdk } = await import("./kakao-maps-loader");
  expect(await loadKakaoMapsSdk()).toBe(false);expect(document.getElementById("kakao-maps-sdk")).toBeNull();
});

it("shares concurrent requests, caps a script that never completes and permits a successful retry", async () => {
  const { loadKakaoMapsSdk } = await import("./kakao-maps-loader");
  const first = loadKakaoMapsSdk();expect(loadKakaoMapsSdk()).toBe(first);
  const failedScript = document.getElementById("kakao-maps-sdk");
  await vi.advanceTimersByTimeAsync(10_001);
  expect(await first).toBe(false);expect(failedScript?.isConnected).toBe(false);
  const retry = loadKakaoMapsSdk(), script = document.getElementById("kakao-maps-sdk");
  expect(script).not.toBe(failedScript);mockKakaoMaps();script!.dispatchEvent(new Event("load"));
  expect(await retry).toBe(true);expect(vi.getTimerCount()).toBe(0);
});

it("does not cache a network failure permanently", async () => {
  const { loadKakaoMapsSdk } = await import("./kakao-maps-loader");
  const first = loadKakaoMapsSdk();document.getElementById("kakao-maps-sdk")!.dispatchEvent(new Event("error"));
  expect(await first).toBe(false);expect(vi.getTimerCount()).toBe(0);
  const retry = loadKakaoMapsSdk();expect(document.querySelectorAll("#kakao-maps-sdk")).toHaveLength(1);
  mockKakaoMaps();document.getElementById("kakao-maps-sdk")!.dispatchEvent(new Event("load"));expect(await retry).toBe(true);
});

it("also caps an SDK load callback that never fires", async () => {
  const { loadKakaoMapsSdk } = await import("./kakao-maps-loader");
  window.kakao = { maps: { load: vi.fn() } as unknown as KakaoMapsNamespace };
  const request = loadKakaoMapsSdk();document.getElementById("kakao-maps-sdk")!.dispatchEvent(new Event("load"));
  await vi.advanceTimersByTimeAsync(10_001);
  expect(await request).toBe(false);expect(document.getElementById("kakao-maps-sdk")).toBeNull();expect(vi.getTimerCount()).toBe(0);
});

it("reuses an existing SDK script and initializes it without appending another", async () => {
  const script = document.createElement("script");script.id = "kakao-maps-sdk";document.head.appendChild(script);
  window.kakao = { maps: { load: (callback: () => void) => { mockKakaoMaps();callback(); } } as unknown as KakaoMapsNamespace };
  const { loadKakaoMapsSdk } = await import("./kakao-maps-loader");
  expect(await loadKakaoMapsSdk()).toBe(true);expect(document.querySelectorAll("#kakao-maps-sdk")).toHaveLength(1);expect(vi.getTimerCount()).toBe(0);
});
