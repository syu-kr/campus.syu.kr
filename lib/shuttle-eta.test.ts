import { describe, expect, it } from "vitest";
import { calculateCandidateArrivals, nextStopEtas, passedFieldGate, type EtaRelease } from "./shuttle-eta";

// Synthetic validation numbers exercise the gate. None are included in the release registry.
const t = Date.parse("2026-11-03T16:55:00+09:00"); // Tuesday
const exampleRelease: EtaRelease = {
  route: "seokgye", shape: "road-test", pattern: "mondayToThursday", phase: "moving",
  target: "seokgye-campus-arrival", validFrom: "2026-11-01", validThrough: "2026-11-30",
  evidence: "test-only", horizonMinutes: 20,
  entryWindow: { weekdays: [2], startMinute: 16 * 60, endMinute: 17 * 60 },
  validation: { independentRuns: 10, coverage: .9, incorrectService: 0,
    near: { n: 10, maeSeconds: 55, p90Seconds: 90 }, far: { n: 5, maeSeconds: 100, p90Seconds: 180 } },
  legs: [
    { from: "seokgye-4", medianSeconds: 480, dwellSeconds: null, fixedDeparture: false },
    { from: "seokgye-taereung-7", medianSeconds: 360, dwellSeconds: 60, fixedDeparture: false,
      bins: [{ weekday: 2, halfHour: 34, samples: 30, dates: 3, medianSeconds: 720 }] },
  ],
};
const fix = { vehicleKey: "test-A", runId: "run-A", route: "seokgye", from: "seokgye-4", shape: "road-test",
  pattern: "mondayToThursday", passenger: true, match: "verified", phase: "moving", fraction: .5,
  serviceDate: "2026-11-03", measuredAt: t, receivedAt: t, enteredAt: t - 240_000 };
const patterns = { seokgye: "mondayToThursday" };
const predict = (input: unknown = [fix], model = exampleRelease, now = t) => calculateCandidateArrivals(input, [model], patterns, now);

