// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { DAILY_CRAWL_DATA_FILES, type CrawlDataManifest } from "../lib/crawl-data-contract";
import { assertIndexNowTarget, parseIndexNowState, processIndexNowSnapshot, verifyIndexNowProduction } from "./indexnow";

const origin = "https://campus.syu.kr";
const url = `${origin}/campus/cafeteria`;
const oldHash = "a".repeat(64), newHash = "b".repeat(64), sourceSha = "c".repeat(40);
const now = Date.parse("2026-10-15T03:00:00Z");
const manifest: CrawlDataManifest = { schemaVersion: 1, version: "test-version", publishedAt: "2026-10-15T01:00:00Z", retainedVersions: ["test-version"],
  files: Object.fromEntries(DAILY_CRAWL_DATA_FILES.map((file) => [file, { path: `versions/test-version/${file}`, size: 2, sha256: oldHash }])) };
const previous = () => ({ schemaVersion: 1 as const, sourceSha, version: "old", fingerprints: { [url]: oldHash } as Record<string, string>, submittedAt: {} as Record<string, string> });
const target = { sourceSha, manifest, fingerprints: { [url]: newHash } };

describe("IndexNow submission state", () => {
  it("establishes the first verified baseline without sending historical URLs", async () => {
    const saveState = vi.fn(), verify = vi.fn().mockResolvedValue([]), submit = vi.fn();
    const report = await processIndexNowSnapshot(target, undefined, { send: true, key: "12345678", saveState, verify, submit });
    expect(report.mode).toBe("baseline");
    expect(verify).toHaveBeenCalledOnce();
    expect(submit).not.toHaveBeenCalled();
    expect(saveState).toHaveBeenCalledWith(expect.objectContaining({ fingerprints: target.fingerprints }));
  });
  it("dry-run reports a delta without probing, sending, or updating state", async () => {
    const saveState = vi.fn(), verify = vi.fn(), submit = vi.fn();
    const report = await processIndexNowSnapshot(target, previous(), { send: false, key: "12345678", saveState, verify, submit });
    expect(report.changed).toEqual([url]);
    expect([saveState, verify, submit].every((fn) => fn.mock.calls.length === 0)).toBe(true);
  });
  it("renews an unchanged baseline without submitting or inventing new readiness evidence", async () => {
    const saveState = vi.fn(), verify = vi.fn(), submit = vi.fn(), state = previous();
    const report = await processIndexNowSnapshot({ ...target, fingerprints: state.fingerprints }, state, { send: true, key: "12345678", saveState, verify, submit });
    expect(report.mode).toBe("unchanged");
    expect(verify).not.toHaveBeenCalled(); expect(submit).not.toHaveBeenCalled();
    expect(saveState).toHaveBeenCalledWith(state);
  });
  it("waits for duplicate cooldown before checking production and saving accepted batches", async () => {
    const state = previous(); state.submittedAt[url] = new Date(now - 60_000).toISOString();
    const calls: string[] = [], saveState = vi.fn();
    const sleep = vi.fn(async () => { calls.push("sleep"); });
    const report = await processIndexNowSnapshot(target, state, { send: true, key: "12345678", now: () => now, sleep,
      saveState, verify: async () => { calls.push("verify"); return [url]; }, submit: async (urls, _key, options) => {
        calls.push("send"); await options?.onAccepted?.(urls, 202);
        return { accepted: 0, pendingValidation: urls.length, attempts: 1 };
      } });
    expect(sleep).toHaveBeenCalledWith(240_000);
    expect(calls).toEqual(["sleep", "verify", "send"]);
    expect(report.pendingValidation).toBe(1);
    expect(state.fingerprints[url]).toBe(oldHash);
    expect(saveState).toHaveBeenLastCalledWith(expect.objectContaining({ fingerprints: { [url]: newHash } }));
  });
  it("persists only accepted work when a later batch fails and keeps the error report counts", async () => {
    const second = `${origin}/academic/schedule`, state = previous(); state.fingerprints[second] = oldHash;
    const writes: unknown[] = [], progress = vi.fn();
    await expect(processIndexNowSnapshot({ ...target, fingerprints: { [url]: newHash, [second]: newHash } }, state, {
      send: true, key: "12345678", now: () => now, saveState: async (value) => { writes.push(structuredClone(value)); }, verify: async () => [], onProgress: progress,
      submit: async (_urls, _key, options) => { await options?.onAccepted?.([url], 200); throw new Error("batch failed"); },
    })).rejects.toThrow("batch failed");
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ fingerprints: { [url]: newHash, [second]: oldHash } });
    expect(progress.mock.calls[0][0].accepted).toBe(1);
  });
  it("removes acknowledged deleted URLs while retaining pending changes for retry", async () => {
    const state = previous(), saveState = vi.fn();
    await processIndexNowSnapshot({ ...target, fingerprints: {} }, state, { send: true, key: "12345678", saveState, verify: async () => [],
      submit: async (urls, _key, options) => { await options?.onAccepted?.(urls, 200); return { accepted: urls.length, pendingValidation: 0, attempts: 1 }; } });
    expect(saveState).toHaveBeenLastCalledWith(expect.objectContaining({ fingerprints: {} }));
  });
  it.each([{}, { ...previous(), fingerprints: 3 }, { ...previous(), fingerprints: { [`${origin}/api/private`]: oldHash } }, { ...previous(), submittedAt: { [url]: "invalid" } }])("fails closed on malformed or private state (%j)", (input) => {
    expect(() => parseIndexNowState(input)).toThrow();
  });
  it("accepts a valid baseline and rejects empty or private history", () => {
    const valid = { ...previous(), fingerprints: { [`${origin}/`]: oldHash, [`${origin}/en`]: oldHash, [url]: oldHash } };
    expect(parseIndexNowState(valid)).toEqual(valid);
    expect(() => parseIndexNowState({ ...valid, fingerprints: {} })).toThrow("homepage baseline");
    expect(() => parseIndexNowState({ ...valid, fingerprints: { ...valid.fingerprints, [`${origin}/campus/roommates`]: oldHash } })).toThrow("allowlist");
  });
});

