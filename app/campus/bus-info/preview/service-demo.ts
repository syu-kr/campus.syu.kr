import type { BusLocation } from "@/types";
import { serviceTimetable, type ServiceRoute, type ShuttleServiceData } from "./service-data";
import { koreaDateKey } from "./preview-timetable";
import { pointAlongPath, serviceRoadPaths } from "./service-visits";

// Demonstration travel times, not live GPS. Departures come from the applied timetable.
const profiles: Record<string, { arrivals: number[]; departures: number[] }> = {
  hwarangdae: { arrivals: [0, 480], departures: [0, 500] },
  "hwarangdae-outbound": { arrivals: [0, 900], departures: [0, 920] },
  seokgye: { arrivals: [0, 240, 420, 660, 840, 1260], departures: [0, 260, 440, 680, 860, 1280] },
  byeollae: { arrivals: [0, 540, 1080], departures: [0, 560, 1100] },
};

export function demoDepartures(route: ServiceRoute, data: ShuttleServiceData): number[] {
  const now = new Date(data.nowISO), date = koreaDateKey(now);
  const timetable = serviceTimetable({ route, date, now, data });
  if (timetable.status !== "ready") return [];
  const departures = timetable.times.map(time => (Date.parse(`${date}T${time}:00+09:00`) - now.getTime()) / 1000);
  const end = profiles[route.id].departures.at(-1)!;
  const first = departures.findIndex(at => at + end >= 0);
  return first < 0 ? [] : departures.slice(first);
}

function runs(departures: readonly number[], nextAvailable: boolean) {
  return (nextAvailable ? departures : departures.slice(0, 1)).map((at, run) => ({ at, run }));
}

export function demoEventTime(route: ServiceRoute, stop: number, passed = false, departures: readonly number[] = [0], elapsed = 0) {
  const profile = profiles[route.id];
  const at = departures.find(at => at + profile.departures[stop] >= elapsed) ?? departures.at(-1) ?? 0;
  return at + (passed ? profile.departures[stop] + 1 : profile.arrivals[stop]);
}

export function demoStopArrival(route: ServiceRoute, elapsed: number, stop: number, nextAvailable: boolean, delayed = false, runOnly?: number, departures: readonly number[] = [0]) {
  if (delayed) return { state: "delayed" as const, seconds: null, run: null };
  const profile = profiles[route.id];
  for (const { at, run } of runs(departures, nextAvailable)) {
    if (runOnly !== undefined && run !== runOnly) continue;
    const arrival = at + profile.arrivals[stop], departure = at + profile.departures[stop];
    if (elapsed > departure) continue;
    return {
      state: elapsed < arrival ? "approaching" as const : "arrived" as const,
      seconds: Math.max(0, arrival - elapsed), run,
    };
  }
  return { state: "passed" as const, seconds: null, run: null };
}

export function demoProgress(route: ServiceRoute, elapsed: number, nextAvailable: boolean, departures: readonly number[] = [0]) {
  const profile = profiles[route.id];
  return runs(departures, nextAvailable).flatMap(({ at, run }) => {
    const progress = elapsed - at;
    if (progress < 0 || progress > profile.departures.at(-1)!) return [];
    let position = 0;
    for (let index = 0; index < profile.arrivals.length - 1; index++) {
      if (progress >= profile.arrivals[index + 1]) { position = index + 1; continue; }
      position = index + Math.max(0, Math.min(1, (progress - profile.departures[index]) / (profile.arrivals[index + 1] - profile.departures[index])));
      break;
    }
    return [{ id: `demo-${route.id}-${run}`, run, position, next: Math.min(route.stops.length - 1, Math.ceil(position)) }];
  });
}

export function demoLocations(route: ServiceRoute, elapsed: number, nextAvailable: boolean, departures: readonly number[] = [0]): BusLocation[] {
  const paths = serviceRoadPaths(route);
  return demoProgress(route, elapsed, nextAvailable, departures).map(bus => {
    const segment = Math.min(paths.length - 1, Math.floor(bus.position));
    const point = pointAlongPath(paths[segment], bus.position - segment);
    return { id: bus.id, name: "demo", lat: String(point[0]), lon: String(point[1]), status: route.oneWay || bus.position >= route.target ? 2 : 1, routeid: route.locationRouteId as BusLocation["routeid"] };
  });
}
