import type { LearningState, TimingProfiles } from "../shuttle-learning";
import { getFirestore } from "./firestore";
import { recordShuttleMetric } from "./shuttle-metrics";

type State = LearningState & { revision?: number };
type Cache<T> = { until: number; promise: Promise<T> };
let current: Cache<State | undefined> | undefined;
let history: (Cache<TimingProfiles> & { version: string }) | undefined;
let model: Cache<TimingProfiles> | undefined;
let published: { state: State; at: number; generation: number } | undefined;
let generation = 0;

export function publishShuttleState(state: State) {
  if (published && published.state.receivedAt > state.receivedAt) return;
  if (published?.state.receivedAt === state.receivedAt && (published.state.revision ?? 0) > (state.revision ?? 0)) return;
  published = { state, at: Date.now(), generation: ++generation };
  current = { until: Date.now() + 5_000, promise: Promise.resolve(state) };
}

export function readShuttleState() {
  if (current && current.until > Date.now()) {
    recordShuttleMetric("eta.current", { cacheHits: 1 });
    return current.promise;
  }
  recordShuttleMetric("eta.current", { cacheMisses: 1, reads: 1 });
  const startedGeneration = generation;
  const entry: Cache<State | undefined> = { until: Infinity, promise: getFirestore().collection("shuttle_eta").doc("current").get().then(doc => {
    const value = doc.data();
    if (published && Date.now() - published.at < 5_000 && (published.generation > startedGeneration || !value?.receivedAt || published.state.receivedAt > value.receivedAt)) return published.state;
    return value?.schemaVersion === 3 && Array.isArray(value.runs) ? value as LearningState : undefined;
  }).finally(() => { entry.until = Date.now() + 5_000; }) };
  current = entry;
  void entry.promise.catch(() => { if (current === entry) current = undefined; });
  return entry.promise;
}

export function readShuttleHistory(version: string) {
  if (history?.version === version && history.until > Date.now()) {
    recordShuttleMetric("eta.history", { cacheHits: 1 });
    return history.promise;
  }
  recordShuttleMetric("eta.history", { cacheMisses: 1, reads: 1 });
  const entry: Cache<TimingProfiles> & { version: string } = { version, until: Infinity, promise: getFirestore().collection("shuttle_eta").doc("history").get().then(doc => (doc.data()?.profiles ?? {}) as TimingProfiles).finally(() => { entry.until = Date.now() + 3_600_000; }) };
  history = entry;
  void entry.promise.catch(() => { if (history === entry) history = undefined; });
  return entry.promise;
}

export function readShuttleModel() {
  if (model && model.until > Date.now()) return model.promise;
  recordShuttleMetric("eta.model", { cacheMisses: 1, reads: 1 });
  const entry: Cache<TimingProfiles> = { until: Infinity, promise: getFirestore().collection("shuttle_eta").doc("model").get().then(doc => (doc.data()?.profiles ?? {}) as TimingProfiles).finally(() => { entry.until = Date.now() + 60_000; }) };
  model = entry;
  void entry.promise.catch(() => { if (model === entry) model = undefined; });
  return entry.promise;
}
