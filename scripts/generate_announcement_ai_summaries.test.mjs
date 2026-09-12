import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
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
  "announcements-sw.json",
];
const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function runGenerator(overrides, fixtures = {}) {
  const directory = await mkdtemp(
    path.join(tmpdir(), "syu-campus-announcement-ai-"),
  );
  temporaryDirectories.push(directory);
  const dataDirectory = path.join(directory, "public", "data");
  await mkdir(dataDirectory, { recursive: true });
  await Promise.all(
    SOURCE_FILES.map((fileName) =>
      writeFile(
        path.join(dataDirectory, fileName),
        `${JSON.stringify(fixtures.sources?.[fileName] || [])}\n`,
        "utf8",
      ),
    ),
  );
  if (fixtures.metadata) {
    await writeFile(
      path.join(dataDirectory, "announcement-ai-metadata.json"),
      `${JSON.stringify(fixtures.metadata)}\n`,
      "utf8",
    );
  }

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

  it("preserves an unchanged SUPILOT SW summary for future OpenAI runs", async () => {
    const announcement = {
      id: "sw-test",
      title: "SW 프로그램 안내",
      content: "",
      category: "sw",
      date: "2026.09.12",
      author: "SW중심대학사업단",
      views: 1,
      isImportant: false,
      isPinned: false,
    };
    const hash = (value) =>
      createHash("sha256").update(value).digest("hex").slice(0, 16);
    const key = `sw:legacy:${hash(
      [announcement.title, announcement.date, announcement.author].join("\n"),
    )}`;
    const item = {
      summary: "SW 프로그램을 안내합니다.",
      target: "unknown",
      deadline: "unknown",
      requiredAction: "원문 확인",
      keywords: ["SW", "프로그램"],
      importance: "normal",
      confidence: "low",
      generatedAt: "2026-09-12T00:00:00.000Z",
      sourceHash: hash(
        ["sw", announcement.title, announcement.date, announcement.author, "", ""].join(
          "\n",
        ),
      ),
      provider: "supilot",
    };

    const metadata = await runGenerator(
      { ANNOUNCEMENT_AI_ENABLED: "false" },
      {
        sources: { "announcements-sw.json": [announcement] },
        metadata: {
          version: 1,
          generatedAt: "2026-09-12T00:00:00.000Z",
          items: { [key]: item },
        },
      },
    );

    expect(metadata.items[key]).toEqual(item);
  });
});
