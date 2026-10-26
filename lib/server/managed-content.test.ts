// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { ManagedContentRecord, ManagedNoticeDraft, ManagedBannerDraft } from "@/types/managed-content";

const fixture = vi.hoisted(() => ({ store: new Map<string, unknown>(), queue: Promise.resolve() as Promise<unknown>, calls: vi.fn() }));
vi.mock("./firestore", () => ({ getFirestore: () => {
  fixture.calls();
  return { collection: () => ({ doc: (id: string) => ({ id }), limit: () => ({ query: true, get: async () => ({ size: fixture.store.size, docs: [...fixture.store].map(([id, data]) => ({ id, data: () => data })) }) }) }),
    runTransaction: (fn: (tx: unknown) => Promise<unknown>) => {
      const next = fixture.queue.then(() => fn({
        get: async (ref: { id?: string; query?: boolean }) => ref.query ? { size: fixture.store.size } : ({ id: ref.id, exists: fixture.store.has(ref.id!), data: () => fixture.store.get(ref.id!) }),
        set: (ref: { id: string }, value: unknown) => { fixture.store.set(ref.id, structuredClone(value)); },
      }));
      fixture.queue = next.catch(() => {});return next;
    },
  };
} }));
import { isPublishedNow, isSafeContentLink, mutateManagedContent, parseContentMutation, parseManagedDraft, readManagedContentRecords } from "./managed-content";

