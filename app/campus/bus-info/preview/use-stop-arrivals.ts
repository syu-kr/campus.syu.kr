"use client";

import { useQuery } from "@tanstack/react-query";
import { nextStopEtas, type EtaResponse } from "@/lib/shuttle-eta";
import { shuttleRefreshDelay } from "@/lib/shuttle-polling";

export function useStopArrivals(now: Date, enabled: boolean, vehicleId?: string) {
  const query = useQuery({
    queryKey: ["shuttle-stop-arrivals", vehicleId ?? null],
    queryFn: async ({ signal }): Promise<EtaResponse> => {
      const response = await fetch(`/campus/bus-info/preview/eta${vehicleId === undefined ? "" : `?vehicleId=${encodeURIComponent(vehicleId)}`}`, { cache: "no-store", signal });
      if (!response.ok) throw new Error("Shuttle ETA unavailable");
      return response.json();
    },
    enabled, staleTime: 5_000, retry: false, refetchIntervalInBackground: false,
    refetchInterval: enabled ? shuttleRefreshDelay : false,
  });
  const minutes = nextStopEtas(enabled && !query.isError ? query.data?.arrivals ?? [] : [], now.getTime());
  const status = query.isError ? "error" : query.isPending ? "loading" : query.data?.status === "collecting" ? "collecting" : query.data?.status === "learning" ? "learning" : "waiting";
  return { minutes, status } as const;
}
