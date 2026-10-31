import { createHmac } from "node:crypto";
import { GET as getPositions } from "@/app/api/bus/shuttle/route";
import { getKoreaDateTimeParts } from "../korea-time";
import { etaServiceDate } from "../shuttle-eta";
import { toBusLocation } from "../shuttle-location";
import { getFirestore, admin } from "./firestore";
import { getHomePublicHolidays, getHomeShuttleBuses, getHomeShuttleSpecialPeriods } from "./home-data";
import { pilotRoutes } from "./shuttle-eta";
import { requireServerEnv } from "./env";

export function pilotWeekend(now: Date) {
  const {dayOfWeek} = getKoreaDateTimeParts(now);
  return dayOfWeek === 0 || dayOfWeek === 6;
}

// Only the server's receiver can supply observations. The requester cannot submit coordinates, dates or trip IDs.
export async function pilotPositions(save: boolean) {
  const start = new Date();
  const empty = (state: "closed" | "empty" | "delayed") => ({
    success:true, source:"shuttle", data:[], timestamp:new Date().toISOString(),
    stale:state==="delayed", sourceStatus:state==="delayed"?"stale":"fresh", collection:state,
  });
  if (pilotWeekend(start)) return empty("closed");
  const calendar = await Promise.all([getHomeShuttleBuses(), getHomeShuttleSpecialPeriods(), getHomePublicHolidays()] as const);
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
  const data = (value.data as unknown[]).map(toBusLocation).filter((bus): bus is NonNullable<typeof bus> =>
    !!bus && bus.status !== 0 && atWrite.includes(bus.routeid) && atReceipt.includes(bus.routeid));
  if (!data.length) return empty("empty");
  const result = (collection:string) => ({success:true,source:"shuttle",stale:false,sourceStatus:"fresh",timestamp:value.timestamp,data,collection});
  if (!save) return result("ready");
  if (process.env.VERCEL_ENV !== "production") return result("local");
  const secret = requireServerEnv("RATE_LIMIT_SECRET"), day = etaServiceDate(receipt);
  const rows = data.map(bus => ({
    vehicleKey:createHmac("sha256", secret).update(`shuttle-pilot:${day}:${bus.id}`).digest("hex").slice(0,24),
    routeId:bus.routeid, lat:Number(bus.lat), lon:Number(bus.lon), status:bus.status,
  }));
  const doc = getFirestore().collection("shuttle_pilot_receipts").doc(String(Math.floor(receipt / 60_000)));
  // Recheck the clock after I/O. A request initiated during service must not cross into closure.
  const final = new Date(), finalRoutes = allowed(final);
  if (etaServiceDate(+final) !== day || +final - receipt >= 90_000 ||
      !rows.every(r => finalRoutes.includes(r.routeId))) return empty("closed");
  try {
    await doc.create({ receivedAt:receipt, measuredAt:null, rows, expires_at:admin.firestore.Timestamp.fromMillis(receipt + 30 * 86400_000) });
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === 6)) throw error;
    return result("duplicate");
  }
  return result("saved");
}
