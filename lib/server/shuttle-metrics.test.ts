import { afterEach, expect, it, vi } from "vitest";
import { flushShuttleMetrics, recordShuttleMetric } from "./shuttle-metrics";

afterEach(() => { flushShuttleMetrics(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
it("logs numeric totals and excludes identifiers and unknown fields", () => {
  vi.stubEnv("FIRESTORE_USAGE_LOGS", "1");
  const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
  recordShuttleMetric("content.list", { reads: 12, documents: 12 });
  recordShuttleMetric("content.list", { reads: 5, documents: 5 });
  recordShuttleMetric("private-vehicle-123", { reads: 100 });
  recordShuttleMetric("shuttle.read", { reads: NaN, vehicleId: "private" } as never);
  flushShuttleMetrics();
  const output = String(log.mock.calls[0][1]);
  expect(JSON.parse(output)["content.list"]).toEqual({ reads: 17, documents: 17 });
  expect(output).not.toMatch(/private|vehicleId/);
});
