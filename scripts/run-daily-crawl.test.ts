// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CRAWL_DATA_MAX_BYTES, type DailyCrawlDataFile } from "../lib/crawl-data-contract";
import { hasIncompleteCrawlOutput, runDailyCrawl } from "./run-daily-crawl";

const ATTEMPT = "2026-10-04T03:00:00.000Z";
const PREVIOUS = "2026-10-03T03:00:00.000Z";
const NOTICE_FILES: DailyCrawlDataFile[] = [
  "announcements-academic.json",
  "announcements-scholarship.json",
  "announcements-campus-life.json",
  "announcements-events.json",
  "announcements-departments.json",
  "announcements-sw.json",
];
let directory: string;
let healthPath: string;
let original: Buffer;

function notice(title: string) {
  return [{
    id: "academic-1", title, date: "2026.10.04", author: "교무처",
    category: "academic", url: "https://www.syu.ac.kr/notice/1",
    isImportant: false, isPinned: false,
  }];
}

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "syu-daily-crawl-"));
  healthPath = path.join(directory, "health.json");
  original = Buffer.from(`${JSON.stringify(notice("이전 검증본"), null, 2)}\r\n`);
  await Promise.all(NOTICE_FILES.map((fileName) => writeFile(path.join(directory, fileName), original)));
  await writeFile(path.join(directory, "cafeteria-menu.json"), JSON.stringify({
    id: "cafeteria", name: "식당", weekStart: "2026-10-05", lastUpdated: PREVIOUS, menus: [],
  }));
  await writeFile(path.join(directory, "announcement-ai-metadata.json"), JSON.stringify({
    version: 1, generatedAt: PREVIOUS, items: {},
  }));
  await writeFile(healthPath, JSON.stringify({ files: {
    "announcements-academic.json": {
      status: "fresh", lastAttemptAt: PREVIOUS, lastSuccessAt: PREVIOUS,
    },
  } }));
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(async () => {
  expect(path.dirname(directory)).toBe(path.resolve(tmpdir()));
  expect(path.basename(directory)).toMatch(/^syu-daily-crawl-/);
  await rm(directory, { recursive: true, force: true });
});

const options = () => ({ dataDir: directory, healthPath, now: () => new Date(ATTEMPT) });

