"use client";

import { useQuery } from "@tanstack/react-query";
import { etaServiceDate, nextStopEtas, type EtaResponse } from "@/lib/shuttle-eta";
import { shuttleRefreshDelay } from "@/lib/shuttle-polling";

export type ShuttleEtaEndpoint = "/api/bus/shuttle/eta" | "/campus/bus-info/preview/eta";
export function useStopArrivals(now: Date, enabled: boolean, vehicleId?: string, polling = true, endpoint: ShuttleEtaEndpoint = "/campus/bus-info/preview/eta") {
  const query = useQuery({
    queryKey: ["shuttle-stop-arrivals", vehicleId ?? null, etaServiceDate(now.getTime()),endpoint],
    queryFn: async ({ signal }): Promise<EtaResponse> => {
      const response = await fetch(`${endpoint}${vehicleId === undefined ? "" : `?vehicleId=${encodeURIComponent(vehicleId)}`}`, { cache: "no-store", signal });
      if (!response.ok) throw new Error("Shuttle ETA unavailable");
      return response.json();
    },
    enabled, staleTime: polling ? 5_000 : 60_000, retry: false, refetchIntervalInBackground: false,
    refetchInterval: enabled && polling ? shuttleRefreshDelay : false,
  });
  const minutes = nextStopEtas(enabled && !query.isError ? query.data?.arrivals ?? [] : [], now.getTime());
  const status = query.isError ? "error" : query.isPending ? "loading" : query.data?.status === "collecting" ? "collecting" : query.data?.status === "learning" ? "learning" : "waiting";
  const scheduled = new Map((enabled && !query.isError ? query.data?.scheduledArrivals ?? [] : [])
    .filter(item => Number.isFinite(item.arrivalAt) && etaServiceDate(item.arrivalAt) === etaServiceDate(now.getTime()))
    .map(item => [item.visitId, item]));
  return { minutes, scheduled, status } as const;
}
