// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ManagedContentRecord, ManagedNoticeDraft } from "@/types/managed-content";
const records = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("./server/public-managed-content", async importOriginal => {
  const actual = await importOriginal<typeof import("./server/public-managed-content")>();
  return { ...actual, getPublicManagedContentRecords: records.read, getPublicManagedContentRecord: async (id: string) => (await records.read()).find((item: ManagedContentRecord) => item.id === id) ?? null };
});
import { getAllServiceNotices, getServiceNoticeBySlug, getRepositoryManagedContent } from "./serviceNotices";
const now = Date.parse("2026-10-26T12:00:00Z");
beforeEach(() => { records.read.mockReset().mockResolvedValue([]);vi.spyOn(Date, "now").mockReturnValue(now); });
afterEach(() => { vi.restoreAllMocks();vi.unstubAllEnvs(); });

it("loads the repository seeds independently and keeps all original public identities", async () => {
  const seeds = await getRepositoryManagedContent();
  expect(seeds).toHaveLength(19);expect(records.read).not.toHaveBeenCalled();
  expect(seeds.every(seed => seed.revision === 0 && seed.source === "repository" && seed.publishedAt?.endsWith("Z"))).toBe(true);
  expect(seeds.filter(seed => seed.draft.kind === "notice" && seed.draft.english)).toHaveLength(19);
});
it("keeps a saved edit private while preserving the public snapshot and original English", async () => {
  const [seed] = await getRepositoryManagedContent();
  const original = await getServiceNoticeBySlug(seed.id, "en");
  records.read.mockResolvedValue([{ ...seed, source: "database", revision: 1, draft: { ...seed.draft, title: "UNPUBLISHED DRAFT" } }]);
  const detail = await getServiceNoticeBySlug(seed.id, "en");
  expect(detail?.title).toBe(original?.title);expect(detail?.content).toBe(original?.content);
  expect(JSON.stringify(await getAllServiceNotices("en"))).not.toContain("UNPUBLISHED DRAFT");
});
it("treats unpublished and archived repository entries as tombstones in both languages", async () => {
  const [seed] = await getRepositoryManagedContent();
  for (const locale of ["ko", "en"] as const) {
    for (const overrides of [{ published: null }, { archived: true }]) {
      records.read.mockResolvedValue([{ ...seed, source: "database", revision: 1, ...overrides }]);
      expect((await getAllServiceNotices(locale)).some(item => item.slug === seed.id)).toBe(false);
      expect(await getServiceNoticeBySlug(seed.id, locale)).toBeNull();
    }
  }
});
it("adds new slugs only inside their exact publication window", async () => {
  const draft: ManagedNoticeDraft = { kind: "notice", slug: "new-campus-service", title: "새 공지", summary: "요약", content: "본문", startsAt: new Date(now + 1000).toISOString(), endsAt: new Date(now + 2000).toISOString() };
  const row: ManagedContentRecord = { id: draft.slug, draft, published: draft, revision: 1, updatedAt: new Date(now).toISOString(), publishedAt: new Date(now).toISOString(), archived: false, source: "database" };
  records.read.mockResolvedValue([row]);
  expect(await getServiceNoticeBySlug(row.id)).toBeNull();
  vi.mocked(Date.now).mockReturnValue(now + 1000);
  expect(await getServiceNoticeBySlug(row.id)).toMatchObject({ title: draft.title, content: draft.content, startsAt: draft.startsAt, endsAt: draft.endsAt });
  expect((await getAllServiceNotices()).some(item => item.slug === row.id)).toBe(true);
  vi.mocked(Date.now).mockReturnValue(now + 2000);expect(await getServiceNoticeBySlug(row.id)).toBeNull();
});
it("does not reuse a repository English variant for changed published Korean content", async () => {
  const [seed] = await getRepositoryManagedContent();
  const publication = { ...(seed.published as ManagedNoticeDraft), title: "변경된 공개 제목", english: undefined };
  records.read.mockResolvedValue([{ ...seed, source: "database", revision: 1, draft: publication, published: publication }]);
  expect(await getServiceNoticeBySlug(seed.id, "en")).toMatchObject({ title: "변경된 공개 제목", lang: "ko" });
});
it("propagates a configured database failure instead of resurrecting static notices", async () => {
  records.read.mockRejectedValue(new Error("configured store unavailable"));
  await expect(getAllServiceNotices()).rejects.toThrow("configured store unavailable");
  await expect(getServiceNoticeBySlug("019-manna-house-menu")).rejects.toThrow("configured store unavailable");
});

it("serves the same original identities, languages and Markdown using database records alone", async () => {
  const sources = await getRepositoryManagedContent();
  const expected = new Map<string, Awaited<ReturnType<typeof getServiceNoticeBySlug>>>();
  for (const source of sources) for (const locale of ["ko", "en"] as const) expected.set(`${locale}:${source.id}`, await getServiceNoticeBySlug(source.id, locale));
  vi.stubEnv("SERVICE_NOTICES_SOURCE", "database"); vi.stubEnv("FIREBASE_SERVICE_ACCOUNT", "fixture");
  records.read.mockResolvedValue(sources.map(seed => ({ ...seed, source: "database", revision: 1 })));
  expect(await getRepositoryManagedContent()).toEqual([]);
  for (const locale of ["ko", "en"] as const) {
    expect(await getAllServiceNotices(locale)).toHaveLength(19);
    for (const source of sources) {
      const detail = await getServiceNoticeBySlug(source.id, locale);
      const original = expected.get(`${locale}:${source.id}`)!;
      expect(detail).toMatchObject({ id: original!.id, slug: original!.slug, title: original!.title, content: original!.content, date: original!.date, author: original!.author, lang: original!.lang, excerpt: original!.excerpt, description: original!.description });
    }
  }
  records.read.mockResolvedValue([]);
  expect(await getAllServiceNotices()).toEqual([]);
  expect(await getServiceNoticeBySlug(sources[0].id)).toBeNull();
});
it("fails closed for missing database configuration and invalid source mode", async () => {
  vi.stubEnv("SERVICE_NOTICES_SOURCE", "database");vi.stubEnv("FIREBASE_SERVICE_ACCOUNT", "");
  await expect(getAllServiceNotices()).rejects.toThrow("not configured");
  await expect(getServiceNoticeBySlug("019-manna-house-menu")).rejects.toThrow("not configured");
  vi.stubEnv("SERVICE_NOTICES_SOURCE", "typo");
  await expect(getAllServiceNotices()).rejects.toThrow("Invalid service notice source");
});
