// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/sync-to-vercel-repo.yml", "utf8").replace(/\r\n/g, "\n");
const bash = process.platform === "win32" ? path.join(process.env.ProgramFiles ?? "C:/Program Files", "Git/bin/bash.exe") : "bash";
const roots: string[] = [];
const sha = "a".repeat(40), newer = "b".repeat(40);
function script(name: string) {
  return workflow.split(`      - name: ${name}\n`)[1].split("        run: |\n")[1].split(/\n(?:      - name:|  [a-zA-Z_][\w-]*:)/)[0].replace(/^          /gm, "");
}
const mocked = `gh() {
  [[ "$*" == "api repos/syu-kr/campus.syu.kr/git/ref/heads/main --jq .object.sha" ]] || return 91
  [[ "$MOCK_API_FAILURE" == "true" ]] && return 21
  echo "$MOCK_LATEST"
}
git() {
  if [[ "$1" == "-C" && "$2" == "$GITHUB_WORKSPACE" && "$3 $4" == "rev-parse HEAD" ]]; then echo "$MOCK_CHECKOUT"; return 0; fi
  case "$1" in
    config|add) return 0;;
    diff) [[ "$MOCK_UNCHANGED" == "true" ]]; return $?;;
    commit|push) echo "$*" >> "$MOCK_WRITES"; return 0;;
    *) return 92;;
  esac
}
`;
afterEach(() => {
  for (const root of roots.splice(0)) {
    if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith("sync-workflow-")) throw new Error("Unexpected fixture directory");
    rmSync(root, { recursive: true, force: true });
  }
});
function run(name: string, overrides: Record<string, string | undefined> = {}) {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "sync-workflow-")); roots.push(cwd);
  const output = path.join(cwd, "outputs"), writes = path.join(cwd, "writes");
  const result = spawnSync(bash, ["--noprofile", "--norc", "-e", "-c", mocked + script(name)], {
    cwd, encoding: "utf8", env: {
      ...process.env, GITHUB_OUTPUT: output, MOCK_WRITES: writes, GITHUB_WORKSPACE: cwd,
      GITHUB_REPOSITORY: "syu-kr/campus.syu.kr", GITHUB_REF: "refs/heads/main", DESTINATION_DIR: cwd,
      EVENT_NAME: "workflow_run", SOURCE_REF: sha, SOURCE_SHA: sha, VERIFY_BEFORE_SYNC: "true",
      MOCK_LATEST: sha, MOCK_CHECKOUT: sha, MOCK_API_FAILURE: "false", MOCK_UNCHANGED: "false", ...overrides,
    },
  });
  const read = (file: string) => { try { return readFileSync(file, "utf8"); } catch { return ""; } };
  return { ...result, outputs: read(output), writes: read(writes) };
}

describe("latest verified Vercel mirror source", () => {
  it("queues only eligible writes by destination without canceling another write", () => {
    expect(workflow).toContain("github.event.workflow_run.head_repository.full_name == github.repository");
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(workflow).toContain("group: sync-to-vercel-repo-${{ vars.VERCEL_DESTINATION_REPO }}-main");
    expect(workflow).toContain("cancel-in-progress: false\n      queue: max");
    expect(workflow).toContain("if: needs.source.outputs.sync == 'true'");
    expect(workflow).toContain("ref: ${{ needs.source.outputs.sha }}");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow.match(/if: steps.current.outputs.sync == 'true'/g)).toHaveLength(3);
  });
  it.each(["main", "refs/heads/main"])("pins manual %s to the exact latest SHA before checkout", source => {
    const result = run("Validate sync source", { EVENT_NAME: "workflow_dispatch", SOURCE_REF: source });
    expect(result.status, result.stderr).toBe(0); expect(result.outputs).toContain(`sha=${sha}\nsync=true\n`);
  });
  it("skips an obsolete successful event before checkout or queueing a write", () => {
    const result = run("Validate sync source", { MOCK_LATEST: newer });
    expect(result.status, result.stderr).toBe(0); expect(result.outputs).toBe("sync=false\n");
  });
  it.each([
    { SOURCE_REF: "untrusted-ref" }, { EVENT_NAME: "workflow_dispatch", SOURCE_REF: sha },
    { EVENT_NAME: "push", GITHUB_REF: "refs/heads/feature" },
    { EVENT_NAME: "push", VERIFY_BEFORE_SYNC: "false" }, { MOCK_API_FAILURE: "true" }, { MOCK_LATEST: "main" },
  ])("does not authorize invalid or unverified sources: %j", overrides => {
    const result = run("Validate sync source", overrides);
    expect(result.status).not.toBe(0); expect(result.outputs).not.toContain("sync=true");
  });
  it("allows only the pinned latest checkout through the copy gate", () => {
    const result = run("Verify latest source before copying");
    expect(result.status, result.stderr).toBe(0); expect(result.outputs).toContain("sync=true\n");
  });
  it("skips a source superseded while verification was running", () => {
    const result = run("Verify latest source before copying", { MOCK_LATEST: newer });
    expect(result.status, result.stderr).toBe(0); expect(result.outputs).toBe("sync=false\n");
  });
  it("skips a source superseded after files were copied", () => {
    const result = run("Push changes to destination repository", { MOCK_LATEST: newer });
    expect(result.status, result.stderr).toBe(0); expect(result.writes).toBe("");
  });
  it.each(["Verify latest source before copying", "Push changes to destination repository"])("fails closed at %s", name => {
    for (const overrides of [{ MOCK_API_FAILURE: "true" }, { MOCK_CHECKOUT: newer }, { SOURCE_SHA: "main" }, { MOCK_LATEST: "invalid" }]) {
      const result = run(name, overrides);
      expect(result.status).not.toBe(0); expect(result.outputs).not.toContain("sync=true"); expect(result.writes).toBe("");
    }
  });
  it("does not create another commit for an already mirrored SHA", () => {
    const result = run("Push changes to destination repository", { MOCK_UNCHANGED: "true" });
    expect(result.status, result.stderr).toBe(0); expect(result.writes).toBe("");
  });
  it("pushes changed contents only after checking the explicit source repository", () => {
    const result = run("Push changes to destination repository");
    expect(result.status, result.stderr).toBe(0); expect(result.writes).toContain("commit -m chore: sync syu-campus for Vercel deployment\npush origin main\n");
  });
});
