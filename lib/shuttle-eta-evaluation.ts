import { getKoreaDateTimeParts } from "./korea-time";
import { etaServiceDate } from "./shuttle-eta";
import { serviceVisits, type ShuttleRoute } from "./shuttle-visits";

type Forecast = {
  route: ShuttleRoute; runId: string; visitId: string; issuedAt: number;
  arrivalAt: number | null; baselineArrivalAt: number | null;
  modelTrainedThrough?: number; baselineTrainedThrough?: number;
};
type Arrival = { route: ShuttleRoute; runId: string; visitId: string; observedAt: number; method: "receiver" | "source" | "field" };
const timestamp = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0 && Number(value) < 8.64e15;
function identity(value: Forecast | Arrival) {
  return typeof value.runId === "string" && value.runId.trim().length > 0 && value.runId.length <= 256 &&
    Object.hasOwn(serviceVisits, value.route) && serviceVisits[value.route].some(visit => visit.id === value.visitId);
}
function stats(errors: number[]) {
  if (!errors.length) return null;
  const absolute = errors.map(Math.abs).sort((a, b) => a - b);
  return { n: errors.length, maeSeconds: absolute.reduce((a, b) => a + b, 0) / errors.length,
    p90Seconds: absolute[Math.ceil(errors.length * .9) - 1], earlyRate: errors.filter(error => error < 0).length / errors.length };
}
function arrivalKey(row: Forecast | Arrival) { return JSON.stringify([row.route, row.runId, row.visitId]); }
type Group = {
  total: number; runs: Set<string>; modelOffered: number; baselineOffered: number;
  pairedRuns: Set<string>; model: number[]; baseline: number[];
};

// Private snapshots join by trip; only aggregate scores leave this function.
export function evaluateShuttleForecasts(input: unknown) {
  const data = input as { forecasts: Forecast[]; arrivals: Arrival[] };
  if (!data || !Array.isArray(data.forecasts) || !Array.isArray(data.arrivals) ||
    data.forecasts.length > 100_000 || data.arrivals.length > 100_000) throw new Error("Invalid forecast snapshot");
  const forecastKeys = new Set<string>();
  let modelOffered = 0, baselineOffered = 0;
  for (const row of data.forecasts) {
    if (!row || !identity(row) || !timestamp(row.issuedAt) ||
      row.arrivalAt !== null && (!timestamp(row.arrivalAt) || row.arrivalAt < row.issuedAt || etaServiceDate(row.arrivalAt) !== etaServiceDate(row.issuedAt)) ||
      row.baselineArrivalAt !== null && (!timestamp(row.baselineArrivalAt) || row.baselineArrivalAt < row.issuedAt || etaServiceDate(row.baselineArrivalAt) !== etaServiceDate(row.issuedAt)) ||
      row.modelTrainedThrough !== undefined && (!timestamp(row.modelTrainedThrough) || row.modelTrainedThrough > row.issuedAt) ||
      row.baselineTrainedThrough !== undefined && (!timestamp(row.baselineTrainedThrough) || row.baselineTrainedThrough > row.issuedAt)) throw new Error("Invalid forecast");
    const key = JSON.stringify([row.route, row.runId, row.visitId, row.issuedAt]);
    if (forecastKeys.has(key)) throw new Error("Duplicate forecast opportunity");
    forecastKeys.add(key);
    if (row.arrivalAt !== null) modelOffered++;
    if (row.baselineArrivalAt !== null) baselineOffered++;
  }
  const arrivals = new Map<string, Arrival[]>();
  for (const row of data.arrivals) {
    if (!row || !identity(row) || !timestamp(row.observedAt) || !["receiver", "source", "field"].includes(row.method)) throw new Error("Invalid arrival");
    const key = arrivalKey(row), matches = arrivals.get(key) ?? [];
    matches.push(row);
    arrivals.set(key, matches);
  }
  const groups = new Map<string, Group>();
  const rejected = { missingArrival: 0, ambiguousArrival: 0, invalidTiming: 0 };
  for (const row of data.forecasts) {
    const matches = arrivals.get(arrivalKey(row));
    if (!matches?.length) { rejected.missingArrival++; continue; }
    // Ambiguous truth is never resolved by selecting a convenient timestamp or method.
    if (matches.length !== 1) { rejected.ambiguousArrival++; continue; }
    const observed = matches[0];
    if (observed.observedAt < row.issuedAt || observed.observedAt - row.issuedAt > 2 * 3600_000 ||
      etaServiceDate(observed.observedAt) !== etaServiceDate(row.issuedAt)) { rejected.invalidTiming++; continue; }
    const clock = getKoreaDateTimeParts(new Date(row.issuedAt));
    const key = JSON.stringify([row.route, row.visitId, clock.dayOfWeek, clock.hour * 2 + Math.floor(clock.minute / 30), observed.method]);
    const group = groups.get(key) ?? { total: 0, runs: new Set<string>(), modelOffered: 0, baselineOffered: 0, pairedRuns: new Set<string>(), model: [], baseline: [] };
    group.total++; group.runs.add(row.runId);
    if (row.arrivalAt !== null) group.modelOffered++;
    if (row.baselineArrivalAt !== null) group.baselineOffered++;
    // Both score arrays contain exactly the same forecast opportunities.
    if (row.arrivalAt !== null && row.baselineArrivalAt !== null) {
      group.model.push((row.arrivalAt - observed.observedAt) / 1000);
      group.baseline.push((row.baselineArrivalAt - observed.observedAt) / 1000);
      group.pairedRuns.add(row.runId);
    }
    groups.set(key, group);
  }
  return {
    forecasts: data.forecasts.length,
    availability: {
      opportunities: data.forecasts.length, modelOffered, baselineOffered,
      coverage: data.forecasts.length ? modelOffered / data.forecasts.length : null,
      baselineCoverage: data.forecasts.length ? baselineOffered / data.forecasts.length : null,
    },
    unmatched: rejected.missingArrival + rejected.ambiguousArrival + rejected.invalidTiming,
    rejected,
    groups: [...groups].map(([key, group]) => ({
      dimensions: JSON.parse(key) as [ShuttleRoute, string, number, number, string],
      opportunities: group.total, independentRuns: group.runs.size,
      coverage: group.modelOffered / group.total, baselineCoverage: group.baselineOffered / group.total,
      pairedOpportunities: group.model.length, pairedIndependentRuns: group.pairedRuns.size,
      model: stats(group.model), baseline: stats(group.baseline),
    })),
  };
}
