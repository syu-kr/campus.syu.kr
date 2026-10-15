import { headers } from "next/headers";

import BusInfoPageClient from "@/app/campus/bus-info/BusInfoPageClient";
import { getKoreaNow } from "@/lib/home";
import {
  getHomeShuttleBuses,
  getHomeShuttleSpecialPeriods,
  getHomePublicHolidays,
} from "@/lib/server/home-data";

const CSP_NONCE_HEADER_NAME = "x-csp-nonce";

export default async function BusInfoPage() {
  const headerStore = await headers();
  const nonce = headerStore.get(CSP_NONCE_HEADER_NAME) || undefined;
  const [shuttleBuses, shuttleSpecialPeriods, holidays] = await Promise.all([
    getHomeShuttleBuses(),
    getHomeShuttleSpecialPeriods(),
    getHomePublicHolidays(),
  ]);
  return (
    <BusInfoPageClient
      initialData={{
        buses: shuttleBuses,
        specialPeriods: shuttleSpecialPeriods,
        holidays,
        nowISO: getKoreaNow().toISOString(),
        nonce,
      }}
    />
  );
}
