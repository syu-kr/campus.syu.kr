// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/publish-reference-data.yml", "utf8").replace(/\r\n/g, "\n");
const monthly = readFileSync(".github/workflows/crawl-monthly.yml", "utf8");
const ci = readFileSync(".github/workflows/ci.yml", "utf8").replace(/\r\n/g, "\n");
const guard = workflow.split("      - name: Verify trusted latest main")[1]
  .split("        run: |\n")[1].split("\n      - name:")[0].replace(/^          /gm, "");
const bash = process.platform === "win32" ? path.join(process.env.ProgramFiles ?? "C:/Program Files", "Git/bin/bash.exe") : "bash";
const roots: string[] = [];
const sha = "a".repeat(40), newer = "b".repeat(40);
const invalidSources: Record<string, string>[] = [{ SOURCE_SHA: "main" }, { MOCK_CHECKOUT: newer }, { MOCK_API_FAILURE: "true" }];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function runGuard(overrides: Record<string, string> = {}) {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "reference-workflow-"));
  roots.push(cwd);
  const output = path.join(cwd, "outputs");
  const mocked = `git() { [[ "$*" == "rev-parse HEAD" ]] || return 91; echo "$MOCK_CHECKOUT"; }
gh() { [[ "$*" == "api repos/syu-kr/campus.syu.kr/git/ref/heads/main --jq .object.sha" ]] || return 92; [[ "$MOCK_API_FAILURE" == "true" ]] && return 21; echo "$MOCK_LATEST"; }
`;
  const result = spawnSync(bash, ["--noprofile", "--norc", "-e", "-c", mocked + guard], {
    cwd, encoding: "utf8", env: { ...process.env, SOURCE_SHA: sha, GITHUB_REPOSITORY: "syu-kr/campus.syu.kr", GITHUB_OUTPUT: output, MOCK_CHECKOUT: sha, MOCK_LATEST: sha, MOCK_API_FAILURE: "false", ...overrides },
  });
  let outputs = "";
  try { outputs = readFileSync(output, "utf8"); } catch { /* A rejected source must not enable publishing. */ }
  return { ...result, outputs };
}

describe("reviewed reference data publication", () => {
  it("uses the CI-verified Node version and setup action", () => {
    const setup = ci.match(/uses: (actions\/setup-node@[a-f0-9]{40})[^\n]*\n\s+with:\n\s+node-version: "([^"]+)"/);
    expect(setup).not.toBeNull();
    expect(workflow).toContain(`uses: ${setup![1]}`);
    expect(workflow).toContain(`node-version: "${setup![2]}"`);
  });
  it("requires successful same-repository main push CI and an explicit Firebase backend", () => {
    for (const requirement of [
      "vars.PUBLIC_DATA_BACKEND == 'firebase'",
      "github.event.workflow_run.conclusion == 'success'",
      "github.event.workflow_run.head_repository.full_name == github.repository",
      "github.event.workflow_run.head_branch == 'main'",
      "github.event.workflow_run.event == 'push'",
      "ref: ${{ github.event.workflow_run.head_sha }}",
      "persist-credentials: false",
      "group: public-data-firebase",
      "cancel-in-progress: false",
    ]) expect(workflow).toContain(requirement);
    expect(workflow).not.toContain("pull_request_target");
    expect(workflow).not.toContain("workflow_dispatch:");
  });
  it("publishes only the exact verified latest main commit", () => {
    const result = runGuard();
    expect(result.error).toBeUndefined(); expect(result.status, result.stderr).toBe(0);
    expect(result.outputs).toBe("publish=true\n");
  });
  it("skips an older successful run rather than rolling reference data backward", () => {
    const result = runGuard({ MOCK_LATEST: newer });
    expect(result.status, result.stderr).toBe(0); expect(result.outputs).toBe("publish=false\n");
  });
  it.each(invalidSources)("fails closed for invalid source, wrong checkout or GitHub read failure: %j", overrides => {
    const result = runGuard(overrides);
    expect(result.status).not.toBe(0); expect(result.outputs).not.toContain("publish=true");
  });
  it("keeps collection as a reviewed PR and detects content without a last-commit-only diff", () => {
    expect(monthly).toContain("gh pr create");
    expect(monthly).toContain('--base main');
    expect(monthly).not.toContain("--publish");
    expect(workflow).toContain("npm run data:snapshot -- --publish --scope reference");
    expect(workflow).not.toContain("HEAD^");
    expect(workflow).toContain("if: steps.current.outputs.publish == 'true'");
  });
});
