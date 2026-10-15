// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/indexnow.yml", "utf8").replace(/\r\n/g, "\n");
const restore = workflow.split("      - name: Restore latest trusted IndexNow state")[1]
  .split("        run: |\n")[1].split("\n      - name:")[0].replace(/^          /gm, "");
const bash = process.platform === "win32" ? path.join(process.env.ProgramFiles ?? "C:/Program Files", "Git/bin/bash.exe") : "bash";
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

const ghMock = `gh() {
  if [[ "$*" == *"/actions/workflows/indexnow.yml"* ]]; then
    [[ "$MOCK_CASE" == "workflow-failure" ]] && return 21
    echo 77; return 0
  fi
  if [[ "$*" == *"/actions/artifacts"* ]]; then
    [[ "$MOCK_CASE" == "list-failure" ]] && return 22
    [[ "$*" == *".created_at, .id, .workflow_run.id"* ]] || return 99
    printf '%s\\n' "$MOCK_ROWS"; return 0
  fi
  if [[ "$*" == *"/artifacts?per_page=100"* ]]; then
    [[ "$MOCK_CASE" == "count-failure" ]] && return 24
    if [[ "$MOCK_CASE" == "ambiguous" ]]; then echo 2; else echo 1; fi
    return 0
  fi
  if [[ "$*" == *"/actions/runs/"* ]]; then
    [[ "$MOCK_CASE" == "run-failure" ]] && return 23
    if [[ "$*" == *"/runs/999"* ]]; then echo false; else echo true; fi
    return 0
  fi
  if [[ "$1 $2" == "run download" ]]; then
    [[ "$MOCK_CASE" == "download-failure" ]] && return 25
    [[ "$MOCK_CASE" == "missing-state" ]] && return 0
    printf '{"sourceRun":"%s"}\\n' "$3" > .cache/indexnow/state.json
    return 0
  fi
  return 99
}
`;

function runRestore(rows: string, scenario = "normal") {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "indexnow-workflow-"));
  roots.push(cwd);
  const result = spawnSync(bash, ["--noprofile", "--norc", "-e", "-c", ghMock + restore], {
    cwd, encoding: "utf8", env: { ...process.env, GITHUB_REPOSITORY: "syu-kr/campus.syu.kr", GITHUB_RUN_ID: "100", GITHUB_RUN_ATTEMPT: "2", MOCK_ROWS: rows, MOCK_CASE: scenario },
  });
  return { ...result, cwd };
}

describe("IndexNow workflow state restoration", () => {
  it("validates artifact ownership against the known main workflow", () => {
    for (const guard of [".workflow_id == (env.INDEXNOW_WORKFLOW_ID | tonumber)", ".head_repository.full_name == env.GITHUB_REPOSITORY", '.head_branch == "main"', '.path == ".github/workflows/indexnow.yml"', '.event == "workflow_run" or .event == "workflow_dispatch"']) expect(restore).toContain(guard);
  });
  it.each([
    ["newer completed run", "2026-10-15T10:00:00Z\t900\t100\n2026-10-15T11:00:00Z\t901\t201", "201"],
    ["newer artifact from an older rerun", "2026-10-15T11:00:00Z\t901\t201\n2026-10-15T12:00:00Z\t902\t100", "100"],
    ["numeric artifact ID breaks timestamp ties", "2026-10-15T12:00:00Z\t900\t201\n2026-10-15T12:00:00Z\t1000\t100", "100"],
    ["untrusted artifact skipped", "2026-10-15T12:00:00Z\t9999\t999\n2026-10-15T11:00:00Z\t901\t201", "201"],
  ])("uses the latest trusted artifact: %s", (_name, rows, expectedRun) => {
    const result = runRestore(rows);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(readFileSync(path.join(result.cwd, ".cache/indexnow/state.json"), "utf8"))).toEqual({ sourceRun: expectedRun });
  });
  it("establishes a baseline only when no trusted state exists", () => {
    const result = runRestore("");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("establish a baseline");
  });
  it.each([
    ["workflow-failure", 21], ["list-failure", 22], ["run-failure", 23],
    ["count-failure", 24], ["download-failure", 25], ["missing-state", 1], ["ambiguous", 1],
  ])("fails closed on %s", (scenario, status) => {
    const result = runRestore("2026-10-15T11:00:00Z\t901\t201", scenario);
    expect(result.status, result.stderr).toBe(status);
    expect(result.stdout).not.toContain("establish a baseline");
  });
});
