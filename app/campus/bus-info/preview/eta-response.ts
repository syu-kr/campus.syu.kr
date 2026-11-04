import { etaServiceDate, type EtaResponse } from "@/lib/shuttle-eta";
import { serviceVisits } from "@/lib/shuttle-visits";

const visits = new Set(Object.values(serviceVisits).flat().map(v => v.id));
const timestamp = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0 && Number(value) < 8.64e15;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object";
const basis = (value: unknown) => value === undefined || ["history", "observed", "route"].includes(String(value));
function scheduled(value: unknown) {
  return record(value) && visits.has(String(value.visitId)) && timestamp(value.departureAt) && timestamp(value.arrivalAt) &&
    value.arrivalAt >= value.departureAt && typeof value.travelSeconds === "number" && Number.isFinite(value.travelSeconds) &&
    value.travelSeconds >= 0 && value.travelSeconds < 86400 &&
    etaServiceDate(value.departureAt) === etaServiceDate(value.arrivalAt) &&
    Math.abs(value.arrivalAt-value.departureAt-value.travelSeconds*1000) <= 1000 && basis(value.basis);
}

export function parseEtaResponse(value: unknown): EtaResponse {
  if (record(value) && value.status === "unavailable") return { status:"learning", arrivals:[], scheduledArrivals:[], trips:[] };
  if (!record(value) || !["collecting", "active", "learning"].includes(String(value.status)) ||
    !Array.isArray(value.arrivals) || value.arrivals.length > 100 ||
    value.arrivals.some(row => !record(row) || !visits.has(String(row.visitId)) ||
      !timestamp(row.arrivalAt) || !timestamp(row.measuredAt) || !timestamp(row.validUntil) ||
      row.validUntil <= row.measuredAt || row.validUntil > row.measuredAt + 90000 || !basis(row.basis)) ||
    value.scheduledArrivals !== undefined && (!Array.isArray(value.scheduledArrivals) ||
      value.scheduledArrivals.length > 100 || !value.scheduledArrivals.every(scheduled))) {
    throw new Error("Invalid shuttle ETA response");
  }
  if (value.context !== undefined) {
    const c = value.context;
    if (!record(c) || typeof c.version !== "string" || !c.version || c.version.length > 256 ||
      !timestamp(c.generatedAt) || !timestamp(c.validUntil) ||
      c.serviceDate !== etaServiceDate(c.generatedAt) ||
      c.validUntil > Date.parse(`${c.serviceDate}T00:00:00+09:00`) + 86400000) {
      throw new Error("Invalid shuttle ETA context");
    }
  }
  if (value.trips !== undefined && (!Array.isArray(value.trips) || value.trips.length > 100 ||
    value.trips.some(trip => {
      if (!record(trip)) return true;
      const stops = trip.stops;
      return !Object.hasOwn(serviceVisits, String(trip.route)) ||
      typeof trip.key !== "string" || !trip.key || trip.key.length > 256 || !timestamp(trip.departureAt) ||
      typeof trip.pattern !== "string" || trip.pattern.length > 256 || !Array.isArray(stops) ||
      stops.length !== serviceVisits[trip.route as keyof typeof serviceVisits].length ||
      stops.some((row, i) => !scheduled(row) || row.visitId !== serviceVisits[trip.route as keyof typeof serviceVisits][i].id ||
        row.departureAt !== trip.departureAt || i > 0 && row.arrivalAt < stops[i - 1].arrivalAt);
    }))) {
    throw new Error("Invalid shuttle ETA trips");
  }
  return value as EtaResponse;
}
