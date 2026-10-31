import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";

const require = createRequire(import.meta.url);
// Intentionally inspect transitive packages from their real consumers, not new direct dependencies.

it.each(["eslint", "eslint-plugin-react", "eslint-plugin-import", "eslint-plugin-jsx-a11y", "@eslint/config-array"])(
  "preserves callable matching for %s using patched upstream", consumer => {
    const scopedRequire = createRequire(require.resolve(consumer));
    const match = scopedRequire("minimatch");
    const patched = require("minimatch-v11");
    expect(match).toBe(patched.minimatch);
    expect(match("app/page.tsx", "**/*.{ts,tsx}")).toBe(true);
    expect(match("app/page.js", "**/*.tsx")).toBe(false);
    expect(match(".hidden.ts", "*.ts")).toBe(false);
    expect(match.defaults({ dot: true })(".hidden.ts", "*.ts")).toBe(true);
    expect(new match.Minimatch("**/*.tsx").match("app/page.tsx")).toBe(true);
    expect(match.match(["a.ts", "b.js"], "*.ts")).toEqual(["a.ts"]);
  },
);

it("preserves named matching for TypeScript ESLint and sync/async globbing for Sentry", async () => {
  const scopedRequire = createRequire(require.resolve("@typescript-eslint/typescript-estree/package.json"));
  const { minimatch, Minimatch } = scopedRequire("minimatch");
  expect(minimatch("app/page.tsx", "**/*.tsx")).toBe(true);
  expect(new Minimatch("**/*.ts").match("lib/home.ts")).toBe(true);
  const sentryRequire = createRequire(require.resolve("@sentry/bundler-plugin-core"));
  const { glob, globSync } = sentryRequire("glob");
  const esm = await import(pathToFileURL(require.resolve("minimatch")).href);
  expect(esm.Minimatch).toBe(Minimatch);
  expect(esm.minimatch).toBe(minimatch);
  const options = { cwd: path.resolve("vendor/minimatch-legacy"), nodir: true };
  expect(globSync("*.cjs", options)).toEqual(["index.cjs"]);
  expect(await glob("*.cjs", options)).toEqual(["index.cjs"]);
});
