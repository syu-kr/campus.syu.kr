// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

it.each([null, "chunk.js.map", "style.css.map"])("rejects source maps left in public build output: %s", (file) => {
  const fixture = mkdtempSync(path.join(os.tmpdir(), "syu-private-maps-"));
  try {
    const directory = path.join(fixture, ".next", "static", "chunks", "nested");
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, file ?? "chunk.js"), "fixture");
    const result = spawnSync(process.execPath, [path.resolve("scripts/check-private-sourcemaps.mjs")], { cwd: fixture, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(file ? 1 : 0);
    if (file) expect(result.stderr).toContain("Refusing to publish");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
