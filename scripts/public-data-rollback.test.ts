// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { buildPublicDataSnapshot } from "./public-data-snapshot";
import { activatePublicSnapshot, readStoredPublicManifest, uploadPublicSnapshot, type ActivePublicData, type PublicDataStore } from "../lib/server/public-data-storage";
import type { PublicDataManifest } from "../lib/public-data-snapshot";

// Exercise the actual CLI guard/activation branch without loading cloud credentials.
const source = readFileSync("scripts/public-data-snapshot.ts", "utf8");
const start = source.indexOf('  const activate = value("--activate")');
const end = source.indexOf('  if (args.includes("--publish")', start);
if (start < 0 || end < 0) throw new Error("Rollback CLI branch changed; update its test boundary");
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (...args: string[]) => (...args: unknown[]) => Promise<void>;
const cliBranch = new AsyncFunction("args", "value", "store", "active", "readStoredPublicManifest", "activatePublicSnapshot", "console", source.slice(start, end));

let fixture: Awaited<ReturnType<typeof buildPublicDataSnapshot>>;
beforeAll(async () => { fixture = await buildPublicDataSnapshot("public", "rollback-a"); });
async function setup() {
  let active: ActivePublicData | null = null;
  let writes = 0;
  let beforeCompare: (() => Promise<void>) | undefined;
  const objects = new Map<string, Buffer>();
  const store: PublicDataStore = {
    async readActive() { return active; },
    async readObject(key, max) { const bytes = objects.get(key); if (!bytes || bytes.length > max) throw new Error("Missing or oversized object"); return bytes; },
    async createObject(key, bytes) { if (objects.has(key)) throw new Error("Immutable object exists"); objects.set(key, bytes); },
    async compareAndSet(expected, manifest) {
      const race = beforeCompare; beforeCompare = undefined;
      await race?.();
      if ((active?.revision ?? null) !== expected) throw new Error("conflict");
      active = { manifest, revision: (expected ?? 0) + 1 }; writes++;
    },
  };
  await uploadPublicSnapshot(store, fixture.manifest, fixture.payloads);
  await activatePublicSnapshot(store, fixture.manifest, null);
  const a = (await store.readActive())!;
  const next = await buildPublicDataSnapshot("public", "rollback-b", a, store);
  for (const file of ["phone-numbers.json", "schedules-major.json"] as const) {
    const bytes = Buffer.concat([next.payloads.get(file)!, Buffer.from("\n")]);
    next.payloads.set(file, bytes);
    Object.assign(next.manifest.files[file]!, { size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  await uploadPublicSnapshot(store, next.manifest, next.payloads);
  await activatePublicSnapshot(store, next.manifest, a);
  const b = (await store.readActive())!;
  const run = async (target: string, expected?: string) => {
    const args = ["--rollback", target, ...(expected === undefined ? [] : ["--expected-current", expected])];
    await cliBranch(args, (flag: string) => { const index = args.indexOf(flag); return index < 0 ? undefined : args[index + 1]; }, store, b, readStoredPublicManifest, activatePublicSnapshot, { log() {} });
  };
  return { store, a, b, run, writes: () => writes, race(callback: () => Promise<void>) { beforeCompare = callback; } };
}
function hashes(manifest: PublicDataManifest) {
  return Object.fromEntries(Object.entries(manifest.files).map(([file, entry]) => [file, entry!.sha256]));
}

describe("public data rollback CLI branch", () => {
  it.each([undefined, "stale-version"])("refuses mismatched expected-current %s without changing the pointer", async expected => {
    const test = await setup(); const writes = test.writes();
    await expect(test.run("rollback-a", expected)).rejects.toThrow("--expected-current must match");
    expect(await test.store.readActive()).toBe(test.b);
    expect(test.writes()).toBe(writes);
  });
  it("refuses an unretained version before trying to activate it", async () => {
    const test = await setup(); const writes = test.writes();
    await expect(test.run("unretained-version", "rollback-b")).rejects.toThrow("not retained");
    expect(await test.store.readActive()).toBe(test.b);
    expect(test.writes()).toBe(writes);
  });
  it("restores the full previous manifest including two independently changed files", async () => {
    const test = await setup();
    for (const file of ["phone-numbers.json", "schedules-major.json"] as const) expect(test.b.manifest.files[file]!.sha256).not.toBe(test.a.manifest.files[file]!.sha256);
    await test.run("rollback-a", "rollback-b");
    const active = (await test.store.readActive())!;
    expect(active.manifest.version).toBe("rollback-a");
    expect(hashes(active.manifest)).toEqual(hashes(test.a.manifest));
    expect(active.manifest.retainedVersions).toEqual(["rollback-a", "rollback-b"]);
    expect(active.revision).toBe(test.b.revision + 1);
  });
  it("does not overwrite a publication committed after the expected-current check", async () => {
    const test = await setup();
    const concurrent = await buildPublicDataSnapshot("public", "rollback-c", test.b, test.store);
    await uploadPublicSnapshot(test.store, concurrent.manifest, concurrent.payloads);
    test.race(() => activatePublicSnapshot(test.store, concurrent.manifest, test.b));
    const writes = test.writes();
    await expect(test.run("rollback-a", "rollback-b")).rejects.toThrow("conflict");
    expect((await test.store.readActive())!.manifest.version).toBe("rollback-c");
    expect(test.writes()).toBe(writes + 1);
  });
});
