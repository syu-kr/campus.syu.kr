import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const require = createRequire(path.join(projectRoot, "package.json"));
const adapterPath = require.resolve("fast-glob");
let fixture: string;

beforeAll(() => {
  fixture = mkdtempSync(path.join(tmpdir(), "syu-eslint-root-glob-"));
  for (const directory of ["packages/web/pages", "packages/admin/app", "packages/.hidden/app"]) {
    mkdirSync(path.join(fixture, directory), { recursive: true });
  }
  writeFileSync(path.join(fixture, "packages/web/pages/about.tsx"), "export default function About() { return null; }");
  writeFileSync(path.join(fixture, "packages/readme.txt"), "not a directory");
  symlinkSync(path.join(fixture, "packages/web"), path.join(fixture, "packages/linked"), "junction");
});

afterAll(() => {
  if (!path.resolve(fixture).startsWith(path.resolve(tmpdir()) + path.sep)) {
    throw new Error("Fixture cleanup must stay inside the temporary directory");
  }
  rmSync(fixture, { recursive: true, force: true });
});

// A separate process supplies cwd without changing Vitest's shared working directory.
const probe = String.raw`
const path = require('node:path');
const adapter = require(process.argv[1]);
const projectRoot = process.argv[2];
const input = JSON.parse(process.argv[3]);
const { createRequire } = require('node:module');
const fs = require('node:fs');
const pluginRequire = createRequire(require.resolve('@next/eslint-plugin-next', { paths: [projectRoot] }));
require('node:assert/strict').equal(fs.realpathSync(process.argv[1]), fs.realpathSync(path.join(projectRoot, 'vendor/eslint-root-glob/index.cjs')));
require('node:assert/strict').equal(fs.realpathSync(pluginRequire.resolve('fast-glob')), fs.realpathSync(process.argv[1]));
(async () => {
  if (input.mode === 'readFailure') {
    require('node:fs').readdirSync = () => { throw Object.assign(new Error('denied'), {code:'EACCES'}); };
    try { adapter.globSync('packages/*', {onlyDirectories:true}); console.log(JSON.stringify({result:[]})); }
    catch (error) { console.log(JSON.stringify({error:error.code})); }
    return;
  }
  if (input.mode === 'lint') {
    const { ESLint } = require(path.join(projectRoot, 'node_modules/eslint'));
    const eslint = new ESLint({
      cwd: process.cwd(), overrideConfigFile: path.join(projectRoot, 'eslint.config.mjs'),
      overrideConfig: [{ settings: { next: { rootDir: 'packages/{web,admin}' } } }],
    });
    const filename = 'packages/web/pages/probe.tsx';
    const config = await eslint.calculateConfigForFile(filename);
    const result = await eslint.lintText('export default function Probe() { return <div><a href="/about">About</a><img src="/image.png" /></div>; }', { filePath: filename });
    const ignores = await Promise.all(['.next/probe.tsx', 'node_modules/probe.tsx', 'next-env.d.ts', 'app/probe.tsx'].map(name => eslint.isPathIgnored(name)));
    console.log(JSON.stringify({ messages: result[0].messages.map(({ruleId,severity}) => ({ruleId,severity})), ignores, nextRule: config.rules['@next/next/no-html-link-for-pages'][0], parser: config.languageOptions.parser.meta.name }));
    return;
  }
  if (input.mode === 'roots') {
    let calls = 0;
    const originalGlob = adapter.globSync;
    adapter.globSync = (...args) => { calls++; return originalGlob(...args); };
    const { getRootDirs } = require(path.join(projectRoot, 'node_modules/@next/eslint-plugin-next/dist/utils/get-root-dirs.js'));
    console.log(JSON.stringify({ roots: getRootDirs(input.context), calls }));
    return;
  }
  const values = input.cases.map(({pattern,options}) => {
    try { return { result: adapter.globSync(pattern, options ?? {onlyDirectories:true}) }; }
    catch (error) { return { error: error.name, message: error.message }; }
  });
  console.log(JSON.stringify(values));
})().catch(error => { console.error(error); process.exitCode = 1; });
`;

