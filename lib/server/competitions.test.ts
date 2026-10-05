// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import fixtures from "../../tests/fixtures/competition-keywords.json";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  attach: vi.fn(async (items: unknown[]) => items),
}));
vi.mock("./crawl-data", () => ({ readDailyCrawlDataJson: mocks.read }));
vi.mock("./announcement-ai", () => ({ attachAnnouncementAiSummaries: mocks.attach }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.attach.mockImplementation(async (items: unknown[]) => items);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

it("includes specific contests across spacing and language while excluding unrelated calls", async () => {
  mocks.read.mockResolvedValue(fixtures.map((fixture, index) => ({
    ...fixture, id: `fixture-${index}`, date: "2026.10.05", category: "campus",
  })));
  const { getCompetitionPage } = await import("./competitions");
  const page = await getCompetitionPage({ source: "department", status: "all", limit: 100 });
  expect(page.total).toBe(fixtures.filter((fixture) => fixture.kind !== null).length);
  for (const [index, fixture] of fixtures.entries()) {
    const item = page.items.find((item) => item.id === `fixture-${index}`);
    if (fixture.kind === null) {
      expect(item, fixture.title).toBeUndefined();
    } else {
      expect(item, fixture.title).toMatchObject({ competitionKind: fixture.kind });
    }
  }
});

it.each(["UTC", "Asia/Seoul", "America/Los_Angeles"])("closes a Korean deadline at midnight independently of server timezone %s", async (timezone) => {
  vi.stubEnv("TZ", timezone);
  vi.useFakeTimers();
  mocks.read.mockResolvedValue([{ id: "deadline", title: "테스트 공모전", date: "2026.10.05", category: "campus" }]);
  mocks.attach.mockImplementation(async (items: unknown[]) => items.map((item) => ({ ...item as object, aiSummary: { deadline: "2026.10.05" } })));
  vi.setSystemTime(new Date("2026-10-05T23:59:59.999+09:00"));
  let { getCompetitionPage } = await import("./competitions");
  expect((await getCompetitionPage({ source: "department", status: "all" })).items[0].competitionStatus).toBe("open");
  vi.resetModules();
  vi.setSystemTime(new Date("2026-10-06T00:00:00+09:00"));
  ({ getCompetitionPage } = await import("./competitions"));
  expect((await getCompetitionPage({ source: "department", status: "all" })).items[0].competitionStatus).toBe("closed");
});

it("uses the Korean year for yearless deadlines at the New Year boundary and rejects invalid calendar dates", async () => {
  vi.stubEnv("TZ", "UTC"); vi.useFakeTimers();
  vi.setSystemTime(new Date("2027-01-01T00:10:00+09:00"));
  mocks.read.mockResolvedValue([{ id: "deadline", title: "테스트 공모전", date: "2026.12.31", category: "campus" }]);
  mocks.attach.mockImplementation(async (items: unknown[]) => items.map((item) => ({ ...item as object, aiSummary: { deadline: "1.1" } })));
  let { getCompetitionPage } = await import("./competitions");
  expect((await getCompetitionPage({ source: "department", status: "all" })).items[0].competitionStatus).toBe("open");
  vi.resetModules();
  mocks.attach.mockImplementation(async (items: unknown[]) => items.map((item) => ({ ...item as object, aiSummary: { deadline: "2026.02.30" } })));
  ({ getCompetitionPage } = await import("./competitions"));
  expect((await getCompetitionPage({ source: "department", status: "all" })).items[0].competitionStatus).toBe("open");
});
