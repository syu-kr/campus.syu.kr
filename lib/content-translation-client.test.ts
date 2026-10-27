import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentTranslationSource } from "./content-translation";

beforeEach(() => { vi.useFakeTimers(); vi.resetModules(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const source = (id: string): ContentTranslationSource => ({ kind: "tip", id });
const success = (requests: { fields: string[] }[]) => Response.json({ results: requests.map(request => ({ ok: true, result: { target: "en", provider: "google", originals: Object.fromEntries(request.fields.map(field => [field, "공개 문구"])), translations: Object.fromEntries(request.fields.map(field => [field, "Public text"])) } })) });
describe("page translation queue", () => {
  it("batches 25 visible sources, deduplicates identical registrations and only sends Korean field descriptors", async () => {
    const fetcher = vi.fn(async (_url, options) => success(JSON.parse(options.body).requests)); vi.stubGlobal("fetch", fetcher);
    const { watchContentTranslation } = await import("./content-translation-client");
    const callbacks = Array.from({ length: 25 }, () => vi.fn());
    const stops = callbacks.map((callback, i) => watchContentTranslation(source(String(i)), { title: "공개 문구", english: "English", number: "123" }, callback));
    stops.push(watchContentTranslation(source("0"), { number: "123", title: "공개 문구", english: "English" }, vi.fn()));
    await vi.advanceTimersByTimeAsync(200);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls.map(([, options]) => JSON.parse(options.body).requests.length)).toEqual([12, 12, 1]);
    for (const [, options] of fetcher.mock.calls) {
      expect(options.body).not.toContain("공개 문구");
      expect(JSON.parse(options.body).requests.every((request: { fields: string[] }) => JSON.stringify(request.fields) === '["title"]')).toBe(true);
    }
    callbacks.forEach(callback => expect(callback).toHaveBeenLastCalledWith({ status: "idle", fields: { title: "Public text" } }));
    stops.forEach(stop => stop());
  });
  it("cancels queued work before language or page navigation and reuses completed public results", async () => {
    const fetcher = vi.fn(async (_url, options) => success(JSON.parse(options.body).requests)); vi.stubGlobal("fetch", fetcher);
    const { watchContentTranslation } = await import("./content-translation-client");
    watchContentTranslation(source("cancel"), { title: "공개 문구" }, vi.fn())();
    await vi.advanceTimersByTimeAsync(100);
    expect(fetcher).not.toHaveBeenCalled();
    const stop = watchContentTranslation(source("cache"), { title: "공개 문구" }, vi.fn());
    await vi.advanceTimersByTimeAsync(100); stop();
    const callback = vi.fn(), stopAgain = watchContentTranslation(source("cache"), { title: "공개 문구" }, callback);
    await vi.advanceTimersByTimeAsync(100);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith({ status: "idle", fields: { title: "Public text" } }); stopAgain();
  });
  it("stops remaining queued work at the daily limit and retries only on explicit page recovery", async () => {
    const fetcher = vi.fn(async () => Response.json({}, { status: 429 })); vi.stubGlobal("fetch", fetcher);
    const { watchContentTranslation, getPageTranslationSnapshot, retryPageTranslation } = await import("./content-translation-client");
    const stops = Array.from({ length: 25 }, (_, i) => watchContentTranslation(source(String(i)), { title: "공개 문구" }, vi.fn()));
    await vi.advanceTimersByTimeAsync(200);
    expect(fetcher).toHaveBeenCalledTimes(1); expect(getPageTranslationSnapshot().error).toBe("limited");
    retryPageTranslation(); await vi.advanceTimersByTimeAsync(200);
    expect(fetcher).toHaveBeenCalledTimes(2); stops.forEach(stop => stop());
  });
  it("splits field groups at 40 fields while retaining all outputs", async () => {
    const fetcher = vi.fn(async (_url, options) => success(JSON.parse(options.body).requests)); vi.stubGlobal("fetch", fetcher);
    const { watchContentTranslation } = await import("./content-translation-client");
    const content = Object.fromEntries(Array.from({ length: 41 }, (_, i) => ["part." + i, "공개 문구"])), callback = vi.fn();
    const stop = watchContentTranslation(source("large"), content, callback); await vi.advanceTimersByTimeAsync(150);
    const requests = JSON.parse(fetcher.mock.calls[0][1].body).requests;
    expect(requests.map((request: { fields: string[] }) => request.fields.length)).toEqual([40, 1]);
    expect(Object.keys(callback.mock.lastCall![0].fields)).toHaveLength(41); stop();
  });
  it("aborts an abandoned running page so the next English page does not wait for its timeout", async () => {
    let firstSignal: AbortSignal | undefined;
    const fetcher = vi.fn((_url, options) => {
      if (!firstSignal) {
        firstSignal = options.signal;
        return new Promise<Response>((_, reject) => firstSignal!.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
      }
      return Promise.resolve(success(JSON.parse(options.body).requests));
    }); vi.stubGlobal("fetch", fetcher);
    const { watchContentTranslation } = await import("./content-translation-client");
    const stop = watchContentTranslation(source("abandoned"), { title: "공개 문구" }, vi.fn());
    await vi.advanceTimersByTimeAsync(40); stop();
    const callback = vi.fn(), stopAgain = watchContentTranslation(source("next-page"), { title: "공개 문구" }, callback);
    await vi.advanceTimersByTimeAsync(100);
    expect(firstSignal?.aborted).toBe(true); expect(fetcher).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith({ status: "idle", fields: { title: "Public text" } }); stopAgain();
  });
});
