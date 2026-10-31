import type { Locale } from "@/lib/i18n/routing";
import { getShuttlePreviewCopy } from "@/lib/i18n/shuttle-preview";
import { getShuttleServiceCopy } from "@/lib/i18n/shuttle-service-preview";
import { demoStopArrival } from "./service-demo";
import type { ServiceRoute } from "./service-data";
import { serviceVisits } from "./service-visits";

export function stopArrivalLabels(route: ServiceRoute, locale: Locale, sample: boolean, elapsed: number, nextAvailable: boolean, delayed: boolean, closed: boolean, estimates?: ReadonlyMap<string, number>) {
  const copy = getShuttlePreviewCopy(locale), live = getShuttleServiceCopy(locale);
  return route.stops.map((_, index) => {
    const verified = !sample && !closed ? estimates?.get(serviceVisits[route.id][index].id) : undefined;
    if (verified !== undefined) {
      const time = `${verified}${locale === "ko" ? "" : " "}${copy.minutes}`;
      return { verified: true, eta: `${copy.approx} ${time}`, detail: "", following: "", message: live.arrivesIn.replace("{time}", time) };
    }
    const arrival = sample ? demoStopArrival(route, elapsed, index, nextAvailable, delayed) : null;
    const minutes = arrival?.seconds != null ? `${Math.ceil(arrival.seconds / 60)}${locale === "ko" ? "" : " "}${copy.minutes}` : "";
    let eta = closed ? live.dayClosed : live.stopEta;
    let detail = "";
    if (arrival) {
      switch (arrival.state) {
        case "approaching": eta = `${copy.approx} ${minutes}`; break;
        case "waiting": eta = copy.arrived; detail = `${live.departIn} ${minutes}`; break;
        case "arrived": eta = copy.arrived; break;
        case "passed": eta = copy.passed; break;
        case "delayed": eta = live.arrivalUnknown; break;
      }
    }
    const following = arrival?.run === 1 ? live.nextVehicle : "";
    const message = arrival?.state === "approaching" ? live.arrivesIn.replace("{time}", minutes) : eta;
    return { verified: false, eta, detail, following, message: [following, message, detail].filter(Boolean).join(" · ") };
  });
}
