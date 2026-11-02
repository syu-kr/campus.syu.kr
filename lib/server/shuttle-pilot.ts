import { GET as getPositions } from "@/app/api/bus/shuttle/route";
import { getKoreaDateTimeParts } from "../korea-time";
import { etaServiceDate } from "../shuttle-eta";
import { toBusLocation } from "../shuttle-location";
import { loadShuttleServiceData } from "./shuttle-service-data";
import { pilotRoutes, servicePattern } from "../shuttle-service-window";
import { shuttleVehicleKey } from "./shuttle-vehicle";
import { pilotVisits, type PilotFieldEvent, type PilotObservation } from "../shuttle-observations";
import { savePilotSample } from "./shuttle-pilot-store";
import { ApiError } from "./http";
import { recordShuttleMetric } from "./shuttle-metrics";

let refresh: { key: string; promise: ReturnType<typeof receivePositions> } | undefined;

export function readPilotFieldEvent(value: unknown): PilotFieldEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError("현장 기록 형식이 올바르지 않습니다");
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => !["vehicleId", "visitId", "event", "observedAt"].includes(key)) ||
    typeof row.vehicleId !== "string" || !/^[A-Za-z0-9가-힣_-]{1,128}$/.test(row.vehicleId) ||
    typeof row.visitId !== "string" || !/^[a-z0-9-]{1,100}$/.test(row.visitId) ||
    typeof row.event !== "string" || !["arrival", "departure", "pass"].includes(row.event) || !Number.isSafeInteger(row.observedAt) ||
    Number(row.observedAt) > Date.now() + 5_000 || Date.now() - Number(row.observedAt) > 120_000) {
    throw new ApiError("차량·정류장·확인 시각을 다시 확인해 주세요");
  }
  return row as PilotFieldEvent;
}

export function pilotWeekend(now: Date) {
  const {dayOfWeek} = getKoreaDateTimeParts(now);
  return dayOfWeek === 0 || dayOfWeek === 6;
}

// Only the server's receiver can supply observations. The requester cannot submit coordinates, dates or trip IDs.
export async function pilotPositions(save: boolean, field?: PilotFieldEvent) {
  if (field) return receivePositions(save, field);
  const key = `${process.env.VERCEL_ENV}:${save}:${Math.floor(Date.now() / 5_000)}`;
  if (refresh?.key === key) {
    recordShuttleMetric("collection.refresh", { cacheHits: 1 });
    const value = await refresh.promise;
    if (Date.now() - Date.parse(value.timestamp) >= 90_000) return {
      success: true, source: "shuttle", data: [], timestamp: new Date().toISOString(),
      stale: true, sourceStatus: "stale", collection: "delayed",
    };
    return value;
  }
  recordShuttleMetric("collection.refresh", { cacheMisses: 1 });
  const entry = { key, promise: receivePositions(save) };
  refresh = entry;
  void entry.promise.then(value => { if (value.collection === "delayed" && refresh === entry) refresh = undefined; }, () => undefined);
  void entry.promise.catch(() => { if (refresh === entry) refresh = undefined; });
  return entry.promise;
}

async function receivePositions(save: boolean, field?: PilotFieldEvent) {
  const start = new Date();
  const empty = (state: "closed" | "empty" | "delayed") => ({
    success:true, source:"shuttle", data:[], timestamp:new Date().toISOString(),
    stale:state==="delayed", sourceStatus:state==="delayed"?"stale":"fresh", collection:state,
  });
  if (pilotWeekend(start)) return empty("closed");
  const service = await loadShuttleServiceData();
  if (service.source !== "firebase-storage") return empty("closed");
  const calendar = [service.buses, service.specialPeriods, service.holidays] as const;
  const allowed = (at: Date) => pilotRoutes(at, ...calendar);
  if (!allowed(new Date()).length) return empty("closed");
  const res = await getPositions();
  if (!res.ok) throw new Error("Shuttle receiver unavailable");
  const value = await res.json();
  const now = new Date(), receipt = Date.parse(value.timestamp);
  if (value.success !== true || value.stale !== false || value.sourceStatus !== "fresh" ||
    !Number.isFinite(receipt) || receipt > +now || +now - receipt >= 90_000 ||
    !Array.isArray(value.data) || value.data.length > 100) return empty("delayed");
  const atReceipt = allowed(new Date(receipt)), atWrite = allowed(now);
  if (!atWrite.length || etaServiceDate(receipt) !== etaServiceDate(+now)) return empty("closed");
  const candidates = (value.data as unknown[]).map(toBusLocation).filter((bus): bus is NonNullable<typeof bus> =>
    !!bus && bus.status !== 0 && atWrite.includes(bus.routeid) && atReceipt.includes(bus.routeid) &&
    (bus.measuredAt === undefined || (bus.measuredAt <= receipt && receipt - bus.measuredAt < 90_000)));
  const seen = new Set<string>(), duplicates = new Set<string>();
  for (const bus of candidates) { if (seen.has(bus.id)) duplicates.add(bus.id); else seen.add(bus.id); }
  const data = candidates.filter(bus => !duplicates.has(bus.id));
  const result = (collection:string) => ({success:true,source:"shuttle",stale:false,sourceStatus:"fresh",timestamp:value.timestamp,data,collection});
  if (!save) return result("ready");
  if (process.env.VERCEL_ENV !== "production") return result("local");
  const day = etaServiceDate(receipt);
  const rows: PilotObservation[] = data.map(bus => ({
    vehicleKey:shuttleVehicleKey(bus.id, receipt),
    routeId:bus.routeid as 1 | 2 | 3, lat:Number(bus.lat), lon:Number(bus.lon), status:bus.status as 1 | 2,
    observedAt:receipt, measuredAt:bus.measuredAt ?? receipt, measurementSource:bus.measuredAt === undefined ? "receiver" : "source",
    pattern:servicePattern((["hwarangdae", "seokgye", "byeollae"] as const)[bus.routeid - 1], now, ...calendar)!,
  }));
  let selected: typeof field & { vehicleKey: string } | undefined;
  if (field) {
    const index = data.findIndex(bus => bus.id === field.vehicleId);
    if (index < 0) throw new ApiError("현재 수신된 차량을 다시 선택해 주세요", 409);
    if (!pilotVisits(rows[index].routeId, rows[index].status).some(visit => visit.id === field.visitId)) {
      throw new ApiError("차량 방향에 맞는 정류장을 선택해 주세요");
    }
    selected = { ...field, vehicleKey: rows[index].vehicleKey };
  }
  // Recheck the clock after I/O. A request initiated during service must not cross into closure.
  const writeBlock = () => {
    const final = new Date(), finalRoutes = allowed(final);
    if (etaServiceDate(+final) !== day || !finalRoutes.length || !rows.every(r => finalRoutes.includes(r.routeId))) return "closed" as const;
    if (+final - receipt >= 90_000) return "delayed" as const;
  };
  const collection=await savePilotSample(rows,receipt,writeBlock,selected);
  const blocked = writeBlock() ?? (collection === "closed" || collection === "delayed" ? collection : undefined);
  if (blocked) return empty(blocked);
  return data.length?result(collection):empty(collection==="closed"?"closed":collection==="delayed"?"delayed":"empty");
}
