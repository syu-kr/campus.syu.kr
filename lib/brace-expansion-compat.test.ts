import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

type BraceExpansion = {
  (pattern: string): string[];
  expand(pattern: string): string[];
};

const require = createRequire(import.meta.url);
const braceExpansion = require(
  "../vendor/brace-expansion-compat/index.cjs",
) as BraceExpansion;

describe("brace-expansion compatibility adapter", () => {
  it("supports the legacy callable CommonJS export", () => {
    expect(braceExpansion("file{1..3}.txt")).toEqual([
      "file1.txt",
      "file2.txt",
      "file3.txt",
    ]);
  });

  it("supports the named expand export used by current minimatch", () => {
    expect(braceExpansion.expand("day{mon,tue}.json")).toEqual([
      "daymon.json",
      "daytue.json",
    ]);
  });
});
