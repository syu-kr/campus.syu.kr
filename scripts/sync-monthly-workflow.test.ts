// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/crawl-monthly.yml", "utf8").replace(/\r\n/g, "\n");
const runScript = workflow.split("      - name: Open monthly crawl pull request\n")[1].split("        run: |\n")[1].replace(/^          /gm, "");
const bash = process.platform === "win32" ? path.join(process.env.ProgramFiles ?? "C:/Program Files", "Git/bin/bash.exe") : "bash";
const roots: string[] = [];
const mocked = `git() {
  if [[ "$*" == "diff --name-only -z HEAD" ]]; then printf '%s\\0' "$MOCK_PATH"; return 0; fi
  if [[ "$*" == "ls-files --others --exclude-standard -z" ]]; then return 0; fi
  if [[ "$1" == "config" || "$1" == "add" ]]; then return 0; fi
  if [[ "$*" == "diff --cached --quiet" ]]; then [[ "$MOCK_CASE" == "unchanged" ]]; return $?; fi
  if [[ "$*" == "diff --cached --binary -- public/data/phone-*.json public/data/schedules-*.json" ]]; then printf '%s' 'fixed data diff'; return 0; fi
  if [[ "$1" == "ls-remote" ]]; then
    [[ "$MOCK_CASE" == "remote-failure" ]] && return 28
    case "$MOCK_CASE" in existing|pr-recovery|data-conflict) echo 'existing-remote-sha';; esac
    return 0
  fi
  if [[ "$1" == "fetch" ]]; then return 0; fi
  if [[ "$2 $3 $4" == "--cached --quiet FETCH_HEAD" ]]; then [[ "$MOCK_CASE" != "data-conflict" ]]; return $?; fi
  case "$1" in switch|commit|push) echo "git $*" >> "$MOCK_TRACE"; return 0;; esac
  return 90
}
gh() {
  echo "gh $*" >> "$MOCK_TRACE"
  if [[ "$1 $2" == "pr list" ]]; then
    [[ "$MOCK_CASE" == "existing" ]] && echo 42
    return 0
  fi
  if [[ "$1 $2" == "pr create" ]]; then
    [[ "$MOCK_CASE" == "create-denied" ]] && return 37
    return 0
  fi
  return 91
}
`;
afterEach(() => {
  for (const root of roots.splice(0)) {
    if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith("monthly-workflow-")) throw new Error("Unexpected fixture directory");
    rmSync(root, { recursive: true, force: true });
  }
});
function run(scenario: string, attempt = "1", changedPath = "public/data/schedules-major.json") {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "monthly-workflow-")); roots.push(cwd);
  const trace = path.join(cwd, "trace");
  const result = spawnSync(bash, ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", mocked + runScript], {
    cwd, encoding: "utf8", env: { ...process.env, MOCK_CASE: scenario, MOCK_PATH: changedPath, MOCK_TRACE: trace, GITHUB_RUN_ID: "100", GITHUB_RUN_ATTEMPT: attempt, GITHUB_REPOSITORY: "syu-kr/campus.syu.kr", GITHUB_STEP_SUMMARY: path.join(cwd, "summary") },
  });
  let calls = ""; try { calls = readFileSync(trace, "utf8"); } catch { /* A no-op need not contact GitHub. */ }
  let summary = ""; try { summary = readFileSync(path.join(cwd, "summary"), "utf8"); } catch { /* Successful runs do not need recovery instructions. */ }
  return { ...result, calls, summary };
}
describe("reviewed monthly crawl PR", () => {
  it("runs only on trusted main and preserves data validation before opening a PR", () => {
    expect(workflow).toContain("github.repository == 'syu-kr/campus.syu.kr' && github.ref == 'refs/heads/main'");
    expect(workflow.indexOf("python scripts/check_monthly_crawl_data.py")).toBeLessThan(workflow.indexOf("gh pr create"));
    expect(workflow).not.toContain("--publish");
    expect(workflow).toContain("shell: bash");
  });
  it("creates one data-only branch and reviewed PR", () => {
    const result = run("normal");
    expect(result.status, result.stderr).toBe(0);
    expect(result.calls.match(/git push /g)).toHaveLength(1);
    expect(result.calls.match(/gh pr create /g)).toHaveLength(1);
    expect(result.calls).toMatch(/automation\/monthly-reference-data-[a-f0-9]{64}/);
  });
  it("uses the same content branch across attempts", () => {
    const first = run("normal", "1"), second = run("normal", "2");
    expect(first.status, first.stderr).toBe(0); expect(second.status, second.stderr).toBe(0);
    expect(first.calls.match(/automation\/monthly-reference-data-[a-f0-9]{64}/)?.[0]).toBe(second.calls.match(/automation\/monthly-reference-data-[a-f0-9]{64}/)?.[0]);
  });
  it("reuses an existing matching PR without committing or pushing again", () => {
    const result = run("existing");
    expect(result.status, result.stderr).toBe(0); expect(result.stdout).toContain("#42");
    expect(result.calls).not.toMatch(/git (commit|push)|gh pr create/);
  });
  it("recovers PR creation after the data branch was already pushed", () => {
    const result = run("pr-recovery");
    expect(result.status, result.stderr).toBe(0); expect(result.calls).toContain("gh pr create");
    expect(result.calls).not.toMatch(/git (commit|push)/);
  });
  it("does nothing for an unchanged dataset", () => {
    const result = run("unchanged");
    expect(result.status, result.stderr).toBe(0); expect(result.calls).toBe("");
  });
  it.each(["app/page.tsx", "public/data/phone-unexpected/nested.json"])("rejects a change outside the monthly files: %s", changed => {
    const result = run("normal", "1", changed);
    expect(result.status).not.toBe(0); expect(result.calls).toBe("");
  });
  it.each(["data-conflict", "remote-failure"])("does not overwrite or create a PR after %s", scenario => {
    const result = run(scenario);
    expect(result.status).not.toBe(0); expect(result.calls).not.toMatch(/git (commit|push)|gh pr create/);
  });
  it("reports a repository/org PR policy denial as a failure", () => {
    const result = run("create-denied");
    expect(result.status).toBe(37); expect(result.calls).toContain("git push");
    expect(result.summary).toContain("data has not been merged or published");
    expect(result.summary).toContain("https://github.com/syu-kr/campus.syu.kr/compare/main...automation/monthly-reference-data-");
  });
});
