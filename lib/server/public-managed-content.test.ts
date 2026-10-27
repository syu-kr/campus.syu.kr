import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ManagedContentRecord } from "@/types/managed-content";
const db = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));
vi.mock("./managed-content", () => ({ readPublishedManagedContentRecords: db.read, readPublishedManagedContentRecord: async (id: string) => (await db.read()).find((item: ManagedContentRecord) => item.id === id) ?? null }));
import { getPublicBanners, getPublicManagedContentRecords, isVisiblePublication } from "./public-managed-content";
const now = Date.parse("2026-10-26T09:00:00Z");
function banner(id: string, priority = 0): ManagedContentRecord {
  const draft = { kind: "banner" as const, category: "event" as const, placement: "home" as const, title: id, description: "Public", imageDesktop: "", imageMobile: "", imageAlt: "", link: "/more", priority, dismissible: true, startsAt: null, endsAt: null };
  return { id, draft, published: draft, revision: 1, archived: false, source: "database", publishedAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString() };
}
beforeEach(() => { db.read.mockReset().mockResolvedValue([]);vi.stubEnv("FIREBASE_SERVICE_ACCOUNT", "configured"); });
afterEach(() => vi.unstubAllEnvs());
it("does not query a database before CMS configuration exists", async () => {
  vi.stubEnv("FIREBASE_SERVICE_ACCOUNT", "");
  expect(await getPublicManagedContentRecords()).toEqual([]);expect(db.read).not.toHaveBeenCalled();
});
it("filters actual windows on every request, including the exact end boundary", () => {
  const row = banner("timed");row.published!.startsAt = new Date(now).toISOString();row.published!.endsAt = new Date(now + 1000).toISOString();
  expect(isVisiblePublication(row, now - 1)).toBe(false);expect(isVisiblePublication(row, now)).toBe(true);expect(isVisiblePublication(row, now + 1000)).toBe(false);
  row.archived = true;expect(isVisiblePublication(row, now)).toBe(false);
});
it("returns only active public snapshots, placement and priority, capped at three", async () => {
  const hidden = banner("draft", 99);hidden.published = null;
  const archived = banner("archive", 100);archived.archived = true;
  const other = banner("top", 100);if (other.published?.kind === "banner") other.published.placement = "site-top";
  db.read.mockResolvedValue([banner("a", 1), banner("b", 3), banner("c", 2), banner("d", 0), hidden, archived, other]);
  const rows = await getPublicBanners("home", now);
  expect(rows.map(row => row.id)).toEqual(["b", "c", "a"]);
  expect(rows.every(row => !("draft" in row) && !("updatedBy" in row))).toBe(true);
});
it("fails closed for banners and keeps notice DB errors observable", async () => {
  db.read.mockRejectedValue(new Error("unavailable"));
  expect(await getPublicBanners("home", now)).toEqual([]);
  await expect(getPublicManagedContentRecords()).rejects.toThrow("unavailable");
});
it("keeps popup publications separate from inline placements and excludes future popups", async () => {
  const popup = banner("popup", 100);if (popup.published?.kind === "banner") popup.published.placement = "popup";
  const future = banner("future", 1000);if (future.published?.kind === "banner") { future.published.placement = "popup";future.published.startsAt = new Date(now + 1000).toISOString(); }
  db.read.mockResolvedValue([banner("inline"), popup, future]);
  expect((await getPublicBanners("popup", now)).map(row => row.id)).toEqual(["popup"]);
  expect((await getPublicBanners("home", now)).map(row => row.id)).toEqual(["inline"]);
});
it("does not reset a banner dismissal revision when only its draft changes", async () => {
  const row = banner("stable");row.publishedRevision = 1;
  db.read.mockResolvedValue([row]);
  const [before] = await getPublicBanners("home", now);
  row.revision = 2;row.draft = { ...row.draft, title: "Unpublished change" };
  const [afterDraft] = await getPublicBanners("home", now);
  expect(afterDraft.revision).toBe(before.revision);expect(afterDraft.title).toBe(before.title);
  row.publishedRevision = 3;row.published = row.draft;
  const [afterPublish] = await getPublicBanners("home", now);
  expect(afterPublish.revision).not.toBe(before.revision);
});
