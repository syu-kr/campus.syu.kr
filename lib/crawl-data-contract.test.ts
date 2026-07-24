import { describe, expect, it } from "vitest";
import {
  DAILY_CRAWL_DATA_FILES,
  parseCrawlDataManifest,
} from "./crawl-data-contract";

function createManifest() {
  const version = "20260724T010203-123.1";
  return {
    schemaVersion: 1,
    version,
    publishedAt: "2026-07-24T01:02:03.000Z",
    files: Object.fromEntries(
      DAILY_CRAWL_DATA_FILES.map((fileName) => [
        fileName,
        {
          path: `versions/${version}/${fileName}`,
          sha256: "a".repeat(64),
          size: 100,
        },
      ]),
    ),
    retainedVersions: [version],
  };
}

describe("crawl data contract", () => {
  it("accepts a complete versioned manifest", () => {
    expect(parseCrawlDataManifest(createManifest()).version).toBe(
      "20260724T010203-123.1",
    );
  });

  it("rejects a manifest that points outside its version", () => {
    const manifest = createManifest();
    manifest.files["cafeteria-menu.json"].path =
      "versions/other/cafeteria-menu.json";

    expect(() => parseCrawlDataManifest(manifest)).toThrow(
      "Pages 경로가 올바르지 않습니다",
    );
  });

  it("rejects an incomplete manifest", () => {
    const manifest: {
      files: Partial<ReturnType<typeof createManifest>["files"]>;
    } & Omit<ReturnType<typeof createManifest>, "files"> = createManifest();
    delete manifest.files["announcement-ai-metadata.json"];

    expect(() => parseCrawlDataManifest(manifest)).toThrow(
      "announcement-ai-metadata.json 항목이 없습니다",
    );
  });

  it("rejects inconsistent retained versions", () => {
    const manifest = createManifest();
    manifest.retainedVersions = ["another-version"];

    expect(() => parseCrawlDataManifest(manifest)).toThrow(
      "보존 버전 목록이 일관되지 않습니다",
    );
  });
});
