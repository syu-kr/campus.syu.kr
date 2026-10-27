import type { ContentTranslationSource, PublicContentFields } from "./content-translation";

type TranslationStatus = "idle" | "loading" | "error" | "unavailable" | "limited" | "changed";
export interface TranslationSnapshot { status: TranslationStatus; fields: PublicContentFields | null }
interface Entry {
  source: ContentTranslationSource; original: PublicContentFields;
  snapshot: TranslationSnapshot; listeners: Set<(snapshot: TranslationSnapshot) => void>;
  queued: boolean; running: boolean; expires: number;
}
const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let activeBatch: Entry[] = [];
let activeController: AbortController | undefined;
const CACHE_MS = 30 * 60_000;
const emptyPage = { loading: false, translated: false, error: null as TranslationStatus | null };
let pageSnapshot = emptyPage;

function publish() {
  const active = [...entries.values()].filter(entry => entry.listeners.size);
  const next = {
    loading: active.some(entry => entry.snapshot.status === "loading"),
    translated: active.some(entry => Boolean(entry.snapshot.fields)),
    error: active.find(entry => !["idle", "loading"].includes(entry.snapshot.status))?.snapshot.status ?? null,
  };
  if (JSON.stringify(next) !== JSON.stringify(pageSnapshot)) {
    pageSnapshot = next;
    listeners.forEach(listener => listener());
  }
}
function update(entry: Entry, snapshot: TranslationSnapshot) {
  entry.snapshot = snapshot;
  entry.listeners.forEach(listener => listener(snapshot));
  publish();
}
function schedule() {
  if (!timer && !running) timer = setTimeout(() => { timer = undefined; void flush(); }, 30);
}
function trim() {
  for (const [key, entry] of entries) {
    if (!entry.listeners.size && !entry.running && (entry.expires < Date.now() || entries.size > 300)) entries.delete(key);
  }
}
function stopQueued(status: TranslationStatus) {
  for (const entry of entries.values()) {
    if (entry.queued) { entry.queued = false; update(entry, { status, fields: null }); }
  }
}
function cancelUnusedBatch() {
  if (!activeBatch.length || activeBatch.some(entry => entry.listeners.size)) return;
  for (const [key, entry] of entries) if (activeBatch.includes(entry)) entries.delete(key);
  activeController?.abort();
}
async function flush() {
  if (running) return;
  const batch = [...entries.values()].filter(entry => entry.queued && entry.listeners.size).slice(0, 12);
  if (!batch.length) return;
  running = true;
  batch.forEach(entry => { entry.queued = false; entry.running = true; });
  const controller = new AbortController();
  activeBatch = batch; activeController = controller;
  const timeout = setTimeout(() => controller.abort(), 65_000);
  try {
    const response = await fetch("/api/content-translation", {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
      body: JSON.stringify({ requests: batch.map(entry => ({ source: entry.source, fields: Object.keys(entry.original), target: "en" })) }),
    });
    const data: unknown = await response.json();
    if (!response.ok) {
      const status = response.status === 429 ? "limited" : response.status === 503 ? "unavailable" : "error";
      batch.forEach(entry => update(entry, { status, fields: null }));
      if (status === "limited" || status === "unavailable") stopQueued(status);
      return;
    }
    if (!data || typeof data !== "object" || !("results" in data) || !Array.isArray(data.results) || data.results.length !== batch.length) throw new Error("Invalid translation batch");
    data.results.forEach((item: unknown, index: number) => {
      const entry = batch[index];
      if (!item || typeof item !== "object" || !("ok" in item)) { update(entry, { status: "error", fields: null }); return; }
      if (!item.ok) {
        const status = "status" in item && item.status === 429 ? "limited" : "status" in item && item.status === 503 ? "unavailable" : "error";
        update(entry, { status, fields: null }); return;
      }
      const result = "result" in item ? item.result : null;
      if (!result || typeof result !== "object" || !("target" in result) || result.target !== "en" || !("provider" in result) || result.provider !== "google" || !("originals" in result) || !("translations" in result)) { update(entry, { status: "error", fields: null }); return; }
      const originals = result.originals as PublicContentFields | null, translations = result.translations as PublicContentFields | null;
      if (!originals || !translations || typeof originals !== "object" || typeof translations !== "object" || Array.isArray(originals) || Array.isArray(translations) || !Object.keys(entry.original).every(field => typeof translations[field] === "string" && translations[field].trim())) { update(entry, { status: "error", fields: null }); return; }
      if (!Object.entries(entry.original).every(([field, value]) => originals[field] === value)) { update(entry, { status: "changed", fields: null }); return; }
      entry.expires = Date.now() + CACHE_MS;
      update(entry, { status: "idle", fields: Object.fromEntries(Object.keys(entry.original).map(field => [field, translations[field]])) });
    });
    if (batch.some(entry => entry.snapshot.status === "limited")) stopQueued("limited");
  } catch {
    batch.forEach(entry => update(entry, { status: "error", fields: null }));
  } finally {
    clearTimeout(timeout);
    batch.forEach(entry => { entry.running = false; });
    running = false;
    activeBatch = []; activeController = undefined;
    trim(); schedule();
  }
}

