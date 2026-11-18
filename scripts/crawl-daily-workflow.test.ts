// @vitest-environment node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/crawl-daily.yml", "utf8").replace(/\r\n/g, "\n");
const healthJob = workflow.split("\n  public-holiday-health:\n")[1];
const report = healthJob.split("        run: |\n")[1].replace(/^          /gm, "");
const bash = process.platform === "win32" ? path.join(process.env.ProgramFiles ?? "C:/Program Files", "Git/bin/bash.exe") : "bash";

describe("public holiday health workflow", () => {
  it("waits for publication and permits the Pages deploy to be skipped for Firebase", () => {
    expect(healthJob).toContain(`    needs: [crawl, deploy]
    if: >-
      !cancelled() &&
      needs.crawl.result == 'success' &&
      (needs.deploy.result == 'success' || needs.deploy.result == 'skipped') &&
      needs.crawl.outputs.holiday_result != ''`);
    expect(workflow).toContain("holiday_result: ${{ steps.collect.outputs.holiday_result }}");
  });

  it.each([
    ["first-failure", "error", 1],
    ["still-stale", "error", 1],
    ["recovered", "notice", 0],
  ])("reports %s as an Actions %s", (result, annotation, status) => {
    const detail = "lastAttemptAt=2026-10-04T03:00:00.000Z, lastSuccessAt=2026-10-01T03:00:00.000Z";
    const output = spawnSync(bash, ["--noprofile", "--norc", "-e", "-c", report], {
      encoding: "utf8",
      env: { ...process.env, HOLIDAY_RESULT: result, HOLIDAY_HEALTH: detail },
    });
    expect(output.error).toBeUndefined();
    expect(output.status, output.stderr).toBe(status);
    expect(output.stdout.trim()).toBe(`::${annotation} title=Public holiday collection ${result}::${detail}`);
  });
});
