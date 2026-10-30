// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("keeps CodeQL initialization and analysis on one immutable release", () => {
  const workflow = readFileSync(".github/workflows/codeql.yml", "utf8");
  const refs = [...workflow.matchAll(/uses: github\/codeql-action\/(init|analyze)@([a-f0-9]{40})/g)];
  expect(refs.map(ref => ref[1]).sort()).toEqual(["analyze", "init"]);
  expect(new Set(refs.map(ref => ref[2])).size).toBe(1);
});
