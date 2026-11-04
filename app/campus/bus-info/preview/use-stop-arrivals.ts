"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { etaServiceDate, nextStopEtas, type EtaResponse } from "@/lib/shuttle-eta";
import { shuttleRefreshDelay } from "@/lib/shuttle-polling";
import { parseEtaResponse } from "./eta-response";

export type ShuttleEtaEndpoint = "/api/bus/shuttle/eta" | "/campus/bus-info/preview/eta";
export function useStopArrivals(now: Date, enabled: boolean, vehicleId?: string, polling = true, endpoint: ShuttleEtaEndpoint = "/campus/bus-info/preview/eta", expectedVersion?: string) {
  const query = useQuery({
    queryKey: ["shuttle-stop-arrivals", vehicleId ?? null, etaServiceDate(now.getTime()),endpoint,expectedVersion],
    queryFn: async ({ signal }): Promise<EtaResponse> => {
      const response = await fetch(`${endpoint}${vehicleId === undefined ? "" : `?vehicleId=${encodeURIComponent(vehicleId)}`}`, { cache: "no-store", signal });
      if (!response.ok) throw new Error("Shuttle ETA unavailable");
      return parseEtaResponse(await response.json());
    },
    enabled, staleTime: polling ? 5_000 : 60_000, retry: false, refetchIntervalInBackground: false,
    refetchInterval: enabled && polling ? shuttleRefreshDelay : false,
  });
  const wasPolling = useRef(polling);
  const refetch = query.refetch;
  useEffect(() => {
    const closed = wasPolling.current && !polling;
    wasPolling.current = polling;
    // Take one closed-window snapshot so terminal forecasts survive after live polling stops.
    if (enabled && closed) void refetch();
  }, [enabled, polling, refetch]);
  const context = query.data?.context;
  const versionMismatch = !!context && expectedVersion !== undefined && context.version !== expectedVersion;
  const compatible = enabled && !versionMismatch && (!context || context.serviceDate === etaServiceDate(now.getTime()) && context.generatedAt <= now.getTime() + 5000);
  const rows = compatible ? (query.data?.arrivals ?? []).filter(row =>
    etaServiceDate(row.measuredAt) === etaServiceDate(now.getTime()) && etaServiceDate(row.arrivalAt) === etaServiceDate(now.getTime())) : [];
  const minutes = nextStopEtas(rows, now.getTime());
  const observations = new Map(rows.filter(row => nextStopEtas([row], now.getTime()).has(row.visitId))
    .sort((a, b) => b.arrivalAt - a.arrivalAt).map(row => [row.visitId, row]));
  const status = query.isError ? "error" : query.isPending ? "loading" : query.data?.status === "collecting" ? "collecting" : query.data?.status === "learning" ? "learning" : "waiting";
  // Legacy responses have no outage expiry; only preserve their independently expiring observed ETAs.
  const scheduledValid = compatible && (context ? now.getTime() < context.validUntil : !query.isError);
  const scheduled = new Map((scheduledValid ? query.data?.scheduledArrivals ?? [] : [])
    .filter(item => Number.isFinite(item.arrivalAt) && etaServiceDate(item.departureAt) === etaServiceDate(now.getTime()) && etaServiceDate(item.arrivalAt) === etaServiceDate(now.getTime()))
    .map(item => [item.visitId, item]));
  const trips = scheduledValid ? query.data?.trips ?? [] : [];
  return { minutes, observations, scheduled, trips, status, context, versionMismatch } as const;
}
