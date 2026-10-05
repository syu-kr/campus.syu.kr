// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
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
});

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
