import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAnnouncementDetailContent, loadLocalEnvFiles } from "./generate_announcement_ai_summaries.mjs";

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
  vi.unstubAllGlobals();
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("announcement local environment", () => {
  it("uses standard env syntax, existing exports and local-file precedence within the whitelist", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "syu-campus-announcement-ai-"));
    temporaryDirectories.push(directory);
    await writeFile(path.join(directory, ".env.local"), [
      "# OPENAI_API_KEY=commented",
      'export OPENAI_API_KEY="fixture#value" # inline comment',
      "ANNOUNCEMENT_AI_ENABLED=false # disabled",
      "ANNOUNCEMENT_AI_REFRESH_SINCE='2026-10-01\n'",
      "UNRELATED_SCRIPT_ENV=untrusted",
      "GITHUB_STEP_SUMMARY=untrusted-write-path",
    ].join("\r\n"));
    await writeFile(path.join(directory, ".env"), "OPENAI_API_KEY=fallback\nANNOUNCEMENT_AI_ENABLED=true\nANNOUNCEMENT_AI_LIMIT=2");
    const environment = { ANNOUNCEMENT_AI_LIMIT: "7" };
    loadLocalEnvFiles(directory, environment);
    expect(environment).toEqual({
      OPENAI_API_KEY: "fixture#value", ANNOUNCEMENT_AI_ENABLED: "false",
      ANNOUNCEMENT_AI_REFRESH_SINCE: "2026-10-01\n", ANNOUNCEMENT_AI_LIMIT: "7",
    });
  });
});

describe("school announcement detail redirects", () => {
  const content = "학교 공지사항 본문입니다. ".repeat(12).trim();
  const html = () => new Response(`<article><p>${content}</p></article>`, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
  const redirect = (location) => new Response(null, { status: 302, headers: { location } });

  it("keeps relative school redirects and HTTP to HTTPS upgrades within one timeout", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(redirect("https://www.syu.ac.kr/notice/1"))
      .mockResolvedValueOnce(redirect("../notice/2"))
      .mockResolvedValueOnce(html());
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchAnnouncementDetailContent("http://www.syu.ac.kr/notice/1", 1000)).toBe(content);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://www.syu.ac.kr/notice/1", "https://www.syu.ac.kr/notice/1", "https://www.syu.ac.kr/notice/2",
    ]);
    const options = fetchMock.mock.calls.map(([, option]) => option);
    expect(options.every((option) => option.redirect === "manual" && option.signal === options[0].signal)).toBe(true);
  });

  it.each(["https://external.example/notice", "https://syu.ac.kr.external.example/notice", "https://user:password@www.syu.ac.kr/notice", "https://www.syu.ac.kr:8443/notice"])(
    "blocks disallowed hop %s before requesting it", async (target) => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const fetchMock = vi.fn().mockResolvedValueOnce(redirect("/notice/2")).mockResolvedValueOnce(redirect(target));
      vi.stubGlobal("fetch", fetchMock);
      expect(await fetchAnnouncementDetailContent("https://www.syu.ac.kr/notice/1", 1000)).toBeNull();
      expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
        "https://www.syu.ac.kr/notice/1", "https://www.syu.ac.kr/notice/2",
      ]);
    },
  );

  it("bounds school redirect loops", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockImplementation(async () => redirect("/notice/loop"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchAnnouncementDetailContent("https://www.syu.ac.kr/notice/1", 1000)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
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

  it("redacts contact details from preserved summaries", async () => {
    const announcement = {
      id: "academic-contact",
      title: "문의 안내",
      content: "",
      category: "academic",
      date: "2026.09.12",
      author: "교무처",
      views: 1,
      isImportant: false,
      isPinned: false,
    };
    const hash = (value) =>
      createHash("sha256").update(value).digest("hex").slice(0, 16);
    const key = `academic:legacy:${hash(
      [announcement.title, announcement.date, announcement.author].join("\n"),
    )}`;
    const item = {
      summary: "student@example.com 또는 010-1234-5678로 문의하세요.",
      target: "재학생",
      deadline: "unknown",
      requiredAction: "담당자에게 문의",
      keywords: ["문의", "학사"],
      importance: "normal",
      confidence: "low",
      generatedAt: "2026-09-12T00:00:00.000Z",
      sourceHash: hash(
        ["academic", announcement.title, announcement.date, announcement.author, "", ""].join(
          "\n",
        ),
      ),
      provider: "supilot",
    };

    const metadata = await runGenerator(
      { ANNOUNCEMENT_AI_ENABLED: "false" },
      {
        sources: { "announcements-academic.json": [announcement] },
        metadata: {
          version: 1,
          generatedAt: "2026-09-12T00:00:00.000Z",
          items: { [key]: item },
        },
      },
    );

    expect(JSON.stringify(metadata.items[key])).not.toMatch(
      /student@example\.com|010-1234-5678/,
    );
  });
});
// @vitest-environment node
