// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET as publicEta } from "./eta/route";
import { GET as publicLocations } from "./locations/route";
import { GET as previewEta } from "@/app/campus/bus-info/preview/eta/route";

const mocks = vi.hoisted(() => ({ positions: vi.fn(), eta: vi.fn() }));
vi.mock("@/lib/server/shuttle-pilot", () => ({ pilotPositions: mocks.positions }));
vi.mock("@/lib/server/shuttle-eta", () => ({ readShuttleEta: mocks.eta }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.positions.mockResolvedValue({ success: true, data: [], collection: "closed" });
  mocks.eta.mockResolvedValue({ status: "learning", arrivals: [] });
});
afterEach(() => vi.useRealTimers());

it.each([
  ["2026-11-03T15:00:10.000+09:00", 0, "public, max-age=0, s-maxage=5, must-revalidate"],
  ["2026-11-03T15:00:56.500+09:00", 0, "public, max-age=0, s-maxage=3, must-revalidate"],
  ["2026-11-03T15:00:10.000+09:00", 87_000, "public, max-age=0, s-maxage=3, must-revalidate"],
  ["2026-11-03T15:00:59.500+09:00", 0, "private, no-store"],
] as const)("bounds public position caching at the collection and receipt expiry boundaries", async (clock, age, expected) => {
  vi.useFakeTimers({toFake:["Date"]});
  vi.setSystemTime(new Date(clock));
  const timestamp = new Date(Date.now() - age).toISOString();
  mocks.positions.mockResolvedValueOnce({ success: true, sourceStatus: "fresh", stale: false, timestamp, data: [], collection: "saved" });
  const response = await publicLocations();
  expect(response.headers.get("cache-control")).toBe(expected);
  expect((await response.json()).timestamp).toBe(timestamp);
});

it("serves public positions through the shared receiver and redacts failures", async () => {
  const result = await publicLocations();
  expect(await result.json()).toMatchObject({ success: true, collection: "closed" });
  expect(mocks.positions).toHaveBeenCalledWith(true);
  expect(result.headers.get("cache-control")).toBe("private, no-store");
  mocks.positions.mockRejectedValueOnce(new Error("private upstream details"));
  const failure = await publicLocations();
  expect(failure.status).toBe(503);
  expect(await failure.json()).toEqual({ success: false, data: [] });
});

it("preserves private selected-vehicle estimates on the public endpoint", async () => {
  const result = await publicEta(new Request("https://example.invalid/api/bus/shuttle/eta?vehicleId=bus-A"));
  expect(mocks.eta).toHaveBeenCalledWith("bus-A");
  expect(result.headers.get("cache-control")).toBe("private, no-store");
});

it.each([[1000, "public, max-age=0, s-maxage=1, must-revalidate"], [0, "no-store"]] as const)(
  "never caches a general ETA beyond its receipt expiry",
  async (remaining, expected) => {
    vi.useFakeTimers({toFake:["Date"]});
    vi.setSystemTime(new Date("2026-11-03T15:00:10+09:00"));
    mocks.eta.mockResolvedValueOnce({status:"learning",arrivals:[{
      visitId:"seokgye-4",arrivalAt:Date.now()+60000,measuredAt:Date.now()-89000,validUntil:Date.now()+remaining,
    }]});
    const response = await publicEta(new Request("https://example.invalid/api/bus/shuttle/eta"));
    expect(response.headers.get("cache-control")).toBe(expected);
  },
);

it("keeps the synthetic probe exclusive to preview without accessing observations", async () => {
  const denied = await publicEta(new Request("https://example.invalid/api/bus/shuttle/eta?check=1"));
  expect(denied.status).toBe(400);
  expect(mocks.eta).not.toHaveBeenCalled();
  expect(mocks.positions).not.toHaveBeenCalled();
  const diagnostic = await previewEta(new Request("https://example.invalid/campus/bus-info/preview/eta?check=1"));
  expect(await diagnostic.json()).toEqual({ source: "synthetic", passed: true });
  expect(mocks.eta).not.toHaveBeenCalled();
  expect(mocks.positions).not.toHaveBeenCalled();
});

it("rejects conflicting selectors before a database read", async () => {
  const denied = await publicEta(new Request("https://example.invalid/api/bus/shuttle/eta?vehicleId=A&vehicleId=B"));
  expect(denied.status).toBe(400);
  expect(mocks.eta).not.toHaveBeenCalled();
});