function productionFetch(overrides: { version?: string; source?: string; key?: string; pageStatus?: number; page?: string } = {}) {
  return vi.fn<typeof fetch>(async (input) => {
    const value = String(input);
    if (value.includes("indexnow-deployment.json")) return Response.json({ sourceSha: overrides.source ?? sourceSha });
    if (value.endsWith("indexnow-key.txt")) return new Response(overrides.key ?? "12345678");
    if (value.includes("/current.json")) return Response.json({ ...manifest, version: overrides.version ?? manifest.version });
    if (value.includes("/api/crawl-data/")) return new Response("{}", { headers: { "x-crawl-data-source": "github-pages", "x-crawl-data-version": overrides.version ?? manifest.version } });
    return new Response(overrides.page ?? `<html><link rel="canonical" href="${value}"></html>`, { status: overrides.pageStatus ?? 200 });
  });
}

describe("IndexNow production readiness", () => {
  it("checks deployed SHA, public key, every data version and canonical page before sending", async () => {
    const fetchImpl = productionFetch(), sleep = vi.fn();
    await expect(verifyIndexNowProduction(sourceSha, manifest, [url], target.fingerprints, "12345678", { fetchImpl, sleep, now: () => now, pagesChanged: false })).resolves.toEqual([url]);
    expect(fetchImpl.mock.calls.filter(([input]) => String(input).includes("/api/crawl-data/"))).toHaveLength(DAILY_CRAWL_DATA_FILES.length);
    expect(sleep).not.toHaveBeenCalled();
  });
  it("waits after observing a new active version even when a rollback retains an old publication time", async () => {
    const sleep = vi.fn();
    await verifyIndexNowProduction(sourceSha, manifest, [url], target.fingerprints, "12345678", { fetchImpl: productionFetch(), sleep, now: () => now, observedAt: now });
    expect(sleep).toHaveBeenCalledWith(360_000);
  });
  it("accepts removed pages with 404 or streaming noindex instead of requiring HTTP 200", async () => {
    for (const overrides of [{ pageStatus: 404 }, { page: '<meta name="robots" content="noindex" />' }]) {
      await expect(verifyIndexNowProduction(sourceSha, manifest, [url], {}, "12345678", { fetchImpl: productionFetch(overrides), sleep: vi.fn(), now: () => now })).resolves.toEqual([url]);
    }
  });
  it("does not accept a missing current page or a different canonical", async () => {
    for (const overrides of [{ pageStatus: 404 }, { page: '<link rel="canonical" href="https://campus.syu.kr/en/campus/cafeteria" />' }]) {
      await expect(verifyIndexNowProduction(sourceSha, manifest, [url], target.fingerprints, "12345678", { fetchImpl: productionFetch(overrides), sleep: vi.fn(), now: () => now })).rejects.toThrow("expected change");
    }
  });
  it("rejects a key mismatch and stale production source before any submission", async () => {
    await expect(verifyIndexNowProduction(sourceSha, manifest, [url], target.fingerprints, "12345678", { fetchImpl: productionFetch({ key: "wrong" }), sleep: vi.fn(), now: () => now })).rejects.toThrow("key file");
    await expect(verifyIndexNowProduction(sourceSha, manifest, [url], target.fingerprints, "12345678", { fetchImpl: productionFetch({ source: "wrong" }), sleep: vi.fn(), now: () => now })).rejects.toThrow("source SHA");
  });
  it("fails closed when a data API still serves a bundled or older version", async () => {
    const base = productionFetch();
    const fetchImpl: typeof fetch = async (input, init) => String(input).includes("/api/crawl-data/")
      ? new Response("{}", { headers: { "x-crawl-data-source": "bundled-fallback", "x-crawl-data-version": "old" } }) : base(input, init);
    await expect(verifyIndexNowProduction(sourceSha, manifest, [url], target.fingerprints, "12345678", { fetchImpl, sleep: vi.fn(), now: () => now })).rejects.toThrow("data version is not ready");
  });
  it("rechecks the production marker immediately before a request", async () => {
    await expect(assertIndexNowTarget(sourceSha, manifest.version, productionFetch({ source: "changed" }))).rejects.toThrow("Production changed");
    await expect(assertIndexNowTarget(sourceSha, manifest.version, productionFetch())).resolves.toBeUndefined();
  });
});