/** Only registered public fields containing Korean enter the server queue. */
export function watchContentTranslation(source: ContentTranslationSource, original: PublicContentFields, listener: (snapshot: TranslationSnapshot) => void) {
  const fields = Object.fromEntries(Object.entries(original).filter(([, value]) => /\p{Script=Hangul}/u.test(value)).sort(([a], [b]) => a.localeCompare(b, "en")));
  if (!Object.keys(fields).length) { listener({ status: "idle", fields: null }); return () => {}; }
  const groups: PublicContentFields[] = [];
  let group: PublicContentFields = {}, length = 0;
  for (const [field, value] of Object.entries(fields)) {
    const count = Array.from(value).length;
    if (count > 6000) { listener({ status: "error", fields: null }); return () => {}; }
    if (Object.keys(group).length >= 40 || length + count > 6000) { groups.push(group); group = {}; length = 0; }
    group[field] = value; length += count;
  }
  if (Object.keys(group).length) groups.push(group);
  const results = groups.map(() => ({ status: "loading", fields: null }) as TranslationSnapshot);
  const dispose = groups.map((values, index) => {
    const key = JSON.stringify([source.kind, source.category ?? "", source.id, values]);
    let entry = entries.get(key);
    if (entry && !entry.listeners.size && entry.expires < Date.now() && !entry.running) { entries.delete(key); entry = undefined; }
    if (!entry) { entry = { source, original: values, snapshot: { status: "loading", fields: null }, listeners: new Set(), queued: true, running: false, expires: Date.now() + CACHE_MS }; entries.set(key, entry); }
    const callback = (snapshot: TranslationSnapshot) => {
      results[index] = snapshot;
      const failure = results.find(item => !["idle", "loading"].includes(item.status));
      if (failure) listener({ status: failure.status, fields: null });
      else if (results.some(item => item.status === "loading")) listener({ status: "loading", fields: null });
      else listener({ status: "idle", fields: Object.assign({}, ...results.map(item => item.fields ?? {})) });
    };
    entry.listeners.add(callback); callback(entry.snapshot);
    const current = entry;
    return () => { current.listeners.delete(callback); if (!current.listeners.size && !current.running && current.snapshot.status === "loading") entries.delete(key); };
  });
  trim(); publish(); schedule();
  return () => { dispose.forEach(stop => stop()); cancelUnusedBatch(); publish(); };
}

export function subscribePageTranslation(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function getPageTranslationSnapshot() { return pageSnapshot; }
export function getServerTranslationSnapshot() { return emptyPage; }
export function retryPageTranslation(source?: ContentTranslationSource) {
  for (const entry of entries.values()) {
    if (source && (entry.source.kind !== source.kind || entry.source.id !== source.id || entry.source.category !== source.category)) continue;
    if (entry.listeners.size && !["idle", "loading"].includes(entry.snapshot.status)) { entry.queued = true; update(entry, { status: "loading", fields: null }); }
  }
  schedule();
}
