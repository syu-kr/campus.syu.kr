// @vitest-environment node
import { expect, it } from "vitest";
import type { ManagedContentRecord } from "../types/managed-content";
import { assertNoticeMigrationState, checkNoticeMigrationBackup, noticeDocumentHash, planNoticeMigration, summarizeNoticeMigration } from "./service-notice-migration";
import { readRepositoryManagedContent } from "./service-notice-repository";
import { parseManagedDraft } from "./server/managed-content";

function seed(): ManagedContentRecord {
  const draft = { kind: "notice" as const, slug: "019-test", title: "원문", summary: "요약", content: "\n# 본문\n", english: { title: "Original", summary: "Summary", content: "\n# Body\n" }, startsAt: null, endsAt: null };
  return { id: draft.slug, draft, published: draft, publishedAt: "2026-10-16T00:00:00.000Z", updatedAt: "2026-10-16T00:00:00.000Z", revision: 0, archived: false, source: "repository", noticeMetadata: { publicId: "019", date: "2026-10-16", author: "Original author", lang: "ko", sourceSha256: "a".repeat(64), reviewedEnglishSourceSha256: "a".repeat(64) } };
}

it("imports all nineteen exact source snapshots with eighteen reviewed translations and the English original", async () => {
  const sources = await readRepositoryManagedContent(true);
  const plan = checkNoticeMigrationBackup(planNoticeMigration(sources, new Map()));
  expect(summarizeNoticeMigration(plan)).toMatchObject({ sourceRecords: 19, create: 19, enrich: 0, conflicts: 0 });
  expect(sources.filter(row => row.noticeMetadata?.reviewedEnglishSourceSha256)).toHaveLength(18);
  expect(sources.find(row => row.id.startsWith("012-"))?.noticeMetadata?.lang).toBe("en");
  for (let i = 0; i < sources.length; i++) {
    expect(plan.entries[i].after?.published).toEqual(sources[i].published);
    expect(plan.entries[i].after?.noticeMetadata).toEqual(sources[i].noticeMetadata);
    expect(parseManagedDraft(plan.entries[i].after?.published, true)).toEqual(sources[i].published);
  }
});

it("repeats without writing and resumes a partially imported set", () => {
  const source = seed(), second = { ...source, id: "020-test", draft: { ...source.draft, slug: "020-test" }, published: { ...source.draft, slug: "020-test" } } as ManagedContentRecord;
  const [first] = planNoticeMigration([source], new Map()).entries;
  expect(assertNoticeMigrationState(first, null)).toBe("write");
  expect(assertNoticeMigrationState(first, first.after)).toBe("skip");
  const repeated = planNoticeMigration([source, second], new Map([[source.id, first.after!]]));
  expect(summarizeNoticeMigration(repeated)).toMatchObject({ create: 1, unchanged: 1 });
});

it("enriches identity without changing edited drafts, publications, suppression or revisions", () => {
  const source = seed();
  for (const published of [null, { ...source.draft, title: "Edited publication" }]) {
    const before = { id: source.id, revision: 8, archived: published === null, draft: { ...source.draft, title: "Private draft" }, published, updatedAt: "2026-10-26T00:00:00Z", draftEnglishSourceHash: "original-review-binding" };
    const plan = checkNoticeMigrationBackup(planNoticeMigration([source], new Map([[source.id, before]])));
    const [entry] = plan.entries;
    expect(entry.action).toBe("enrich");
    expect(entry.after).toEqual({ ...before, noticeMetadata: source.noticeMetadata });
    expect(assertNoticeMigrationState(entry, entry.after, true)).toBe("write");
    expect(assertNoticeMigrationState(entry, before, true)).toBe("skip");
  }
});

it("refuses changed identities and concurrent edits during import or rollback", () => {
  const source = seed(), [created] = planNoticeMigration([source], new Map()).entries;
  expect(() => assertNoticeMigrationState(created, { ...created.after, revision: 2 })).toThrow("Concurrent");
  expect(() => assertNoticeMigrationState(created, { ...created.after, revision: 2 }, true)).toThrow("Concurrent");
  const conflict = planNoticeMigration([source], new Map([[source.id, { ...created.after, noticeMetadata: { ...source.noticeMetadata, author: "Different" } }]]));
  expect(summarizeNoticeMigration(conflict).conflicts).toBe(1);
  expect(() => planNoticeMigration([source, source], new Map())).toThrow("Duplicate");
  expect(() => planNoticeMigration([], new Map())).toThrow("No repository notices");
});

it("rejects tampered or non-JSON backups and unrelated fields in enrichment", () => {
  const source = seed(), plan = planNoticeMigration([source], new Map());
  const tampered = structuredClone(plan); tampered.entries[0].after!.revision = 100;
  expect(() => checkNoticeMigrationBackup(tampered)).toThrow();
  expect(() => noticeDocumentHash({ timestamp: new Date() })).toThrow("JSON-compatible");
  expect(() => noticeDocumentHash({ undefined: undefined })).toThrow("JSON-compatible");
  const [created] = plan.entries;
  const before = { ...created.after! }; delete before.noticeMetadata;
  const enrichment = planNoticeMigration([source], new Map([[source.id, before]]));
  enrichment.entries[0].after!.revision = 7;
  enrichment.entries[0].afterHash = noticeDocumentHash(enrichment.entries[0].after);
  expect(() => checkNoticeMigrationBackup(enrichment)).toThrow("Enrichment changes existing content");
});

it("hashes documents deterministically regardless of field order", () => {
  expect(noticeDocumentHash({ a: 1, b: { x: 2, y: 3 } })).toBe(noticeDocumentHash({ b: { y: 3, x: 2 }, a: 1 }));
});
