import { Suspense } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const readers = vi.hoisted(() => ({
  getAnnouncementSummary: vi.fn(),
  getAllServiceNotices: vi.fn(),
  getHomeAcademicSchedules: vi.fn(),
  getHomePublicHolidays: vi.fn(),
}));

const removedReaders = vi.hoisted(() => ({
  getHomeCafeteriaMenus: vi.fn(),
  getHomeShuttleBuses: vi.fn(),
  getHomeShuttleSpecialPeriods: vi.fn(),
}));

vi.mock("@/lib/server/announcements", () => readers);
vi.mock("@/lib/serviceNotices", () => readers);
vi.mock("@/lib/server/home-data", () => ({ ...readers, ...removedReaders }));
vi.mock("@/lib/home", () => ({
  getKoreaNow: () => new Date("2026-10-19T00:00:00.000Z"),
}));
vi.mock("@/app/features/home/HomePageClient", () => ({ HomePageClient: () => null }));
vi.mock("@/app/components/PageLoadingSkeletons", () => ({ HomePageSkeleton: () => null }));

import { HomePageSkeleton } from "@/app/components/PageLoadingSkeletons";
import { HomePageClient } from "@/app/features/home/HomePageClient";

let Home: typeof import("./page").default;
let revalidate: number;
const initialProps = {
  initialAnnouncements: [{ id: "announcement" }],
  initialServiceNotices: [{ id: "service" }],
  initialSchedules: [{ id: "schedule" }],
  initialPublicHolidays: { holidays: [] },
};
const expectedProps = { ...initialProps, initialNowIso: "2026-10-19T00:00:00.000Z" };

function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

async function prepareWarmHome() {
  const child = Home().props.children;
  await child.type(child.props);
  Object.values(readers).forEach((reader) => reader.mockClear());
  return Home();
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.spyOn(globalThis, "clearTimeout");
  Object.values(readers).forEach((reader, index) => {
    reader.mockReset().mockResolvedValue(Object.values(initialProps)[index]);
  });
  Object.values(removedReaders).forEach((reader) => reader.mockReset());
  ({ default: Home, revalidate } = await import("./page"));
});

afterEach(() => {
  Object.values(removedReaders).forEach((reader) => expect(reader).not.toHaveBeenCalled());
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("keeps the synchronous cold boundary until four required reads succeed without meal or shuttle reads", async () => {
  const pendingReads = Object.values(readers).map((reader) => {
    const read = deferred();
    reader.mockReturnValue(read.promise);
    return read;
  });
  const page = Home();
  expect(page.type).toBe(Suspense);
  expect(page.props.fallback.type).toBe(HomePageSkeleton);
  const child = page.props.children;
  const pendingContent = child.type(child.props);
  expect(Object.values(readers).map((reader) => reader.mock.calls.length)).toEqual(Array(4).fill(1));
  expect(Home().type).toBe(Suspense);
  pendingReads.slice(0, -1).forEach((read, index) => read.resolve(Object.values(initialProps)[index]));
  await Promise.resolve();
  expect(Home().type).toBe(Suspense);
  pendingReads.at(-1)!.resolve(initialProps.initialPublicHolidays);
  const content = await pendingContent;

  expect(content.type).toBe(HomePageClient);
  expect(content.props).toEqual(expectedProps);
  expect(Home().type).not.toBe(Suspense);
  expect(vi.getTimerCount()).toBe(0);
  expect(clearTimeout).not.toHaveBeenCalled();
});

it("keeps the cold path after an initial data failure", async () => {
  const error = new Error("initial data failure");
  readers.getAnnouncementSummary.mockRejectedValue(error);
  const child = Home().props.children;

  await expect(child.type(child.props)).rejects.toBe(error);
  expect(Home().type).toBe(Suspense);
  expect(vi.getTimerCount()).toBe(0);
  expect(clearTimeout).not.toHaveBeenCalled();
});

it("returns warm ready data directly with unchanged props and clears the timeout", async () => {
  const warm = await prepareWarmHome();
  const page = await warm.type(warm.props);

  expect(page.type).toBe(HomePageClient);
  expect(page.props).toEqual(expectedProps);
  expect(Object.values(readers).map((reader) => reader.mock.calls.length)).toEqual(Array(4).fill(1));
  expect(readers.getAnnouncementSummary).toHaveBeenCalledWith(12);
  expect(revalidate).toBe(300);
  expect(clearTimeout).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it("streams warm pending data at 20 ms and passes all late results through the same promise", async () => {
  const warm = await prepareWarmHome();
  const pendingReads = Object.values(readers).map((reader) => {
    const read = deferred();
    reader.mockReturnValue(read.promise);
    return read;
  });
  let settled = false;
  const pendingPage = warm.type(warm.props).then((page: unknown) => { settled = true; return page; });
  await vi.advanceTimersByTimeAsync(19);
  expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  const page = await pendingPage;
  expect(page.type).toBe(Suspense);
  expect(page.props.fallback.type).toBe(HomePageSkeleton);
  const child = page.props.children;
  const pendingContent = child.type(child.props);
  pendingReads.forEach((read, index) => read.resolve(Object.values(initialProps)[index]));
  const content = await pendingContent;

  expect(content.type).toBe(HomePageClient);
  expect(content.props).toEqual(expectedProps);
  expect(Object.values(readers).map((reader) => reader.mock.calls.length)).toEqual(Array(4).fill(1));
  expect(clearTimeout).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it("propagates a fast warm failure and clears the timeout", async () => {
  const warm = await prepareWarmHome();
  const error = new Error("fast data failure");
  readers.getAnnouncementSummary.mockRejectedValue(error);

  await expect(warm.type(warm.props)).rejects.toBe(error);
  expect(clearTimeout).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it("propagates a late warm failure through the deferred component", async () => {
  const warm = await prepareWarmHome();
  const read = deferred();
  const error = new Error("late data failure");
  readers.getAnnouncementSummary.mockReturnValue(read.promise);
  const pendingPage = warm.type(warm.props);
  await vi.advanceTimersByTimeAsync(20);
  const page = await pendingPage;
  const child = page.props.children;
  const failure = expect(child.type(child.props)).rejects.toBe(error);
  read.reject(error);

  await failure;
  expect(clearTimeout).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
