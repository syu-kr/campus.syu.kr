import { pilotPositions } from "./shuttle-pilot";
import { readShuttleEta } from "./shuttle-eta";
import { calculateCandidateArrivals, nextStopEtas } from "../shuttle-eta";

const locationHeaders = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

export async function handleShuttleLocations(publicCache = false) {
  try {
    const payload = await pilotPositions(true);
    let cache = locationHeaders["Cache-Control"];
    if (publicCache && payload.success && !payload.stale && payload.sourceStatus === "fresh" && payload.collection !== "closed") {
      const now = Date.now(), receipt = Date.parse(payload.timestamp);
      // Collection eligibility changes on minute boundaries; a cached receipt must also stay under 90 seconds.
      const seconds = Math.min(5, Math.floor((60_000 - now % 60_000) / 1000), Math.floor((receipt + 90_000 - now) / 1000));
      if (receipt <= now && seconds > 0) cache = `public, max-age=0, s-maxage=${seconds}, must-revalidate`;
    }
    return Response.json(payload, { headers: { ...locationHeaders, "Cache-Control": cache } });
  } catch {
    return Response.json({ success: false, data: [] }, { status: 503, headers: locationHeaders });
  }
}

export async function handleShuttleEta(req?: Request, previewDiagnostics = false) {
  try {
    const query = req ? new URL(req.url).searchParams : undefined;
    const vehicleId = query?.get("vehicleId") ?? undefined;
    const invalidVehicle = vehicleId !== undefined &&
      (!/^[A-Za-z0-9가-힣_-]{1,128}$/.test(vehicleId) || query!.getAll("vehicleId").length !== 1);
    if (invalidVehicle || (!previewDiagnostics && query?.has("check"))) {
      return Response.json({ status: "unavailable", arrivals: [] }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    if (previewDiagnostics && query?.get("check") === "1") {
      // The preview probe uses fixed inputs and never accesses collection or storage.
      const time = Date.parse("2026-11-03T15:00:00+09:00"), route = "seokgye", from = "seokgye-4", target = "seokgye-taereung-7";
      const rows = calculateCandidateArrivals([
        { route, from, serviceDate: "2026-11-03", runId: "test", vehicleKey: "test", pattern: "test", shape: "test", match: "verified", passenger: true, phase: "moving", fraction: 0.2, enteredAt: time - 60000, measuredAt: time, receivedAt: time },
      ], [
        { route, target, pattern: "test", shape: "test", phase: "moving", validFrom: "2026-11-03", validThrough: "2026-11-03", horizonMinutes: 10,
          entryWindow: { weekdays: [2], startMinute: 0, endMinute: 1440 }, legs: [{ from, medianSeconds: 300, dwellSeconds: null, fixedDeparture: false }] },
      ], { seokgye: "test" }, time);
      return Response.json({ source: "synthetic", passed: nextStopEtas(rows, time).get(target) === 4 && nextStopEtas(rows, time + 90_000).size === 0 },
        { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
    }
    const eta = await readShuttleEta(vehicleId);
    // A position may expire between requests, so stale-while-revalidate is unsuitable here.
    let cache = "private, no-store";
    if (vehicleId === undefined) {
      const now = Date.now();
      const expirySeconds = eta.arrivals.map(row => Math.floor((row.validUntil - now) / 1000));
      const seconds = Math.min(eta.status === "collecting" ? 60 : 5, Math.floor((60_000 - now % 60_000) / 1000), ...expirySeconds);
      cache = seconds > 0 ? `public, max-age=0, s-maxage=${seconds}, must-revalidate` : "no-store";
    }
    return Response.json(eta, { headers: { "Cache-Control": cache } });
  } catch {
    return Response.json({ status: "unavailable", arrivals: [] }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
