// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ rows: new Map<string, Record<string, unknown>>(), fields: [] as string[], id: "", selects: vi.fn(), where: vi.fn(), db: vi.fn() }));
function projection(row: Record<string, unknown>, paths: string[]) {
  const result: Record<string, unknown> = {};
  for (const path of paths) {
    const parts = path.split(".");let current: unknown = row;
    for (const key of parts) { if (!current || typeof current !== "object") { current = undefined;break; } current = (current as Record<string, unknown>)[key]; }
    if (current === undefined) continue;
    let target = result;for (const key of parts.slice(0, -1)) target = (target[key] ??= {}) as Record<string, unknown>;
    target[parts.at(-1)!] = current;
  }
  return result;
}
vi.mock("./firestore", () => ({ getFirestore: () => {
  fixture.db();
  const query = {
    where: (...args: unknown[]) => { fixture.where(...args);fixture.id = String(args[2]);return query; },
    select: (...fields: string[]) => { fixture.fields = fields;fixture.selects(fields);return query; },
    limit: () => query,
    get: async () => {
      const items = [...fixture.rows].filter(([id]) => !fixture.id || fixture.id === id);
      return { size: items.length, docs: items.map(([id, row]) => ({ id, data: () => projection(row, fixture.fields) })) };
    },
  };return { collection: () => query };
} }));
import { readPublishedManagedContentRecord, readPublishedManagedContentRecords } from "./managed-content";

const draft = { kind: "notice", slug: "notice-1", title: "공지", summary: "공개 요약", content: "공개 본문", startsAt: null, endsAt: null, english: { title: "Notice", summary: "Public summary", content: "Public body" } };
const row = { draft: { ...draft, content: "PRIVATE DRAFT", title: "PRIVATE TITLE" }, published: draft, publishedAt: "2026-10-26T00:00:00Z", publishedRevision: 2, publishedUpdatedAt: "2026-10-26T01:00:00Z", archived: false, updatedBy: "PRIVATE UID", revision: 7 };
beforeEach(() => { fixture.rows.clear();fixture.fields = [];fixture.id = "";fixture.db.mockClear();fixture.selects.mockClear();fixture.where.mockClear();vi.stubEnv("FIREBASE_SERVICE_ACCOUNT", "fixture"); });
afterEach(() => vi.unstubAllEnvs());

it("selects only cache-safe metadata even for hundreds of long bilingual notices", async () => {
  const longBody = "가".repeat(50_000), longEnglish = "E".repeat(50_000);
  for (let i = 0; i < 500; i++) fixture.rows.set(`notice-${i}`, { ...row, published: { ...draft, slug: `notice-${i}`, content: longBody, english: { ...draft.english, content: longEnglish } } });
  const result = await readPublishedManagedContentRecords();
  expect(result).toHaveLength(500);
  expect(fixture.fields).not.toContain("published");expect(fixture.fields).not.toContain("published.content");expect(fixture.fields).not.toContain("published.english.content");
  expect(fixture.fields.filter(field => field.startsWith("draft."))).toEqual(["draft.kind"]);
  const json = JSON.stringify(result);expect(json).not.toContain("PRIVATE");expect(json).not.toContain("\"content\"");
  expect(Buffer.byteLength(json)).toBeLessThan(2 * 1024 * 1024);
  expect(result[0].publishedRevision).toBe(2);
});
it("keeps a repository suppression tombstone when a nested null parent is omitted by Firestore projection", async () => {
  fixture.rows.set("notice-1", { ...row, published: null, archived: true });
  const [result] = await readPublishedManagedContentRecords();
  expect(result).toMatchObject({ id: "notice-1", kind: "notice", published: null, archived: true });
  expect(result).not.toHaveProperty("draft");
});
it("loads one full publication for detail without loading any private draft body", async () => {
  fixture.rows.set("notice-1", row);fixture.rows.set("other", { ...row, published: { ...draft, slug: "other" } });
  const result = await readPublishedManagedContentRecord("notice-1");
  expect(fixture.where.mock.calls[0].slice(1)).toEqual(["==", "notice-1"]);
  expect(fixture.fields).toContain("published");expect(fixture.fields.filter(field => field.startsWith("draft."))).toEqual(["draft.kind"]);
  expect(result?.published).toMatchObject({ content: "공개 본문", english: { content: "Public body" } });
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
});
it("performs no public storage reads for invalid identity or missing configuration", async () => {
  expect(await readPublishedManagedContentRecord("../private")).toBeNull();expect(fixture.db).not.toHaveBeenCalled();
  vi.stubEnv("FIREBASE_SERVICE_ACCOUNT", "");expect(await readPublishedManagedContentRecords()).toEqual([]);expect(await readPublishedManagedContentRecord("notice-1")).toBeNull();expect(fixture.db).not.toHaveBeenCalled();
});
it("projects immutable original identity without exposing private or full notice bodies", async () => {
  const noticeMetadata = { publicId: "001", date: "2026-10-01", author: "Original author", lang: "en", sourceSha256: "a".repeat(64), excerpt: "Original summary", description: "Original description" };
  fixture.rows.set("notice-1", { ...row, noticeMetadata });
  expect((await readPublishedManagedContentRecords())[0].noticeMetadata).toEqual(noticeMetadata);
  expect(fixture.fields).toContain("noticeMetadata");
  expect((await readPublishedManagedContentRecord("notice-1"))?.noticeMetadata).toEqual(noticeMetadata);
  fixture.rows.set("notice-1", { ...row, noticeMetadata: { ...noticeMetadata, sourceSha256: "not-a-hash" } });
  await expect(readPublishedManagedContentRecords()).rejects.toMatchObject({ code: "CONTENT_READ_FAILED" });
});
