import { etaServiceDate } from "./shuttle-eta";
import { serviceVisits } from "./shuttle-visits";

export type PilotObservation = {
  vehicleKey: string; routeId: 1 | 2 | 3; status: 1 | 2; pattern: string;
  lat: number; lon: number; observedAt: number; measuredAt: number;
  measurementSource: "source" | "receiver";
};
type PilotState = PilotObservation & {
  runId: string; firstObservedAt: number; originObserved: boolean;
  stopId: string | null; lastVisitIndex: number;
};
export type PilotEvent = {
  vehicleKey: string; runId: string; routeId: number; status: number; pattern: string;
  visitId: string; event: "arrival" | "departure" | "pass";
  observedAt: number; windowStart: number | null; windowEnd: number;
  measuredAt: number; measurementSource: "source" | "receiver" | "field-observer";
  method: "receiver-geofence" | "field-observer"; validation: "candidate" | "reported";
};
export type PilotFieldEvent = { vehicleId: string; visitId: string; event: PilotEvent["event"]; observedAt: number };

export function pilotVisits(routeId: number, status: number) {
  if (routeId === 1) return status === 2 ? serviceVisits.hwarangdae : [
    { ...serviceVisits.hwarangdae[1], id: "hwarangdae-return-campus", label: { ko: "학교 출발 · 복귀 이동", en: "Campus departure · return movement" } },
    { ...serviceVisits.hwarangdae[0], id: "hwarangdae-return-station", label: { ko: "화랑대역 도착 · 복귀 이동", en: "Hwarangdae arrival · return movement" } },
  ];
  if (routeId === 2) return status === 1 ? serviceVisits.seokgye.slice(0, 4) : serviceVisits.seokgye.slice(3);
  if (routeId === 3) return status === 1 ? serviceVisits.byeollae.slice(0, 2) : serviceVisits.byeollae.slice(1);
  return [];
}

function distance(point: PilotObservation, target: readonly [number, number]) {
  const rad = Math.PI / 180, lat = (target[0] - point.lat) * rad, lon = (target[1] - point.lon) * rad;
  const a = Math.sin(lat / 2) ** 2 + Math.cos(point.lat * rad) * Math.cos(target[0] * rad) * Math.sin(lon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

function readPilotState(value: unknown, point: PilotObservation): PilotState | undefined {
  if (!value || typeof value !== "object") return;
  const row = value as PilotState;
  if (row.vehicleKey === point.vehicleKey && typeof row.runId === "string" && row.runId.length > 0 && row.runId.length <= 256 &&
    [1,2,3].includes(row.routeId) && [1,2].includes(row.status) && ["source","receiver"].includes(row.measurementSource) &&
    Number.isSafeInteger(row.observedAt) && Number.isSafeInteger(row.measuredAt) && Number.isSafeInteger(row.firstObservedAt) &&
    row.firstObservedAt > 0 && row.firstObservedAt <= row.observedAt &&
    Number.isInteger(row.lastVisitIndex) && row.lastVisitIndex >= -1 && row.lastVisitIndex <= 6 && typeof row.originObserved === "boolean" &&
    typeof row.pattern === "string" && (row.stopId === null || typeof row.stopId === "string")) return row;
}

export function advancePilotObservation(value: unknown, point: PilotObservation) {
  const previous = readPilotState(value, point), visits = pilotVisits(point.routeId, point.status);
  if (previous && point.observedAt <= previous.observedAt) return { state: previous, events: [], advanced: false };
  const continuous = previous && previous.routeId === point.routeId && previous.status === point.status &&
    previous.pattern === point.pattern && previous.measurementSource === point.measurementSource &&
    etaServiceDate(previous.observedAt) === etaServiceDate(point.observedAt) &&
    point.observedAt - previous.observedAt <= 120_000;
  // Registered place radii need field calibration. These events never count as verified ground truth.
  const oldStop = continuous ? visits.find(visit => visit.id === previous.stopId) : undefined;
  const stop = oldStop && distance(point, oldStop.point) <= 125 ? oldStop :
    visits.find(visit => distance(point, visit.point) <= 75);
  const index = stop ? visits.findIndex(visit => visit.id === stop.id) : -1;
  const restart = !continuous || (index >= 0 && index < previous.lastVisitIndex);
  const prior = restart ? undefined : previous;
  if (prior?.measurementSource === "source" && point.measurementSource === "source" && point.measuredAt <= prior.measuredAt) {
    return { state: prior, events: [], advanced: false };
  }
  const state: PilotState = {
    ...point,
    runId: prior?.runId ?? `${etaServiceDate(point.observedAt)}:${point.vehicleKey}:${point.routeId}:${point.status}:${point.observedAt}`,
    firstObservedAt: prior?.firstObservedAt ?? point.observedAt,
    originObserved: Boolean(prior?.originObserved || index === 0),
    stopId: stop?.id ?? null, lastVisitIndex: Math.max(prior?.lastVisitIndex ?? -1, index),
  };
  const events: PilotEvent[] = [];
  const event = (visitId: string, kind: PilotEvent["event"]) => events.push({
    vehicleKey: point.vehicleKey, runId: state.runId, routeId: point.routeId, status: point.status, pattern: point.pattern,
    visitId, event: kind, observedAt: point.observedAt,
    windowStart: prior?.measuredAt ?? null, windowEnd: point.measuredAt,
    measuredAt: point.measuredAt, measurementSource: point.measurementSource,
    method: "receiver-geofence", validation: "candidate",
  });
  if (prior?.stopId && prior.stopId !== state.stopId) event(prior.stopId, "departure");
  if (state.stopId && state.stopId !== prior?.stopId) event(state.stopId, "arrival");
  return { state, events, advanced: true };
}
