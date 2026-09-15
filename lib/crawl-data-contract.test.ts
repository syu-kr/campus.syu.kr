import { describe, expect, it } from "vitest";
import {
  DAILY_CRAWL_DATA_FILES,
  parseCrawlDataManifest,
  validateDailyCrawlData,
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

  it("accepts a legacy manifest without SW notices", () => {
    const manifest = createManifest();
    delete manifest.files["announcements-sw.json"];

    expect(parseCrawlDataManifest(manifest).files["announcements-sw.json"]).toBeUndefined();
  });

  it("rejects inconsistent retained versions", () => {
    const manifest = createManifest();
    manifest.retainedVersions = ["another-version"];

    expect(() => parseCrawlDataManifest(manifest)).toThrow(
      "보존 버전 목록이 일관되지 않습니다",
    );
  });

  it("rejects oversized files declared by a manifest", () => {
    const manifest = createManifest();
    manifest.files["cafeteria-menu.json"].size = 128 * 1024 + 1;

    expect(() => parseCrawlDataManifest(manifest)).toThrow(
      "파일 크기가 올바르지 않습니다",
    );
  });

  it("validates announcements and rejects non-SYU URLs", () => {
    const announcement = {
      id: "academic-1",
      title: "수강 안내",
      date: "2026.09.14",
      author: "교무처",
      url: "https://www.syu.ac.kr/notice/1",
      category: "academic",
      isImportant: false,
      isPinned: false,
    };

    expect(() =>
      validateDailyCrawlData("announcements-academic.json", [announcement]),
    ).not.toThrow();
    expect(() =>
      validateDailyCrawlData("announcements-academic.json", [
        { ...announcement, url: "https://example.com/notice/1" },
      ]),
    ).toThrow("허용되지 않은 공지 URL");
  });

  it("rejects contact details in published AI metadata", () => {
    expect(() =>
      validateDailyCrawlData("announcement-ai-metadata.json", {
        version: 1,
        generatedAt: "2026-09-14T00:00:00.000Z",
        items: {
          test: {
            summary: "student@example.com으로 문의하세요.",
            target: "재학생",
            deadline: "unknown",
            requiredAction: "원문 확인",
            keywords: ["공지", "문의"],
            importance: "normal",
            confidence: "low",
          },
        },
      }),
    ).toThrow("공개할 수 없는 연락처");
  });
});
