// @vitest-environment node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("student restaurant workflow security", () => {
  it("restricts secret collection to scheduled or manual main runs and serializes all Pages publishers", async () => {
    const workflow = await readFile(path.join(process.cwd(), ".github/workflows/student-restaurant.yml"), "utf8");
    const triggers = workflow.split("permissions:")[0];
    expect(triggers).toContain("schedule:");
    expect(triggers).toContain("workflow_dispatch:");
    expect(triggers).toContain('cron: "0 22 * * 0"');
    expect(triggers).toContain('cron: "0 0 * * 1"');
    expect(triggers).not.toMatch(/pull_request|push:|workflow_run/);
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).not.toContain("contents: write");
    for (const file of ["student-restaurant.yml", "crawl-daily.yml", "rollback-crawl-data.yml"]) {
      expect(await readFile(path.join(process.cwd(), ".github/workflows", file), "utf8"))
        .toContain("group: crawl-data-pages\n  cancel-in-progress: false");
    }

    const secretSteps = workflow.split(/\n      - name:/).filter((step) => step.includes("secrets."));
    expect(secretSteps).toHaveLength(1);
    expect(secretSteps[0]).toContain("Collect and validate 만나의집 menu");
    expect(secretSteps[0]).toContain("HAKSIK_API_URL: ${{ secrets.HAKSIK_API_URL }}");
    expect(secretSteps[0]).toContain("OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}");
    expect(secretSteps[0]).toContain("run: npm run collect:student-restaurant");
  });

  it("persists only successful internal state after deployment and uploads only prepared public artifacts", async () => {
    const workflow = await readFile(path.join(process.cwd(), ".github/workflows/student-restaurant.yml"), "utf8");
    const steps = workflow.split(/\n      - name:/);
    const upload = steps.find((step) => step.includes("actions/upload-pages-artifact@"))!;
    expect(upload).toContain("path: ${{ runner.temp }}/crawl-data-pages-${{ github.run_id }}");
    expect(upload).not.toMatch(/path: (?:\.|public|\.cache)\s*$/m);
    const saveIndex = workflow.indexOf("name: Save successful internal image state");
    expect(saveIndex).toBeGreaterThan(workflow.indexOf("uses: actions/deploy-pages@"));
    const save = workflow.slice(saveIndex);
    expect(save).toContain("if: success() && (steps.deployment.outcome == 'success' || steps.prepare.outputs.changed == 'false')");
    expect(save).toContain("path: .cache/student-restaurant/state.json");
    expect(workflow).not.toMatch(/uses: actions\/cache@|upload-artifact@|set -x|printenv/);
  });
});
