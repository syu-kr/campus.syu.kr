import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DAILY_CRAWL_DATA_FILES } from "../crawl-data-contract";

const ORIGINAL_BASE_URL = process.env.CRAWL_DATA_BASE_URL;

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
  it("loads and verifies a versioned Pages payload", async () => {
    const version = "20260724T010203-123.1";
    const payload = Buffer.from('[{"id":1}]', "utf8");
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

    const { readDailyCrawlDataSnapshot } = await import("./crawl-data");
    const snapshot = await readDailyCrawlDataSnapshot<Array<{ id: number }>>(
      "cafeteria-menu.json",
    );

    expect(snapshot).toMatchObject({
      data: [{ id: 1 }],
      source: "github-pages",
      version,
      publishedAt: "2026-07-24T01:02:03.000Z",
    });
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
});
