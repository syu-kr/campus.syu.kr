import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const SCRIPT_PATH = path.resolve(
  process.cwd(),
  "scripts",
  "generate_announcement_ai_summaries.mjs",
);
const SOURCE_FILES = [
  "announcements-academic.json",
  "announcements-campus-life.json",
  "announcements-scholarship.json",
  "announcements-events.json",
  "announcements-departments.json",
];
const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function runGenerator(overrides) {
  const directory = await mkdtemp(
    path.join(tmpdir(), "syu-campus-announcement-ai-"),
  );
  temporaryDirectories.push(directory);
  const dataDirectory = path.join(directory, "public", "data");
  await mkdir(dataDirectory, { recursive: true });
  await Promise.all(
    SOURCE_FILES.map((fileName) =>
      writeFile(path.join(dataDirectory, fileName), "[]\n", "utf8"),
    ),
  );

  await execFileAsync(process.execPath, [SCRIPT_PATH], {
    cwd: directory,
    env: {
      ...process.env,
      OPENAI_API_KEY: "",
      ANNOUNCEMENT_AI_DELAY_MS: "0",
      ...overrides,
    },
  });

  return JSON.parse(
    await readFile(
      path.join(dataDirectory, "announcement-ai-metadata.json"),
      "utf8",
    ),
  );
}

describe("announcement AI metadata artifact", () => {
  it("creates an empty artifact when AI generation is disabled", async () => {
    const metadata = await runGenerator({ ANNOUNCEMENT_AI_ENABLED: "false" });

    expect(metadata).toMatchObject({ version: 1, items: {} });
    expect(metadata.generatedAt).toEqual(expect.any(String));
  });

  it("creates an empty artifact when OPENAI_API_KEY is missing", async () => {
    const metadata = await runGenerator({ ANNOUNCEMENT_AI_ENABLED: "true" });

    expect(metadata).toMatchObject({ version: 1, items: {} });
    expect(metadata.generatedAt).toEqual(expect.any(String));
  });
});