describe("reviewed stop arrivals", () => {
  it("reselects traffic at predicted segment entry (16:55 + 4 + 1 + 12 = 17:12), then counts down without re-anchoring", () => {
    const [eta] = predict();
    expect(eta).toEqual({ visitId: exampleRelease.target, measuredAt: t, validUntil: t + 90_000, arrivalAt: t + 17 * 60_000 });
    expect(predict([fix], exampleRelease, t + 60_000)).toEqual([eta]);
    expect(nextStopEtas([eta], t + 60_000).get(eta.visitId)).toBe(16);
    expect(nextStopEtas([eta], t + 90_000).size).toBe(0);
    expect(predict([fix], exampleRelease, t + 90_000)).toEqual([]);
  });
  it("uses actual entry for the current segment and the validated median when a time cell is sparse", () => {
    const entry = t - 30 * 60_000;
    const first = { ...exampleRelease.legs[0], bins: [{ weekday: 2, halfHour: 32, samples: 30, dates: 3, medianSeconds: 600 }] };
    const model = { ...exampleRelease, target: "seokgye-taereung-7", legs: [first] };
    expect(predict([{ ...fix, enteredAt: entry }], model)[0].arrivalAt).toBe(t + 300_000);
    first.bins[0].samples--;
    expect(predict([{ ...fix, enteredAt: entry }], model)[0].arrivalAt).toBe(t + 240_000);
  });
  it("honours a fixed departure only after arrival and dwell and never adds terminal dwell", () => {
    const last = { ...exampleRelease.legs[1], fixedDeparture: true };
    const model = { ...exampleRelease, legs: [exampleRelease.legs[0], last] };
    expect(predict([fix], model)).toEqual([]);
    const departures = { "seokgye-taereung-7": t + 7 * 60_000 };
    expect(predict([{ ...fix, departures }], model)[0].arrivalAt).toBe(t + 19 * 60_000);
    expect(predict([fix], { ...model, legs: [model.legs[0], { ...last, dwellSeconds: null }] })).toEqual([]);
    expect(predict([fix], { ...model, target: last.from, legs: [model.legs[0]] })[0].arrivalAt).toBe(t + 240_000);
  });
  it("limits a stop wait to the confirmed departure and never converts a missed ETA into arrival", () => {
    const model: EtaRelease = { ...exampleRelease, phase: "dwelling", target: "seokgye-taereung-7",
      legs: [{ ...exampleRelease.legs[0], dwellSeconds: 30, fixedDeparture: true }] };
    const parked = { ...fix, phase: "dwelling", fraction: 0, enteredAt: t - 50_000, departures: { "seokgye-4": t + 20_000 } };
    expect(predict([parked], model)).toEqual([{ visitId: model.target, measuredAt: t, arrivalAt: t + 500_000, validUntil: t + 20_000 }]);
    expect(predict([parked], model, t + 20_000)).toEqual([]);
    expect(nextStopEtas([{ visitId: model.target, measuredAt: t, arrivalAt: t + 5_000, validUntil: t + 90_000 }], t + 5_000).size).toBe(0);
  });
  it.each([
    { measuredAt: undefined }, { measuredAt: t + 1 }, { receivedAt: t - 1 }, { enteredAt: t + 1 },
    { serviceDate: "2026-11-02" }, { runId: "" }, { passenger: false }, { match: "ambiguous" },
    { shape: "other-road" }, { route: "hwarangdae-outbound" }, { pattern: "fridayVacation" },
    { from: "seokgye-taereung-6" }, { fraction: NaN }, { fraction: 1 }, { phase: "garage" },
  ])("withholds untrusted runs: %o", patch => expect(predict([{ ...fix, ...patch }])).toEqual([]));
  it("never mixes duplicate runs, gaps, expired/unreleased models or unsupported horizons", () => {
    expect(predict([fix, { ...fix, vehicleKey: "B" }])).toEqual([]);
    expect(calculateCandidateArrivals([fix], [], patterns, t)).toEqual([]);
    expect(calculateCandidateArrivals([fix], [exampleRelease], {}, t)).toEqual([]);
    expect(predict([fix], { ...exampleRelease, validThrough: "2026-11-02" })).toEqual([]);
    expect(predict([fix], { ...exampleRelease, entryWindow: { weekdays: [5], startMinute: 0, endMinute: 1440 } })).toEqual([]);
    expect(predict([fix], { ...exampleRelease, entryWindow: { weekdays: [2], startMinute: 0, endMinute: 16 * 60 } })).toEqual([]);
    expect(predict([fix], { ...exampleRelease, horizonMinutes: 10 })).toEqual([]);
    expect(predict([fix], { ...exampleRelease, legs: [exampleRelease.legs[0]] })).toEqual([]);
    for (const bad of [{ coverage: .89 }, { incorrectService: 1 }, { independentRuns: 9 }, { far: undefined },
      { near: { n: 0, maeSeconds: 0, p90Seconds: 0 } }, { far: { n: 30, maeSeconds: 100, p90Seconds: 241 } }])
      expect(passedFieldGate({ ...exampleRelease, validation: { ...exampleRelease.validation, ...bad } })).toBe(false);
  });
  it("chooses the earliest still valid bus per visit, independent of the feed order", () => {
    const later = { ...fix, runId: "run-B", vehicleKey: "B", measuredAt: t - 60_000, fraction: .2 };
    const model = { ...exampleRelease, target: "seokgye-taereung-7", legs: [exampleRelease.legs[0]] };
    const rows = predict([later, fix], model);
    expect(rows).toHaveLength(2);
    expect(nextStopEtas(rows.reverse(), t).get(model.target)).toBe(4);
    const earlier = { ...later, fraction: .7 };
    const overtaking = predict([fix, earlier], model);
    expect(nextStopEtas(overtaking, t).get(model.target)).toBe(2);
    expect(nextStopEtas(overtaking, t + 30_000).get(model.target)).toBe(4);
  });
});
