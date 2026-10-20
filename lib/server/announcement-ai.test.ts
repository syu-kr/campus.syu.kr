// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Announcement, AnnouncementAiSummary } from "@/types";

const mocks = vi.hoisted(() => ({ snapshot: vi.fn(), metadata: vi.fn() }));
vi.mock("./crawl-data", () => ({
  readDailyCrawlDataSnapshot: mocks.snapshot,
  readDailyCrawlDataJson: mocks.metadata,
}));

const announcement: Announcement = {
  id: "notice-1", category: "academic", title: "장학 안내", date: "2026.10.20",
  author: "학생처", content: "가".repeat(400), views: 0, isImportant: false,
  url: "https://www.syu.ac.kr/notice/1?utm_source=test#content",
};
const aiSummary: AnnouncementAiSummary = {
  summary: "장학 신청 안내", target: "재학생", deadline: "2026.10.31",
  requiredAction: "신청", keywords: ["장학"], importance: "normal", confidence: "high",
  generatedAt: "2026-10-20T00:00:00Z", sourceHash: "bb85bdce1ca48ec1",
};
const metadata = { version: 1, generatedAt: aiSummary.generatedAt, items: { "academic:notice-1": aiSummary } };

function snapshot(data: Announcement[]) {
  return { source: "github-pages", data };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-20T00:00:00Z"));
  mocks.snapshot.mockReset().mockImplementation(async (file: string) =>
    snapshot(file === "announcements-academic.json" ? [announcement] : []));
  mocks.metadata.mockReset().mockResolvedValue(metadata);
});
afterEach(() => { vi.useRealTimers(); });

it("starts summary metadata on the first nonempty source before slower sources and keeps full-body matching", async () => {
  const academic = deferred<ReturnType<typeof snapshot>>();
  const campus = deferred<ReturnType<typeof snapshot>>();
  const pendingMetadata = deferred<typeof metadata>();
  mocks.snapshot.mockImplementation((file: string) => file === "announcements-academic.json"
    ? academic.promise : file === "announcements-campus-life.json" ? campus.promise : Promise.resolve(snapshot([])));
  mocks.metadata.mockReturnValue(pendingMetadata.promise);
  const { getAnnouncementSummary } = await import("./announcements");
  let settled = false;
  const pending = getAnnouncementSummary(12).then((items) => { settled = true; return items; });
  expect(mocks.snapshot).toHaveBeenCalledTimes(4);
  expect(mocks.metadata).not.toHaveBeenCalled();

  academic.resolve(snapshot([announcement]));
  await vi.waitFor(() => expect(mocks.metadata).toHaveBeenCalledTimes(1));
  expect(mocks.metadata).toHaveBeenCalledWith("announcement-ai-metadata.json");
  expect(settled).toBe(false);
  pendingMetadata.resolve(metadata);
  campus.resolve(snapshot([{ ...announcement, id: "campus", category: "campus", date: "2026.10.19" }]));

  const items = await pending;
  expect(items.map((item) => item.id)).toEqual(["notice-1", "campus"]);
  expect(items[0]).toEqual({ ...announcement, content: "가".repeat(240), aiSummary });
  expect(mocks.metadata).toHaveBeenCalledTimes(1);
  const { attachAnnouncementAiSummaries } = await import("./announcement-ai");
  expect((await attachAnnouncementAiSummaries([{ ...announcement, content: "가".repeat(240) }]))[0].aiSummary).toBeUndefined();
});

it("does not fetch metadata for an empty summary, page or missing detail", async () => {
  mocks.snapshot.mockResolvedValue(snapshot([]));
  const { getAnnouncementSummary, getAnnouncementPage, getAnnouncementById } = await import("./announcements");
  expect(await getAnnouncementSummary(12)).toEqual([]);
  expect((await getAnnouncementPage({})).items).toEqual([]);
  expect(await getAnnouncementById("academic", "missing")).toBeNull();
  expect(mocks.metadata).not.toHaveBeenCalled();
});

it.each([0, 0.5])("does not preload metadata when summary limit %s yields no items", async (limit) => {
  const { getAnnouncementSummary } = await import("./announcements");
  expect(await getAnnouncementSummary(limit)).toEqual([]);
  expect(mocks.metadata).not.toHaveBeenCalled();
});

it("shares in-flight metadata between preload and attachment and retains the 60-second cache", async () => {
  const pendingMetadata = deferred<typeof metadata>();
  mocks.metadata.mockReturnValueOnce(pendingMetadata.promise);
  const { preloadAnnouncementAiMetadata, attachAnnouncementAiSummaries } = await import("./announcement-ai");
  preloadAnnouncementAiMetadata();
  const pending = attachAnnouncementAiSummaries([announcement]);
  expect(mocks.metadata).toHaveBeenCalledTimes(1);
  pendingMetadata.resolve(metadata);
  expect((await pending)[0].aiSummary).toEqual(aiSummary);
  vi.advanceTimersByTime(59_999);
  await attachAnnouncementAiSummaries([announcement]);
  expect(mocks.metadata).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1);
  preloadAnnouncementAiMetadata();
  expect((await attachAnnouncementAiSummaries([announcement]))[0].aiSummary).toEqual(aiSummary);
  expect(mocks.metadata).toHaveBeenCalledTimes(2);
});

it("keeps metadata failures optional and caches null until the existing TTL expires", async () => {
  const error = new Error("metadata unavailable");
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.metadata.mockRejectedValueOnce(error);
  const { preloadAnnouncementAiMetadata, attachAnnouncementAiSummaries } = await import("./announcement-ai");
  const items = [announcement];
  preloadAnnouncementAiMetadata();
  expect(await attachAnnouncementAiSummaries(items)).toBe(items);
  expect(logged).toHaveBeenCalledWith("Failed to read announcement AI metadata:", error);
  vi.advanceTimersByTime(59_999);
  expect(await attachAnnouncementAiSummaries(items)).toBe(items);
  expect(mocks.metadata).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1);
  expect((await attachAnnouncementAiSummaries(items))[0].aiSummary).toEqual(aiSummary);
  expect(mocks.metadata).toHaveBeenCalledTimes(2);
});

it.each([null, { version: 2, items: {} }, { version: 1, items: null }])("keeps invalid metadata optional after preload: %j", async (value) => {
  mocks.metadata.mockResolvedValue(value);
  const { preloadAnnouncementAiMetadata, attachAnnouncementAiSummaries } = await import("./announcement-ai");
  const items = [announcement];
  preloadAnnouncementAiMetadata();
  expect(await attachAnnouncementAiSummaries(items)).toBe(items);
  expect(mocks.metadata).toHaveBeenCalledTimes(1);
});
