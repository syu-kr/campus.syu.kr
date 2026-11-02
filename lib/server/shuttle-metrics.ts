type Usage = {
  reads?: number;
  writes?: number;
  attempts?: number;
  cacheHits?: number;
  cacheMisses?: number;
  documents?: number;
};

const totals = new Map<string, Usage>();
let flushAt = 0;

// Aggregate process-local counters in logs, without database writes or request identifiers.
export function recordShuttleMetric(name: string, usage: Usage) {
  if (process.env.FIRESTORE_USAGE_LOGS !== "1") return;
  if (!/^[a-z.-]{1,64}$/.test(name)) return;
  const previous = totals.get(name) ?? {};
  for (const key of ["reads", "writes", "attempts", "cacheHits", "cacheMisses", "documents"] as const) {
    const value = usage[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      previous[key] = (previous[key] ?? 0) + value;
    }
  }
  totals.set(name, previous);
  if (!flushAt) flushAt = Date.now() + 60_000;
  if (Date.now() >= flushAt) flushShuttleMetrics();
}

export function flushShuttleMetrics() {
  if (totals.size) console.info("[firestore-usage]", JSON.stringify(Object.fromEntries(totals)));
  totals.clear();
  flushAt = 0;
}
