// @vitest-environment node
import { expect, it, vi } from "vitest";
import { collectServiceNoticeSnapshot, SERVICE_NOTICE_SNAPSHOT_KEY } from "./indexnow-service-notices";
import { buildIndexNowSnapshot, changedIndexNowUrls, type SnapshotFile } from "./indexnow-snapshot";

const row = { id: "019", slug: "019-test", title: "공지", date: "2026-10-25", author: "Team", lang: "ko", excerpt: "요약", modifiedAt: "2026-10-26T00:00:00.000Z" };
const request = (rows: unknown) => vi.fn(async () => Response.json(rows));
const source = (metadata: SnapshotFile) => ({
  "public/data/announcements-academic.json": { hash: "a", data: [] }, "public/data/announcements-campus-life.json": { hash: "b", data: [] },
  "public/data/announcements-scholarship.json": { hash: "c", data: [] }, "public/data/announcements-sw.json": { hash: "d", data: [] },
  "public/data/announcements-events.json": { hash: "e", data: [] }, "public/data/announcements-departments.json": { hash: "f", data: [] },
  "public/service-notices/001-old.md": { hash: "old" }, [SERVICE_NOTICE_SNAPSHOT_KEY]: metadata,
});
it("tracks published additions, edits and removals instead of the retained Markdown backup", async () => {
  const before = buildIndexNowSnapshot(source(await collectServiceNoticeSnapshot(request([row]))));
  expect(before["https://campus.syu.kr/service/notices/019-test"]).toBeDefined();
  expect(before["https://campus.syu.kr/service/notices/001-old"]).toBeUndefined();
  const edited = buildIndexNowSnapshot(source(await collectServiceNoticeSnapshot(request([{ ...row, modifiedAt: "2026-10-26T01:00:00.000Z" }]))));
  expect(changedIndexNowUrls(before, edited)).toContain("https://campus.syu.kr/service/notices/019-test");
  const removed = buildIndexNowSnapshot(source(await collectServiceNoticeSnapshot(request([]))));
  expect(removed["https://campus.syu.kr/service/notices/019-test"]).toBeUndefined();
  expect(changedIndexNowUrls(before, removed)).toContain("https://campus.syu.kr/en/service/notices/019-test");
});
it("allows localized titles but rejects partial failures and changing publication identity", async () => {
  const localized = vi.fn().mockResolvedValueOnce(Response.json([row])).mockResolvedValueOnce(Response.json([{ ...row, title: "Notice", lang: "en" }]));
  await expect(collectServiceNoticeSnapshot(localized)).resolves.toHaveProperty("data.en.0.title", "Notice");
  await expect(collectServiceNoticeSnapshot(vi.fn(async () => new Response(null, { status: 503 })))).rejects.toThrow("unavailable");
  await expect(collectServiceNoticeSnapshot(vi.fn().mockResolvedValueOnce(Response.json([row])).mockResolvedValueOnce(Response.json([])))).rejects.toThrow("changed");
});
it("rejects unsafe and duplicate slugs and ignores fields outside public metadata", async () => {
  for (const rows of [[{ ...row, slug: "../admin" }], [row, row], [{ ...row, startsAt: "invalid" }]]) await expect(collectServiceNoticeSnapshot(request(rows))).rejects.toThrow("Invalid");
  const result = await collectServiceNoticeSnapshot(request([{ ...row, draft: "private fixture must not enter fingerprint" }]));
  expect(JSON.stringify(result)).not.toContain("private fixture");
});