describe("independent daily crawler publication", () => {
  it("restores exact failed bytes while keeping another source's successful update", async () => {
    const visited: DailyCrawlDataFile[] = [];
    const health = await runDailyCrawl({ ...options(), run: async ({ fileName }) => {
      visited.push(fileName);
      if (fileName === "announcements-academic.json") {
        await writeFile(path.join(directory, fileName), "partial write");
        return { exitCode: 1 };
      }
      if (fileName === "announcements-sw.json") {
        await writeFile(path.join(directory, fileName), JSON.stringify(notice("신규 공지")));
      }
      return { exitCode: 0 };
    } });

    expect(visited).toHaveLength(7);
    expect(await readFile(path.join(directory, "announcements-academic.json"))).toEqual(original);
    expect(JSON.parse(await readFile(path.join(directory, "announcements-sw.json"), "utf8"))[0].title).toBe("신규 공지");
    expect(health["announcements-academic.json"]).toEqual({
      status: "stale", lastAttemptAt: ATTEMPT, lastSuccessAt: PREVIOUS, errorCode: "CRAWLER_FAILED",
    });
    expect(health["announcements-sw.json"]).toEqual({
      status: "fresh", lastAttemptAt: ATTEMPT, lastSuccessAt: ATTEMPT,
    });
    expect(JSON.parse(await readFile(healthPath, "utf8")).files).toEqual(health);
  });

  it.each([
    ["invalid JSON", "{"],
    ["invalid schema", JSON.stringify([{ title: "missing required fields" }])],
    ["oversized JSON", " ".repeat(CRAWL_DATA_MAX_BYTES["announcements-academic.json"] + 1)],
  ])("rejects a zero-exit %s update and restores its validated baseline", async (_name, payload) => {
    const health = await runDailyCrawl({ ...options(), run: async ({ fileName }) => {
      if (fileName === "announcements-academic.json") await writeFile(path.join(directory, fileName), payload);
      return { exitCode: 0 };
    } });

    expect(await readFile(path.join(directory, "announcements-academic.json"))).toEqual(original);
    expect(health["announcements-academic.json"]?.errorCode).toBe("INVALID_DATA");
    expect(health["announcements-academic.json"]?.lastSuccessAt).toBe(PREVIOUS);
  });

  it("preserves previous health of skipped sources during a cafeteria-only run", async () => {
    const run = vi.fn<(source: { fileName: DailyCrawlDataFile }) => Promise<{ exitCode: number }>>()
      .mockResolvedValue({ exitCode: 0 });
    const health = await runDailyCrawl({ ...options(), mode: "cafeteria", run });

    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0]).toMatchObject({ fileName: "cafeteria-menu.json" });
    expect(health["announcements-academic.json"]).toEqual({
      status: "fresh", lastAttemptAt: PREVIOUS, lastSuccessAt: PREVIOUS,
    });
  });

  it("keeps all baselines and records stale health when every crawler fails", async () => {
    const health = await runDailyCrawl({ ...options(), run: async () => ({ exitCode: 1 }) });

    expect(Object.values(health)).toHaveLength(7);
    expect(Object.values(health).every((entry) => entry.status === "stale")).toBe(true);
    expect(health["announcements-sw.json"]?.lastSuccessAt).toBeUndefined();
    expect(await readFile(path.join(directory, "announcements-sw.json"))).toEqual(original);
  });

  it("restores a zero-exit incomplete department update without advancing its last success", async () => {
    await writeFile(healthPath, JSON.stringify({ files: {
      "announcements-departments.json": {
        status: "fresh", lastAttemptAt: PREVIOUS, lastSuccessAt: PREVIOUS,
      },
    } }));
    const health = await runDailyCrawl({ ...options(), run: async ({ fileName }) => {
      if (fileName === "announcements-departments.json") {
        await writeFile(path.join(directory, fileName), JSON.stringify(notice("불완전 신규")));
        return {
          exitCode: 0,
          incomplete: hasIncompleteCrawlOutput("[warn] 학과 공지 행의 필수 항목을 해석하지 못했습니다"),
        };
      }
      return { exitCode: 0 };
    } });

    expect(await readFile(path.join(directory, "announcements-departments.json"))).toEqual(original);
    expect(health["announcements-departments.json"]).toEqual({
      status: "stale", lastAttemptAt: ATTEMPT, lastSuccessAt: PREVIOUS, errorCode: "INCOMPLETE_SOURCE",
    });
  });

  it("restores AI metadata after its child partially writes and fails", async () => {
    const metadataPath = path.join(directory, "announcement-ai-metadata.json");
    const previousMetadata = await readFile(metadataPath);
    const health = await runDailyCrawl({ ...options(), mode: "ai", run: async () => {
      await writeFile(metadataPath, "partial AI metadata");
      return { exitCode: 1 };
    } });

    expect(await readFile(metadataPath)).toEqual(previousMetadata);
    expect(health["announcement-ai-metadata.json"]?.errorCode).toBe("CRAWLER_FAILED");
    expect(health["announcements-academic.json"]?.lastSuccessAt).toBe(PREVIOUS);
  });

  it("preserves AI health and bytes without running the child when AI is disabled", async () => {
    const previousAiHealth = {
      status: "stale", lastAttemptAt: PREVIOUS, lastSuccessAt: PREVIOUS,
      errorCode: "INCOMPLETE_SOURCE",
    };
    await writeFile(healthPath, JSON.stringify({ files: {
      "announcement-ai-metadata.json": previousAiHealth,
    } }));
    const metadataPath = path.join(directory, "announcement-ai-metadata.json");
    const previousMetadata = await readFile(metadataPath);
    const run = vi.fn(async () => ({ exitCode: 0 }));

    const health = await runDailyCrawl({ ...options(), mode: "ai", aiEnabled: false, run });

    expect(run).not.toHaveBeenCalled();
    expect(health["announcement-ai-metadata.json"]).toEqual(previousAiHealth);
    expect(await readFile(metadataPath)).toEqual(previousMetadata);
  });

  it("stops before running children when any selected baseline is invalid", async () => {
    const run = vi.fn(async () => ({ exitCode: 0 }));
    await writeFile(path.join(directory, "announcements-sw.json"), "invalid baseline");

    await expect(runDailyCrawl({ ...options(), run })).rejects.toThrow();
    expect(run).not.toHaveBeenCalled();
  });

  it("recognizes known incomplete-source logs without treating a closed cafeteria as a failure", () => {
    expect(hasIncompleteCrawlOutput("  [warn] 요청 오류: upstream timeout")).toBe(true);
    expect(hasIncompleteCrawlOutput("  ⚠️ 공지사항 링크를 찾지 못했습니다")).toBe(true);
    expect(hasIncompleteCrawlOutput("학과 홈페이지 매칭 결과가 없어 기존 데이터를 유지했습니다")).toBe(true);
    expect(hasIncompleteCrawlOutput("[Announcement AI] generation failed")).toBe(true);
    expect(hasIncompleteCrawlOutput("ℹ️ 공식 페이지에 메뉴 정보가 없어 운영 없음으로 저장합니다.")).toBe(false);
  });
});
