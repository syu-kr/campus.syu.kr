import { Activity, Suspense } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const readers = vi.hoisted(() => ({
  getAnnouncementSummary: vi.fn(),
  getAllServiceNotices: vi.fn(),
  getHomeAcademicSchedules: vi.fn(),
  getHomePublicHolidays: vi.fn(),
}));

const overviewReaders = vi.hoisted(() => ({
  getHomeCafeteriaSnapshot: vi.fn(),
  getHomeShuttleBuses: vi.fn(),
  getHomeShuttleSpecialPeriods: vi.fn(),
}));

vi.mock("@/lib/server/announcements", () => readers);
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/serviceNotices", () => readers);
vi.mock("@/lib/server/public-managed-content", () => ({ getPublicBanners: vi.fn(async () => []) }));
vi.mock("@/lib/server/home-data", () => ({ ...readers, ...overviewReaders }));
vi.mock("@/lib/home", () => ({
  getKoreaNow: () => new Date("2026-10-19T00:00:00.000Z"),
}));
vi.mock("@/app/features/home/HomeDashboardClient", () => ({ HomeDashboardClient: () => null }));
vi.mock("@/app/features/home/HomeSearchBar", () => ({ HomeSearchBar: () => null }));
vi.mock("@/app/components/PageLoadingSkeletons", () => ({ HomePageSkeleton: () => null }));

import { HomePageSkeleton } from "@/app/components/PageLoadingSkeletons";
import { HomeDashboardClient } from "@/app/features/home/HomeDashboardClient";
import { HomeSearchBar } from "@/app/features/home/HomeSearchBar";

let Home: typeof import("./page").default;
let revalidate: number;
let generateMetadata: typeof import("./page").generateMetadata;
const initialProps = {
  initialAnnouncements: [{ id: "announcement" }],
  initialServiceNotices: [{ id: "service" }],
  initialSchedules: [{ id: "schedule" }],
  initialPublicHolidays: { holidays: [] },
};
const initialOverviewData = { cafeteria: { menus: [], checkedAt: null, stale: false }, shuttles: [], specialPeriods: { specialPeriods: [], semesterPeriods: [], vacationPeriods: [] } };
const expectedProps = { ...initialProps, initialServiceNoticesFailed: false, initialBanners: [], initialOverviewData, initialNowIso: "2026-10-19T00:00:00.000Z" };

function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

async function prepareWarmHome() {
  const child = Home().props.children[1].props.children;
  await child.type(child.props);
  Object.values(readers).forEach((reader) => reader.mockClear());
  return Home().props.children[1];
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.spyOn(globalThis, "clearTimeout");
  Object.values(readers).forEach((reader, index) => {
    reader.mockReset().mockResolvedValue(Object.values(initialProps)[index]);
  });
  Object.values(overviewReaders).forEach((reader, index) => reader.mockReset().mockResolvedValue(Object.values(initialOverviewData)[index]));
  ({ default: Home, revalidate, generateMetadata } = await import("./page"));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("keeps public home indexing and excludes nonempty search result URLs", async () => {
  expect(await generateMetadata({ searchParams: Promise.resolve({}) })).toEqual({});
  expect(await generateMetadata({ searchParams: Promise.resolve({ search: " " }) })).toEqual({});
  expect(await generateMetadata({ searchParams: Promise.resolve({ search: ["시간표"] }) })).toEqual({ robots: { index: false, follow: true } });
});

it("renders search before and outside the cold data boundary without starting data reads", () => {
  const [search, data] = Home().props.children;
  expect(search.type).toBe(HomeSearchBar);
  expect(data.type).toBe(Suspense);
  expect(Object.values(readers).every((reader) => reader.mock.calls.length === 0)).toBe(true);
  expect(Object.values(overviewReaders).every((reader) => reader.mock.calls.length === 0)).toBe(true);
});

it("keeps campus data available when the managed service notice store fails", async () => {
  readers.getAllServiceNotices.mockRejectedValue(new Error("Notice store unavailable"));
  const child = Home().props.children[1].props.children;
  const content = await child.type(child.props);
  expect(content.props.children.props).toMatchObject({
    initialServiceNotices: [], initialServiceNoticesFailed: true,
    initialAnnouncements: initialProps.initialAnnouncements,
    initialSchedules: initialProps.initialSchedules,
  });
});

it("keeps search independent while resolving required and overview server reads", async () => {
  const pendingReads = Object.values(readers).map((reader) => {
    const read = deferred();
    reader.mockReturnValue(read.promise);
    return read;
  });
  const page = Home().props.children[1];
  expect(page.type).toBe(Suspense);
  expect(page.props.fallback.type).toBe(HomePageSkeleton);
  const child = page.props.children;
  const pendingContent = child.type(child.props);
  // The notice read follows the request's resolved locale; other reads start immediately.
  await Promise.resolve();
  await Promise.resolve();
  expect(Object.values(readers).map((reader) => reader.mock.calls.length)).toEqual(Array(4).fill(1));
  expect(Home().props.children[1].type).toBe(Suspense);
  pendingReads.slice(0, -1).forEach((read, index) => read.resolve(Object.values(initialProps)[index]));
  await Promise.resolve();
  expect(Home().props.children[1].type).toBe(Suspense);
  pendingReads.at(-1)!.resolve(initialProps.initialPublicHolidays);
  const content = await pendingContent;

  expect(content.type).toBe(Activity);
  expect(content.props.mode).toBe("visible");
  expect(content.props.children.type).toBe(HomeDashboardClient);
  expect(content.props.children.props).toEqual(expectedProps);
  expect(Home().props.children[1].type).not.toBe(Suspense);
  expect(vi.getTimerCount()).toBe(0);
  expect(clearTimeout).not.toHaveBeenCalled();
});

it("keeps the cold path after an initial data failure", async () => {
  const error = new Error("initial data failure");
  readers.getAnnouncementSummary.mockRejectedValue(error);
  const child = Home().props.children[1].props.children;

  await expect(child.type(child.props)).rejects.toBe(error);
  expect(Home().props.children[1].type).toBe(Suspense);
  expect(vi.getTimerCount()).toBe(0);
  expect(clearTimeout).not.toHaveBeenCalled();
});

it("returns warm ready data directly with unchanged props and clears the timeout", async () => {
  const warm = await prepareWarmHome();
  const page = await warm.type(warm.props);

  expect(page.type).toBe(Activity);
  expect(page.props.mode).toBe("visible");
  expect(page.props.children.type).toBe(HomeDashboardClient);
  expect(page.props.children.props).toEqual(expectedProps);
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

  expect(content.type).toBe(Activity);
  expect(content.props.mode).toBe("visible");
  expect(content.props.children.type).toBe(HomeDashboardClient);
  expect(content.props.children.props).toEqual(expectedProps);
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

it("keeps the ready home usable if the optional cafeteria source fails", async () => {
  overviewReaders.getHomeCafeteriaSnapshot.mockRejectedValue(new Error("cafeteria unavailable"));
  const child = Home().props.children[1].props.children;
  const content = await child.type(child.props);
  expect(content.props.children.props.initialOverviewData).toEqual({
    ...initialOverviewData, cafeteria: undefined,
  });
  expect(content.props.children.props.initialAnnouncements).toEqual(initialProps.initialAnnouncements);
});
