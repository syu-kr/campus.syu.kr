import { expect, it } from "vitest";
import { evaluateShuttleForecasts } from "./shuttle-eta-evaluation";
const at = Date.parse("2026-11-03T13:00:00+09:00");
const row = { route: "seokgye", runId: "private-run", visitId: "seokgye-taereung-7", issuedAt: at, arrivalAt: at + 240000, baselineArrivalAt: at + 300000 };
const arrival = { route: row.route, runId: row.runId, visitId: row.visitId, observedAt: at + 300000, method: "receiver" };
it("joins exact trips and reports misses, coverage and early error without identifiers", () => {
  const result = evaluateShuttleForecasts({ forecasts: [row, { ...row, issuedAt:at+1000, arrivalAt: null }, { ...row, runId: "different" }], arrivals: [arrival] });
  expect(result.unmatched).toBe(1);
  expect(result.groups[0]).toMatchObject({ opportunities: 2, independentRuns: 1, coverage: .5, pairedOpportunities:1,pairedIndependentRuns:1, model: { n:1,maeSeconds: 60, earlyRate: 1 }, baseline: { n:1,maeSeconds: 0 } });
  expect(JSON.stringify(result)).not.toContain("private-run");
});
it("compares only common opportunities and reports one-sided availability separately",()=>{
  const result=evaluateShuttleForecasts({forecasts:[row,{...row,issuedAt:at+1000,baselineArrivalAt:null},{...row,issuedAt:at+2000,arrivalAt:null}],arrivals:[arrival]});
  expect(result.groups[0]).toMatchObject({opportunities:3,coverage:2/3,baselineCoverage:2/3,pairedOpportunities:1,pairedIndependentRuns:1,model:{n:1,maeSeconds:60},baseline:{n:1,maeSeconds:0}});
  expect(result.availability).toMatchObject({opportunities:3,modelOffered:2,baselineOffered:2});
});
it("rejects duplicate opportunities and future training metadata rather than inflating sample counts",()=>{
  expect(()=>evaluateShuttleForecasts({forecasts:[row,row],arrivals:[arrival]})).toThrow("Duplicate forecast opportunity");
  expect(()=>evaluateShuttleForecasts({forecasts:[row,{...row,arrivalAt:null}],arrivals:[arrival]})).toThrow("Duplicate forecast opportunity");
  expect(()=>evaluateShuttleForecasts({forecasts:[{...row,modelTrainedThrough:at+1}],arrivals:[arrival]})).toThrow("Invalid forecast");
  expect(()=>evaluateShuttleForecasts({forecasts:[{...row,baselineTrainedThrough:at+1}],arrivals:[arrival]})).toThrow("Invalid forecast");
});
it("keeps a repeated trip id on another service day from joining as the same arrival",()=>{
  const issuedAt=Date.parse("2026-11-03T23:59:00+09:00");
  const result=evaluateShuttleForecasts({forecasts:[{...row,issuedAt,arrivalAt:null,baselineArrivalAt:null}],arrivals:[{...arrival,observedAt:issuedAt+120000}]});
  expect(result).toMatchObject({unmatched:1,rejected:{invalidTiming:1},groups:[]});
});
it("keeps ambiguous truth ambiguous even when one candidate precedes the forecast",()=>{
  const result=evaluateShuttleForecasts({forecasts:[row],arrivals:[arrival,{...arrival,observedAt:at-1}]});
  expect(result.rejected.ambiguousArrival).toBe(1);
});
it("reports dense forecasts as one independent run and emits only catalog dimensions",()=>{
  const forecasts=Array.from({length:10000},(_,i)=>({...row,issuedAt:at+i,privateVehicleId:"synthetic-secret"}));
  const result=evaluateShuttleForecasts({forecasts,arrivals:[arrival]});
  expect(result.groups[0]).toMatchObject({opportunities:10000,independentRuns:1,pairedOpportunities:10000,pairedIndependentRuns:1});
  expect(JSON.stringify(result)).not.toMatch(/private-run|synthetic-secret|runId|privateVehicleId/);
});
it("counts a large ambiguous group once per forecast without searching every truth candidate",()=>{
  const forecasts=Array.from({length:10000},(_,i)=>({...row,issuedAt:at+i}));
  const arrivals=Array.from({length:10000},()=>arrival);
  const result=evaluateShuttleForecasts({forecasts,arrivals});
  expect(result).toMatchObject({unmatched:10000,rejected:{ambiguousArrival:10000},groups:[]});
});
it("rejects future-issued or ambiguous matches and malformed snapshots", () => {
  expect(evaluateShuttleForecasts({ forecasts: [{ ...row, issuedAt: at + 360000, arrivalAt: null, baselineArrivalAt: null }], arrivals: [arrival] }).unmatched).toBe(1);
  expect(evaluateShuttleForecasts({ forecasts: [row], arrivals: [arrival, arrival] }).unmatched).toBe(1);
  expect(() => evaluateShuttleForecasts({ forecasts: [{ ...row, issuedAt: NaN }], arrivals: [] })).toThrow();
});
