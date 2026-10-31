import { readShuttleEta } from "@/lib/server/shuttle-eta";
import { calculateCandidateArrivals, nextStopEtas } from "@/lib/shuttle-eta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req?: Request) {
  try {
    if (req && new URL(req.url).searchParams.get("check") === "1") {
      // An isolated synthetic probe: never consults or writes observation storage.
      const t = Date.parse("2026-11-03T15:00:00+09:00"), route = "seokgye", from = "seokgye-4", target = "seokgye-taereung-7";
      const rows = calculateCandidateArrivals([{route, from, serviceDate:"2026-11-03", runId:"test", vehicleKey:"test", pattern:"test", shape:"test", match:"verified", passenger:true, phase:"moving", fraction:0.2, enteredAt:t-60000, measuredAt:t, receivedAt:t}],
        [{route, target, pattern:"test", shape:"test", phase:"moving", validFrom:"2026-11-03", validThrough:"2026-11-03", horizonMinutes:10,
          entryWindow:{weekdays:[2],startMinute:0,endMinute:1440}, legs:[{from, medianSeconds:300, dwellSeconds:null, fixedDeparture:false}]}], {seokgye:"test"}, t);
      return Response.json({source:"synthetic", passed:nextStopEtas(rows,t).get(target)===4 && nextStopEtas(rows,t+90_000).size===0}, {headers:{"Cache-Control":"private, no-store","X-Robots-Tag":"noindex"}});
    }
    const eta = await readShuttleEta();
    // No stale-while-revalidate: a position may expire between two requests.
    return Response.json(eta, { headers: { "Cache-Control": eta.status === "collecting" ? "public, max-age=0, s-maxage=60" : "public, max-age=0, s-maxage=5, must-revalidate" } });
  } catch {
    return Response.json({ status: "unavailable", arrivals: [] }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