const note: ManagedNoticeDraft = { kind: "notice", slug: "first-notice", title: "서비스 안내", summary: "안내 내용", content: "원래 본문", startsAt: null, endsAt: null };
const seed: ManagedContentRecord = { id: note.slug, draft: note, published: note, publishedAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z", revision: 0, archived: false, source: "repository" };
const banner: ManagedBannerDraft = { kind: "banner", category: "ad", placement: "site-top", title: "제휴 안내", description: "행사 안내", imageDesktop: "", imageMobile: "", imageAlt: "", link: "https://example.com/event", startsAt: null, endsAt: null, priority: 10, dismissible: true };

beforeEach(() => { fixture.store.clear();fixture.calls.mockClear();fixture.queue = Promise.resolve();vi.stubEnv("FIREBASE_SERVICE_ACCOUNT", "fixture"); });
afterEach(() => vi.unstubAllEnvs());

describe("managed content validation", () => {
  it.each(["//evil.test", "/%2fevil.test", "/%5cevil.test", "javascript:alert(1)", "https://user:secret@example.com", "http://example.com", "/bad\npath"])("rejects unsafe destination %s", link => {
    expect(isSafeContentLink(link)).toBe(false);
    expect(() => parseManagedDraft({ ...banner, link })).toThrow();
  });
  it("accepts internal and secure external links and requires an ad destination", () => {
    expect(isSafeContentLink("/service/notices/first-notice?from=banner")).toBe(true);
    expect(isSafeContentLink("https://example.com/event?id=4")).toBe(true);
    expect(() => parseManagedDraft({ ...banner, link: "" }, true)).toThrow("연결 주소");
  });
  it("rejects arbitrary image URLs, inconsistent windows and impossible dates", () => {
    expect(() => parseManagedDraft({ ...banner, imageDesktop: "https://evil.test/image.svg" })).toThrow();
    expect(() => parseManagedDraft({ ...banner, startsAt: "2026-10-27T00:00:00Z", endsAt: "2026-10-26T00:00:00Z" })).toThrow("종료 시간");
    expect(() => parseManagedDraft({ ...note, startsAt: "2026-02-31T00:00:00Z" })).toThrow("날짜");
    expect(() => parseManagedDraft({ ...note, startsAt: "2026-10-26T10:00:00" })).toThrow("날짜");
  });
  it("allows an incomplete draft but validates required publication fields", () => {
    expect(parseManagedDraft({ ...note, content: "" }).kind).toBe("notice");
    expect(() => parseManagedDraft({ ...note, content: "" }, true)).toThrow();
    expect(() => parseManagedDraft({ ...banner, placement: "home" }, true)).toThrow("기본 이미지");
  });
  it("rejects mass assignment, unknown actions and traversal IDs", () => {
    expect(() => parseContentMutation({ id: "../private", expectedRevision: 0, action: "archive" })).toThrow();
    expect(() => parseContentMutation({ id: "notice", expectedRevision: 0, action: "delete" })).toThrow();
    expect(() => parseContentMutation({ id: "notice", expectedRevision: 0, action: "publish", draft: { ...note, publishedAt: "2020-01-01" } })).toThrow();
  });
});

describe("publication snapshots and optimistic writes", () => {
  it("preserves immutable original identity through every editor action and rejects assignment", async () => {
    const metadata = { publicId: "019", date: "2026-10-16", author: "Original author", lang: "en" as const, sourceSha256: "a".repeat(64) };
    const original = { ...seed, noticeMetadata: metadata };
    const saved = await mutateManagedContent({ id: seed.id, expectedRevision: 0, action: "save", draft: note }, original);
    expect(saved.noticeMetadata).toEqual(metadata);
    expect((await readManagedContentRecords())[0].noticeMetadata).toEqual(metadata);
    const published = await mutateManagedContent({ id: seed.id, expectedRevision: 1, action: "publish", draft: note });
    expect(published.noticeMetadata).toEqual(metadata);
    const archived = await mutateManagedContent({ id: seed.id, expectedRevision: 2, action: "archive" });
    expect(archived.noticeMetadata).toEqual(metadata);
    expect(() => parseContentMutation({ id: seed.id, expectedRevision: 3, action: "restore", noticeMetadata: { ...metadata, author: "Replaced" } })).toThrow();
  });
  it("preserves a repository publication while saving and later publishes the draft without changing its canonical date", async () => {
    const changed = { ...note, content: "수정 중 본문" };
    const saved = await mutateManagedContent({ id: seed.id, expectedRevision: 0, action: "save", draft: changed }, seed);
    expect(saved.published?.kind === "notice" && saved.published.content).toBe("원래 본문");
    expect(saved.draft).toEqual(changed);expect(saved.revision).toBe(1);
    expect(saved.publishedRevision).toBe(0);expect(saved.publishedUpdatedAt).toBe(seed.updatedAt);
    const published = await mutateManagedContent({ id: seed.id, expectedRevision: 1, action: "publish", draft: changed }, seed);
    expect(published.published).toEqual(changed);expect(published.publishedAt).toBe(seed.publishedAt);
    const savedAgain = await mutateManagedContent({ id: seed.id, expectedRevision: 2, action: "save", draft: { ...changed, title: "다음 편집" } });
    expect(savedAgain.publishedRevision).toBe(published.publishedRevision);
    expect(savedAgain.publishedUpdatedAt).toBe(published.publishedUpdatedAt);
  });
  it("rejects concurrent stale revisions rather than overwriting another editor", async () => {
    await mutateManagedContent({ id: seed.id, expectedRevision: 0, action: "save", draft: note }, seed);
    const result = await Promise.allSettled([1, 2].map(index => mutateManagedContent({ id: seed.id, expectedRevision: 1, action: "save", draft: { ...note, title: `편집 ${index}` } }, seed)));
    expect(result.filter(item => item.status === "fulfilled")).toHaveLength(1);
    const rejected = result.find(item => item.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ status: 409, code: "CONTENT_CONFLICT" });
  });
  it("unpublishes and archives without destroying a draft; restoring does not republish", async () => {
    const archived = await mutateManagedContent({ id: seed.id, expectedRevision: 0, action: "archive" }, seed);
    expect(archived.published).toBeNull();expect(archived.draft).toEqual(note);expect(archived.archived).toBe(true);
    await expect(mutateManagedContent({ id: seed.id, expectedRevision: 1, action: "publish", draft: note })).rejects.toMatchObject({ status: 409 });
    const restored = await mutateManagedContent({ id: seed.id, expectedRevision: 1, action: "restore" });
    expect(restored.published).toBeNull();expect(restored.archived).toBe(false);
  });
  it("never exposes drafts, scheduled or expired publications as live", () => {
    const now = Date.parse("2026-10-26T12:00:00Z");
    expect(isPublishedNow(seed, now)).toBe(true);
    expect(isPublishedNow({ ...seed, published: null }, now)).toBe(false);
    expect(isPublishedNow({ ...seed, published: { ...note, startsAt: "2026-10-26T12:00:01Z" } }, now)).toBe(false);
    expect(isPublishedNow({ ...seed, published: { ...note, endsAt: "2026-10-26T12:00:00Z" } }, now)).toBe(false);
  });
  it("binds reviewed English to its Korean source through draft saves and archive/restore", async () => {
    const bilingual = { ...note, english: { title: "Notice", summary: "Summary", content: "Original English" } };
    const bilingualSeed = { ...seed, draft: bilingual, published: bilingual };
    const changed = { ...bilingual, content: "바뀐 한국어 본문" };
    await mutateManagedContent({ id: seed.id, expectedRevision: 0, action: "save", draft: changed }, bilingualSeed);
    await expect(mutateManagedContent({ id: seed.id, expectedRevision: 1, action: "publish", draft: changed })).rejects.toMatchObject({ code: "ENGLISH_REVIEW_REQUIRED", field: "english" });
    await mutateManagedContent({ id: seed.id, expectedRevision: 1, action: "archive" });
    await mutateManagedContent({ id: seed.id, expectedRevision: 2, action: "restore" });
    await expect(mutateManagedContent({ id: seed.id, expectedRevision: 3, action: "publish", draft: changed })).rejects.toMatchObject({ code: "ENGLISH_REVIEW_REQUIRED" });
    const reviewed = await mutateManagedContent({ id: seed.id, expectedRevision: 3, action: "publish", draft: { ...changed, english: { ...changed.english, content: "Reviewed English" } } });
    expect(reviewed.published?.kind === "notice" && reviewed.published.english?.content).toBe("Reviewed English");
    expect(reviewed).not.toHaveProperty("draftEnglishSourceHash");
  });
  it("accepts explicit English review only when an authorized editor publishes", async () => {
    const bilingual = { ...note, english: { title: "Notice", summary: "", content: "English" } };
    const bilingualSeed = { ...seed, draft: bilingual, published: bilingual };
    const changed = { ...bilingual, content: "맞춤법 수정" };
    await mutateManagedContent({ id: seed.id, expectedRevision: 0, action: "save", draft: changed }, bilingualSeed);
    const published = await mutateManagedContent({ id: seed.id, expectedRevision: 1, action: "publish", draft: changed, englishReviewed: true });
    expect(published.published).toEqual(changed);
    expect(() => parseContentMutation({ id: seed.id, expectedRevision: 2, action: "save", draft: changed, englishReviewed: true })).toThrow();
  });
  it("fails closed for missing config, corruption and invalid immutable identity", async () => {
    vi.stubEnv("FIREBASE_SERVICE_ACCOUNT", "");
    expect(await readManagedContentRecords()).toEqual([]);expect(fixture.calls).not.toHaveBeenCalled();
    await expect(mutateManagedContent({ id: seed.id, expectedRevision: 0, action: "save", draft: note }, seed)).rejects.toMatchObject({ status: 503 });
    vi.stubEnv("FIREBASE_SERVICE_ACCOUNT", "fixture");
    fixture.store.set("bad", { ...seed, revision: 1 });
    await expect(readManagedContentRecords()).rejects.toMatchObject({ status: 503 });
    fixture.store.clear();
    await expect(mutateManagedContent({ id: seed.id, expectedRevision: 0, action: "save", draft: { ...note, slug: "changed" } }, seed)).rejects.toMatchObject({ status: 400 });
  });
  it("rejects new records at the bounded list capacity without making the dashboard unreadable", async () => {
    for (let i = 0; i < 500; i++) fixture.store.set(`fixture-${i}`, {});
    await expect(mutateManagedContent({ id: seed.id, expectedRevision: 0, action: "save", draft: note }, seed)).rejects.toMatchObject({ code: "CONTENT_CAPACITY_REACHED" });
    expect(fixture.store.size).toBe(500);
  });
});
