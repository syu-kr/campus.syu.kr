import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DAILY_CRAWL_DATA_FILES, type DailyCrawlDataFile } from "../crawl-data-contract";

const ORIGINAL_BASE_URL = process.env.CRAWL_DATA_BASE_URL;

function pagesManifest(version: string, fileName: DailyCrawlDataFile, payload: Buffer) {
  return {
    schemaVersion: 1,
    version,
    publishedAt: "2026-10-18T00:00:00Z",
    retainedVersions: [version],
    files: Object.fromEntries(DAILY_CRAWL_DATA_FILES.map((name) => {
      const bytes = name === fileName ? payload : Buffer.from("[]");
      return [name, {
        path: `versions/${version}/${name}`,
        size: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      }];
    })),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  if (ORIGINAL_BASE_URL === undefined) {
    delete process.env.CRAWL_DATA_BASE_URL;
  } else {
    process.env.CRAWL_DATA_BASE_URL = ORIGINAL_BASE_URL;
  }
});

describe("crawl data Pages runtime", () => {
  it.each([
    [1024 * 1024, "force-cache"],
    [1024 * 1024 + 1, "no-store"],
  ] as const)("uses the body cache budget for %i bytes and deduplicates reads", async (size, cache) => {
    const notices = [{
      id: "test", title: "notice", author: "office", date: "2026.10.18",
      category: "academic", url: "https://www.syu.ac.kr/notice/test",
      isImportant: false, isPinned: false, content: "",
    }];
    notices[0].content = "a".repeat(size - Buffer.byteLength(JSON.stringify(notices)));
    const payload = Buffer.from(JSON.stringify(notices));
    const manifest = pagesManifest("cache-budget", "announcements-academic.json", payload);
    const fetchMock = vi.fn<typeof fetch>(async (input) =>
      new Response(input.toString().includes("current.json") ? JSON.stringify(manifest) : payload));
    vi.stubGlobal("fetch", fetchMock);
    const { readDailyCrawlDataSnapshot } = await import("./crawl-data");
    const [first, concurrent] = await Promise.all([
      readDailyCrawlDataSnapshot("announcements-academic.json"),
      readDailyCrawlDataSnapshot("announcements-academic.json"),
    ]);
    const repeated = await readDailyCrawlDataSnapshot("announcements-academic.json");
    expect(payload.byteLength).toBe(size);
    expect(first.source).toBe("github-pages");
    expect(first.data).toEqual(notices);
    expect(concurrent.data).toBe(first.data);
    expect(repeated.data).toBe(first.data);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ cache });
  });

  it("accepts large AI metadata without writing it to the Next data cache", async () => {
    const item = {
      summary: "공지 요약 ".repeat(15), target: "재학생", deadline: "원문 확인",
      requiredAction: "공지 확인", keywords: ["학사", "안내"], importance: "normal", confidence: "high",
    };
    const metadata = {
      version: 1, generatedAt: "2026-10-18T00:00:00Z",
      items: Object.fromEntries(Array.from({ length: 6000 }, (_, i) => [`notice-${i}`, item])),
    };
    const payload = Buffer.from(JSON.stringify(metadata));
    const manifest = pagesManifest("large-ai", "announcement-ai-metadata.json", payload);
    const fetchMock = vi.fn<typeof fetch>(async (input) =>
      new Response(input.toString().includes("current.json") ? JSON.stringify(manifest) : payload));
    vi.stubGlobal("fetch", fetchMock);
    const { readDailyCrawlDataSnapshot } = await import("./crawl-data");
    const result = await readDailyCrawlDataSnapshot<typeof metadata>("announcement-ai-metadata.json");
    expect(payload.byteLength).toBeGreaterThan(2 * 1024 * 1024);
    expect(result.source).toBe("github-pages");
    expect(Object.keys(result.data.items)).toHaveLength(6000);
    expect(result.data.items["notice-0"]).toEqual(item);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ cache: "no-store" });
  });

  it("reuses an unchanged version while refreshing health and downloads a new version", async () => {
    let now = Date.parse("2026-10-18T00:00:00Z");
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const payload = Buffer.from("[]");
    const fresh = { status: "fresh", lastAttemptAt: "2026-10-18T00:00:00Z", lastSuccessAt: "2026-10-18T00:00:00Z" };
    let manifest = { ...pagesManifest("v1", "announcements-academic.json", payload), sourceHealth: { "announcements-academic.json": fresh } };
    const fetchMock = vi.fn(async (input: string | URL | Request) =>
      new Response(input.toString().includes("current.json") ? JSON.stringify(manifest) : payload));
    vi.stubGlobal("fetch", fetchMock);
    const { readDailyCrawlDataSnapshot } = await import("./crawl-data");
    const first = await readDailyCrawlDataSnapshot("announcements-academic.json");
    now += 60_000;
    const stale = { ...fresh, status: "stale", lastAttemptAt: "2026-10-18T00:01:00Z" };
    manifest = { ...manifest, sourceHealth: { "announcements-academic.json": stale } };
    const unchanged = await readDailyCrawlDataSnapshot("announcements-academic.json");
    expect(unchanged.data).toBe(first.data);
    expect(unchanged.sourceHealth).toEqual(stale);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    now += 60_000;
    manifest = { ...pagesManifest("v2", "announcements-academic.json", payload), sourceHealth: { "announcements-academic.json": fresh } };
    const next = await readDailyCrawlDataSnapshot("announcements-academic.json");
    expect(next.version).toBe("v2");
    expect(next.sourceHealth).toEqual(fresh);
    expect(next.data).not.toBe(first.data);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[4][0].toString()).toContain("versions/v2/");
  });

  it.each(["network", "integrity"])("evicts a failed %s download and retries the same version", async (failure) => {
    const payload = Buffer.from("[]");
    const manifest = pagesManifest("retry", "announcements-sw.json", payload);
    let downloads = 0;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      if (input.toString().includes("current.json")) return new Response(JSON.stringify(manifest));
      downloads += 1;
      if (downloads === 1) {
        if (failure === "network") throw new Error("network failure");
        return new Response("{}");
      }
      return new Response(payload);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { readDailyCrawlDataSnapshot } = await import("./crawl-data");
    expect((await readDailyCrawlDataSnapshot("announcements-sw.json")).source).toBe("bundled-fallback");
    const retried = await readDailyCrawlDataSnapshot("announcements-sw.json");
    expect(retried).toMatchObject({ source: "github-pages", version: "retry", data: [] });
    expect(downloads).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("loads and verifies a versioned Pages payload", async () => {
    const version = "20260724T010203-123.1";
    const cafeteria = {
      id: "cafeteria-test",
      name: "Test Cafeteria",
      weekStart: "2026-07-20",
      menus: [
        {
          date: "2026-07-20",
          day: "월",
          meals: {
            breakfast: ["운영 없음"],
            lunch: { a_corner: ["운영 없음"], b_corner: ["운영 없음"] },
            dinner: ["운영 없음"],
          },
        },
      ],
      lastUpdated: "2026-07-24T01:42:50.000Z",
    };
    const payload = Buffer.from(JSON.stringify(cafeteria), "utf8");
    const sha256 = createHash("sha256").update(payload).digest("hex");
    const manifest = {
      schemaVersion: 1,
      version,
      publishedAt: "2026-07-24T01:02:03.000Z",
      files: Object.fromEntries(
        DAILY_CRAWL_DATA_FILES.map((fileName) => [
          fileName,
          {
            path: `versions/${version}/${fileName}`,
            sha256,
            size: payload.byteLength,
          },
        ]),
      ),
      retainedVersions: [version],
      sourceHealth: {
        "cafeteria-menu.json": {
          status: "stale",
          lastAttemptAt: "2026-07-24T01:00:00.000Z",
          lastSuccessAt: "2026-07-23T01:00:00.000Z",
          errorCode: "CRAWLER_FAILED",
        },
      },
    };

    process.env.CRAWL_DATA_BASE_URL = "https://crawl-data.example.test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = input.toString();
        if (url.includes("current.json")) {
          return new Response(JSON.stringify(manifest));
        }
        return new Response(payload);
      }),
    );

    const { readDailyCrawlDataSnapshot, readDailyCrawlSourceHealth } = await import("./crawl-data");
    const snapshot = await readDailyCrawlDataSnapshot<Array<{ id: number }>>(
      "cafeteria-menu.json",
    );

    expect(snapshot).toMatchObject({
      data: cafeteria,
      source: "github-pages",
      version,
      publishedAt: "2026-07-24T01:02:03.000Z",
      sourceHealth: manifest.sourceHealth["cafeteria-menu.json"],
    });
    expect(await readDailyCrawlSourceHealth()).toEqual(manifest.sourceHealth);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("uses the bundled snapshot when Pages integrity verification fails", async () => {
    const version = "20260724T010203-123.1";
    const payload = Buffer.from("[]", "utf8");
    const manifest = {
      schemaVersion: 1,
      version,
      publishedAt: "2026-07-24T01:02:03.000Z",
      files: Object.fromEntries(
        DAILY_CRAWL_DATA_FILES.map((fileName) => [
          fileName,
          {
            path: `versions/${version}/${fileName}`,
            sha256: "0".repeat(64),
            size: payload.byteLength,
          },
        ]),
      ),
      retainedVersions: [version],
    };

    process.env.CRAWL_DATA_BASE_URL = "https://crawl-data.example.test";
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        if (input.toString().includes("current.json")) {
          return new Response(JSON.stringify(manifest));
        }
        return new Response(payload);
      }),
    );

    const { readDailyCrawlDataSnapshot } = await import("./crawl-data");
    const snapshot = await readDailyCrawlDataSnapshot<unknown>(
      "cafeteria-menu.json",
    );

    expect(snapshot.source).toBe("bundled-fallback");
    expect(snapshot.version).toBe("bundled");
    expect(snapshot.data).toBeDefined();
  });

  it("uses bundled SW notices with a legacy manifest", async () => {
    const version = "20260724T010203-123.1";
    const manifest = {
      schemaVersion: 1,
      version,
      publishedAt: "2026-07-24T01:02:03.000Z",
      files: Object.fromEntries(
        DAILY_CRAWL_DATA_FILES.filter(
          (fileName) => fileName !== "announcements-sw.json",
        ).map((fileName) => [
          fileName,
          {
            path: `versions/${version}/${fileName}`,
            sha256: "0".repeat(64),
            size: 2,
          },
        ]),
      ),
      retainedVersions: [version],
    };

    process.env.CRAWL_DATA_BASE_URL = "https://crawl-data.example.test";
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(manifest))));

    const { readDailyCrawlDataSnapshot } = await import("./crawl-data");
    const snapshot = await readDailyCrawlDataSnapshot<unknown[]>(
      "announcements-sw.json",
    );

    expect(snapshot.source).toBe("bundled-fallback");
    expect(snapshot.data.length).toBeGreaterThan(0);
  });

  it("stops reading a Pages payload once it exceeds the declared size", async () => {
    const version = "20260724T010203-123.1";
    const manifest = {
      schemaVersion: 1,
      version,
      publishedAt: "2026-07-24T01:02:03.000Z",
      files: Object.fromEntries(
        DAILY_CRAWL_DATA_FILES.map((fileName) => [
          fileName,
          {
            path: `versions/${version}/${fileName}`,
            sha256: "0".repeat(64),
            size: 2,
          },
        ]),
      ),
      retainedVersions: [version],
    };

    process.env.CRAWL_DATA_BASE_URL = "https://crawl-data.example.test";
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) =>
        input.toString().includes("current.json")
          ? new Response(JSON.stringify(manifest))
          : new Response("[{}]"),
      ),
    );

    const { readDailyCrawlDataSnapshot } = await import("./crawl-data");
    const snapshot = await readDailyCrawlDataSnapshot<unknown>(
      "cafeteria-menu.json",
    );

    expect(snapshot.source).toBe("bundled-fallback");
  });
});
