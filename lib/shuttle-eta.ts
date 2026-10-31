import { getKoreaDateTimeParts } from "./korea-time";
import { serviceVisits, type ShuttleRoute } from "./shuttle-visits";

export type StopEta = { visitId: string; arrivalAt: number; measuredAt: number; validUntil: number };
export type EtaResponse = { status: "collecting" | "active"; arrivals: StopEta[] };
type Phase = "moving" | "dwelling";
type Leg = {
  from: string;
  medianSeconds: number;
  // Null means unmeasured. It must never be treated as zero.
  dwellSeconds: number | null;
  fixedDeparture: boolean;
  bins?: { weekday: number; halfHour: number; samples: number; dates: number; medianSeconds: number }[];
};
// One reviewed origin/phase → destination. Supporting legs do not authorize other destinations.
export type EtaCandidate = {
  route: ShuttleRoute; shape: string; pattern: string; phase: Phase;
  target: string; legs: Leg[]; validFrom: string; validThrough: string;
  horizonMinutes: 10 | 20;
  entryWindow: { weekdays: number[]; startMinute: number; endMinute: number };
};
export type EtaRelease = EtaCandidate & {
  evidence: string;
  validation: {
    independentRuns: number; coverage: number; incorrectService: number;
    near: HorizonErrors; far?: HorizonErrors;
  };
};
type HorizonErrors = { n: number; maeSeconds: number; p90Seconds: number };

export function passedFieldGate(model: EtaRelease) {
  const gate = model.validation;
  const passed = (stats: HorizonErrors | undefined, mae: number, p90: number) =>
    !!stats && Number.isInteger(stats.n) && stats.n > 0 &&
    stats.maeSeconds >= 0 && stats.maeSeconds <= mae && stats.p90Seconds >= 0 && stats.p90Seconds <= p90;
  return !!model.evidence.trim() && Number.isInteger(gate.independentRuns) && gate.independentRuns >= 10 &&
    gate.coverage >= 0.9 && gate.coverage <= 1 && gate.incorrectService === 0 && passed(gate.near, 90, 180) &&
    (model.horizonMinutes === 10 || (model.horizonMinutes === 20 && passed(gate.far, 120, 240)));
}

const MAX_AGE = 90_000;
const dateFormatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" });
export function etaServiceDate(ms: number) { return dateFormatter.format(ms); }
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function timestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 8.64e15;
}
function positive(value: number) { return Number.isFinite(value) && value > 0; }

function legSeconds(leg: Leg, entry: number) {
  const { dayOfWeek, hour, minute } = getKoreaDateTimeParts(new Date(entry));
  const bin = leg.bins?.find(b => b.weekday === dayOfWeek && b.halfHour === hour * 2 + Math.floor(minute / 30)
    && b.samples >= 30 && b.dates >= 3 && positive(b.medianSeconds));
  return bin?.medianSeconds ?? leg.medianSeconds;
}

export function calculateCandidateArrivals(input: unknown, candidates: readonly EtaCandidate[],
  patterns: Partial<Record<ShuttleRoute, string>>, now: number): StopEta[] {
  if (!timestamp(now) || !Array.isArray(input) || input.length > 10) return [];
  const day = etaServiceDate(now), arrivals: StopEta[] = [];
  for (const [index, fix] of input.entries()) {
    if (!record(fix) || fix.passenger !== true || fix.match !== "verified" || fix.serviceDate !== day ||
      typeof fix.runId !== "string" || !fix.runId.trim() || typeof fix.vehicleKey !== "string" || !fix.vehicleKey.trim() ||
      input.some((other, n) => n !== index && record(other) && (other.runId === fix.runId || other.vehicleKey === fix.vehicleKey)) ||
      !timestamp(fix.measuredAt) || !timestamp(fix.receivedAt) || !timestamp(fix.enteredAt) ||
      fix.enteredAt > fix.measuredAt || fix.measuredAt > fix.receivedAt || fix.receivedAt > now ||
      now >= fix.measuredAt + MAX_AGE || etaServiceDate(fix.enteredAt) !== day ||
      (fix.phase !== "moving" && fix.phase !== "dwelling") ||
      typeof fix.fraction !== "number" || !Number.isFinite(fix.fraction) || fix.fraction < 0 || fix.fraction >= 1 ||
      (fix.phase === "dwelling" && fix.fraction !== 0)) continue;

    const entry = getKoreaDateTimeParts(new Date(fix.enteredAt));
    const minute = entry.hour * 60 + entry.minute;
    for (const model of candidates) {
      if (model.route !== fix.route || model.shape !== fix.shape || !model.pattern ||
        model.pattern !== patterns[model.route] || model.pattern !== fix.pattern || model.phase !== fix.phase ||
        day < model.validFrom || day > model.validThrough || !model.entryWindow.weekdays.includes(entry.dayOfWeek) ||
        minute < model.entryWindow.startMinute || minute >= model.entryWindow.endMinute ||
        !model.legs.length || model.legs[0].from !== fix.from) continue;
      const visits = serviceVisits[model.route], start = visits.findIndex(v => v.id === fix.from);
      if (start < 0 || visits[start + model.legs.length]?.id !== model.target) continue;

      let time = fix.measuredAt, validUntil = fix.measuredAt + MAX_AGE;
      for (const [i, leg] of model.legs.entries()) {
        if (leg.from !== visits[start + i].id) { time = NaN; break; }
        const moving = i === 0 && fix.phase === "moving";
        if (!moving) {
          if (leg.dwellSeconds === null || !Number.isFinite(leg.dwellSeconds) || leg.dwellSeconds < 0) { time = NaN; break; }
          time = (i === 0 ? fix.enteredAt : time) + leg.dwellSeconds * 1000;
          if (leg.fixedDeparture) {
            const hold = record(fix.departures) ? fix.departures[leg.from] : null;
            if (!timestamp(hold) || etaServiceDate(hold) !== day) { time = NaN; break; }
            time = Math.max(time, hold);
          }
          // An overdue departure with no movement confirmation is not a new departure.
          if (i === 0) {
            validUntil = Math.min(validUntil, time);
            if (time <= now) { time = NaN; break; }
          }
        }
        const seconds = legSeconds(leg, moving ? fix.enteredAt : time);
        if (!positive(seconds)) { time = NaN; break; }
        time += seconds * (moving ? 1 - fix.fraction : 1) * 1000;
      }
      const arrivalAt = Math.round(time);
      if (arrivalAt > now && arrivalAt - fix.measuredAt <= model.horizonMinutes * 60_000 &&
          etaServiceDate(arrivalAt) === day) {
        arrivals.push({ visitId: model.target, arrivalAt, measuredAt: fix.measuredAt, validUntil });
      }
    }
  }
  return arrivals.sort((a, b) => a.arrivalAt - b.arrivalAt);
}

// Recheck in the browser between polls and after returning from a suspended tab.
export function nextStopEtas(rows: readonly StopEta[], now: number) {
  const result = new Map<string, number>();
  for (const row of rows) {
    if (!(row.measuredAt <= now && now < row.validUntil && row.validUntil <= row.measuredAt + MAX_AGE &&
      row.arrivalAt > now && row.arrivalAt <= row.measuredAt + 20 * 60_000)) continue;
    const minutes = Math.ceil((row.arrivalAt - now) / 60_000);
    result.set(row.visitId, Math.min(minutes, result.get(row.visitId) ?? Infinity));
  }
  return result;
}