function runProbe(input: unknown) {
  const result = spawnSync(process.execPath, ["-e", probe, adapterPath, projectRoot, JSON.stringify(input)], {
    cwd: fixture, encoding: "utf8", timeout: 10_000,
  });
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout.trim());
}

function canonicalRoots(values: string[]) {
  return values.map((value) => path.resolve(fixture, value).replace(/\\/g, "/")).sort();
}

describe("Next ESLint root glob adapter", () => {
  it("fails closed when wildcard directory reads are denied", () => {
    expect(runProbe({ mode: "readFailure" })).toEqual({ error: "EACCES" });
  });
  it("preserves literal, relative, absolute and trailing-slash directory roots", () => {
    const patterns = ["packages/web", "./packages/web", "packages/web/", path.join(fixture, "packages/web").replace(/\\/g, "/")];
    const results = runProbe({ cases: patterns.map((pattern) => ({ pattern })) });
    for (const entry of results) expect(canonicalRoots(entry.result)).toEqual(canonicalRoots(["packages/web"]));
    expect(runProbe({ cases: [{ pattern: "missing" }, { pattern: "packages/readme.txt" }] })).toEqual([{ result: [] }, { result: [] }]);
  });

  it("preserves wildcard, literal brace, hidden and junction directory roots", () => {
    const patterns = ["packages/*", "packages/*/", "packages/{web,admin}", "packages/{web,admin}/", "packages/{web,web}", "packages/.*", "packages/linked", "packages/link*", path.join(fixture, "packages/*").replace(/\\/g, "/")];
    const expected = [["packages/admin", "packages/linked", "packages/web"], ["packages/admin", "packages/linked", "packages/web"], ["packages/web", "packages/admin"], ["packages/web", "packages/admin"], ["packages/web"], ["packages/.hidden"], ["packages/linked"], ["packages/linked"], ["packages/admin", "packages/linked", "packages/web"]];
    const results = runProbe({ cases: patterns.map((pattern) => ({ pattern })) });
    results.forEach((entry: { result: string[] }, index: number) => expect(canonicalRoots(entry.result)).toEqual(canonicalRoots(expected[index])));
  });

  it("rejects unsupported syntax and options rather than silently dropping roots", () => {
    const patterns = ["packages/**", "packages/*/app", "packages/@(web|admin)", "packages/{web/,admin/}", "packages/{web,}", "packages/{web,{admin,other}}", "packages/{1..3}", "packages/??", "packages/{*,web}", ["packages/*"], "{".repeat(1500) + "web" + "}".repeat(1500)];
    const results = runProbe({ cases: [...patterns.map((pattern) => ({ pattern })), { pattern: "packages/*", options: { onlyDirectories: true, dot: true } }, { pattern: "packages/*", options: { onlyDirectories: false } }] });
    for (const entry of results) expect(entry.error).toBe("TypeError");
  });

  it("retains Next default cwd without globbing and maps string/array settings", () => {
    expect(runProbe({ mode: "roots", context: { cwd: "default-cwd", settings: {} } })).toEqual({ roots: ["default-cwd"], calls: 0 });
    const single = runProbe({ mode: "roots", context: { cwd: fixture, settings: { next: { rootDir: "packages/{web,admin}" } } } });
    expect(canonicalRoots(single.roots)).toEqual(canonicalRoots(["packages/web", "packages/admin"]));
    const multiple = runProbe({ mode: "roots", context: { cwd: fixture, settings: { next: { rootDir: ["packages/web", "packages/link*", "!packages/admin", 42] } } } });
    expect(canonicalRoots(multiple.roots)).toEqual(canonicalRoots(["packages/web", "packages/linked"]));
    expect(multiple.calls).toBe(3);
  });

  it("keeps real Next link diagnostics, React accessibility rules and global ignores", () => {
    const result = runProbe({ mode: "lint" });
    expect(result.messages).toEqual(expect.arrayContaining([
      { ruleId: "@next/next/no-html-link-for-pages", severity: 2 },
      { ruleId: "@next/next/no-img-element", severity: 1 },
      { ruleId: "jsx-a11y/alt-text", severity: 1 },
    ]));
    expect(result.nextRule).toBe(2);
    expect(result.parser).toBe("typescript-eslint/parser");
    expect(result.ignores).toEqual([true, true, true, false]);
  }, 15_000);
});
