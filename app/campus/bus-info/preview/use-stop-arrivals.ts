"use client";

import { useQuery } from "@tanstack/react-query";
import { nextStopEtas, type EtaResponse } from "@/lib/shuttle-eta";

export function useStopArrivals(now: Date, enabled: boolean) {
  const query = useQuery({
    queryKey: ["shuttle-stop-arrivals"],
    queryFn: async ({ signal }): Promise<EtaResponse> => {
      const response = await fetch("/campus/bus-info/preview/eta", { cache: "no-store", signal });
      if (!response.ok) throw new Error("Shuttle ETA unavailable");
      return response.json();
    },
    enabled, staleTime: 5_000, retry: false, refetchIntervalInBackground: false,
    refetchInterval: enabled ? q => q.state.data?.status === "collecting" ? 300_000 : 15_000 : false,
  });
  const minutes = nextStopEtas(enabled && !query.isError ? query.data?.arrivals ?? [] : [], now.getTime());
  const status = query.isError ? "error" : query.isPending ? "loading" : query.data?.status === "collecting" ? "collecting" : "waiting";
  return { minutes, status } as const;
}
