import { createHash, randomUUID } from "node:crypto";
import { ApiError } from "./http";
import { getFirestore, admin } from "./firestore";
import { readResponseBytes } from "./read-response-bytes";
import { resolvePublicTranslationSource } from "./content-translation-sources";
import type { ContentTranslationSource } from "../content-translation";

const VERSION = "google-v2-nmt-ko-en-numbers-2";
const NUMERIC_VERSION = "google-v2-nmt-ko-en-html-numbers-4";
const MAX_CHARACTERS = 6_000;
const CACHE_MS = 30 * 86_400_000;
const pending = new Map<string, Promise<TranslationResult>>();
const pendingFields = new Map<string, Promise<string>>();
const HANGUL = /\p{Script=Hangul}/u;
const kinds = new Set(["announcement", "competition", "cafeteria", "student-restaurant", "schedule", "tip", "service-notice", "phone", "shuttle", "library", "map", "course", "graduation", "banner"]);
const categories = new Set(["academic", "campus", "scholarship", "sw", "event", "department"]);

export interface TranslationRequest { source: ContentTranslationSource; fields: string[]; target: "en" }
export interface TranslationResult { translations: Record<string, string>; originals: Record<string, string>; sourceHash: string; target: "en"; provider: "google" }

function invalid(): never { throw new ApiError("Invalid translation request.", 400, undefined, "INVALID_TRANSLATION_REQUEST"); }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export function parseTranslationRequest(value: unknown): TranslationRequest {
  if (!record(value) || Object.keys(value).some(key => !["source", "fields", "target"].includes(key)) || value.target !== "en" || !record(value.source)) invalid();
  const source = value.source;
  if (Object.keys(source).some(key => !["kind", "id", "category"].includes(key)) || typeof source.kind !== "string" || !kinds.has(source.kind) || typeof source.id !== "string" || !source.id.trim() || source.id.length > 180 || /[\u0000-\u001f/\\]/.test(source.id)) invalid();
  if (["announcement", "competition"].includes(source.kind) ? typeof source.category !== "string" || !categories.has(source.category) : source.category !== undefined) invalid();
  if (!Array.isArray(value.fields) || value.fields.length < 1 || value.fields.length > 40 || value.fields.some(field => typeof field !== "string" || field.length < 1 || field.length > 180 || /[\u0000-\u001f]/.test(field))) invalid();
  const fields = [...new Set(value.fields as string[])].sort();
  return { source: { kind: source.kind, id: source.id, ...(source.category ? { category: source.category } : {}) } as ContentTranslationSource, fields, target: "en" };
}

export function isContentTranslationConfigured() {
  return Boolean(process.env.GOOGLE_TRANSLATION_API_KEY?.trim() && process.env.FIREBASE_SERVICE_ACCOUNT && process.env.RATE_LIMIT_SECRET);
}

export async function translatePublicContent(request: TranslationRequest): Promise<TranslationResult> {
  const key = process.env.GOOGLE_TRANSLATION_API_KEY?.trim();
  if (!key || !isContentTranslationConfigured()) throw new ApiError("Translation is not available yet.", 503, undefined, "TRANSLATION_UNAVAILABLE");
  const all = await resolvePublicTranslationSource(request.source);
  if (request.fields.some(field => !Object.hasOwn(all, field))) invalid();
  const originals = request.fields.map(field => all[field]);
  const characters = originals.reduce((total, text) => total + [...text].length, 0);
  if (characters > MAX_CHARACTERS) throw new ApiError("Translate a smaller section.", 413, undefined, "TRANSLATION_TOO_LARGE");
  const sourceHash = hash(JSON.stringify(Object.entries(all).sort(([a], [b]) => a.localeCompare(b, "en"))));
  const cacheKey = hash(JSON.stringify([VERSION, request.source, sourceHash, request.fields]));
  const existing = pending.get(cacheKey);
  if (existing) return existing;
  if (pending.size >= 100) throw new ApiError("Translation is busy. Try again shortly.", 429, undefined, "TRANSLATION_BUSY");
  const promise = translateWithCache(cacheKey, sourceHash, request.fields, originals, key).finally(() => pending.delete(cacheKey));
  pending.set(cacheKey, promise);
  return promise;
}

async function translateWithCache(cacheKey: string, sourceHash: string, fields: string[], originals: string[], key: string): Promise<TranslationResult> {
  const originalFields = Object.fromEntries(fields.map((field, index) => [field, originals[index]]));
  const texts = [...new Set(originals.filter(text => HANGUL.test(text)))];
  if (!texts.length) return { translations: originalFields, originals: originalFields, sourceHash, target: "en", provider: "google" };
  const db = getFirestore();
  // Reuse unexpired request caches from the previous implementation without rebilling them.
  const legacy = originals.some(text => /\d/.test(text)) ? null : await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(db.collection("public_content_translations").doc(cacheKey));
    const translations = readCachedTranslations(snapshot.get("translations"), fields);
    if (snapshot.get("expiresAt") > Date.now() && snapshot.get("sourceHash") === sourceHash && snapshot.get("version") === VERSION && translations) return { translations, expiresAt: snapshot.get("expiresAt") as number };
    if (snapshot.get("version") === VERSION && snapshot.get("pendingUntil") > Date.now()) throw new ApiError("Translation is in progress. Try again shortly.", 429, undefined, "TRANSLATION_BUSY");
    return null;
  });
  const seeds = new Map<string, { translation: string; expiresAt: number }>();
  if (legacy) fields.forEach((field, index) => { seeds.set(originals[index], { translation: legacy.translations[field], expiresAt: legacy.expiresAt }); });
  const missing = texts.filter(text => !pendingFields.has(fieldKey(text)));
  if (pendingFields.size + missing.length > 4_000) throw new ApiError("Translation is busy. Try again shortly.", 429, undefined, "TRANSLATION_BUSY");
  if (missing.length) {
    const batch = translateFieldsWithCache(missing, seeds, key);
    for (const text of missing) {
      const id = fieldKey(text);
      pendingFields.set(id, batch.then(values => values.get(text)!).finally(() => pendingFields.delete(id)));
    }
  }
  const translated = new Map(await Promise.all(texts.map(async text => [text, await pendingFields.get(fieldKey(text))!] as const)));
  const translations = Object.fromEntries(fields.map((field, index) => [field, translated.get(originals[index]) ?? originals[index]]));
  if (Buffer.byteLength(JSON.stringify(translations), "utf8") > 256 * 1024) throw new ApiError("Translate a smaller section.", 413, undefined, "TRANSLATION_TOO_LARGE");
  return { translations, originals: originalFields, sourceHash, target: "en", provider: "google" };
}

function fieldVersion(text: string) { return /\d/.test(text) ? NUMERIC_VERSION : VERSION; }
function fieldKey(text: string) { return hash(JSON.stringify([fieldVersion(text), "en", text])); }

async function translateFieldsWithCache(texts: string[], seeds: Map<string, { translation: string; expiresAt: number }>, key: string) {
  const db = getFirestore();
  const entries = texts.map(text => ({ text, version: fieldVersion(text), sourceHash: hash(text), ref: db.collection("public_content_translation_fields").doc(fieldKey(text)) }));
  const token = randomUUID(), now = Date.now();
  const claim = await db.runTransaction(async transaction => {
    const snapshots = await Promise.all(entries.map(entry => transaction.get(entry.ref)));
    const values = new Map<string, string>();
    const missing: typeof entries = [];
    entries.forEach((entry, index) => {
      const snapshot = snapshots[index], translation = snapshot.get("translation");
      if (snapshot.get("expiresAt") > now && snapshot.get("sourceHash") === entry.sourceHash && snapshot.get("version") === entry.version && validTranslation(translation)) values.set(entry.text, translation);
      else if (snapshot.get("pendingUntil") > now) throw new ApiError("Translation is in progress. Try again shortly.", 429, undefined, "TRANSLATION_BUSY");
      else missing.push(entry);
    });
    const claimed: typeof entries = [];
    for (const entry of missing) {
      const seed = seeds.get(entry.text);
      if (seed) {
        values.set(entry.text, seed.translation);
        transaction.set(entry.ref, { translation: seed.translation, sourceHash: entry.sourceHash, version: entry.version, expiresAt: seed.expiresAt, expires_at: admin.firestore.Timestamp.fromMillis(seed.expiresAt) });
      } else {
        claimed.push(entry);
        transaction.set(entry.ref, { sourceHash: entry.sourceHash, version: entry.version, pendingUntil: now + 120_000, token, expires_at: admin.firestore.Timestamp.fromMillis(now + CACHE_MS) });
      }
    }
    return { values, claimed };
  });
  if (!claim.claimed.length) return claim.values;
  try {
    const html = claim.claimed.some(entry => /\d/.test(entry.text));
    const prepared = claim.claimed.map(entry => prepareNumbers(entry.text, html));
    const signal = AbortSignal.timeout(12_000);
    const output = await requestTranslations(prepared, key, signal);
    const retry: number[] = [];
    const translations = output.map((value, index) => {
      try { return restoreNumbers(value, prepared[index]); }
      catch (error) {
        if (!html || !prepared[index].tokens.length) throw error;
        retry.push(index);
        return "";
      }
    });
    // Retry only rejected numeric fields once; both strategies enforce the same budget and validation.
    if (retry.length) {
      const fallback = retry.map(index => prepareNumbers(claim.claimed[index].text, false));
      const fallbackOutput = await requestTranslations(fallback, key, signal);
      retry.forEach((index, position) => { translations[index] = restoreNumbers(fallbackOutput[position], fallback[position]); });
    }
    if (translations.some(value => !validTranslation(value))) throw new Error("Invalid decoded translation response");
    await db.runTransaction(async transaction => {
      const snapshots = await Promise.all(claim.claimed.map(entry => transaction.get(entry.ref)));
      if (snapshots.some(snapshot => snapshot.get("token") !== token)) throw new Error("Translation cache lease expired");
      const expiresAt = Date.now() + CACHE_MS;
      claim.claimed.forEach((entry, index) => transaction.set(entry.ref, { translation: translations[index], sourceHash: entry.sourceHash, version: entry.version, expiresAt, expires_at: admin.firestore.Timestamp.fromMillis(expiresAt) }));
    });
    claim.claimed.forEach((entry, index) => claim.values.set(entry.text, translations[index]));
    return claim.values;
  } catch (error) {
    await db.runTransaction(async transaction => {
      const snapshots = await Promise.all(claim.claimed.map(entry => transaction.get(entry.ref)));
      claim.claimed.forEach((entry, index) => { if (snapshots[index].get("token") === token) transaction.delete(entry.ref); });
    }).catch(() => {});
    if (error instanceof ApiError) throw error;
    throw new ApiError("Translation could not be completed. The original is still available.", 503, undefined, "TRANSLATION_FAILED");
  }
}

async function requestTranslations(prepared: ReturnType<typeof prepareNumbers>[], key: string, signal: AbortSignal): Promise<string[]> {
  signal.throwIfAborted();
  const inputCharacters = prepared.reduce((total, item) => total + [...item.text].length, 0);
  if (inputCharacters > 12_000) throw new ApiError("Translate a smaller section.", 413, undefined, "TRANSLATION_TOO_LARGE");
  const now = Date.now();
  const db = getFirestore();
  const day = new Date().toISOString().slice(0, 10);
  const usage = db.collection("public_content_translation_usage").doc(day);
  const configuredLimit = Number(process.env.CONTENT_TRANSLATION_DAILY_CHARACTERS ?? "25000");
  if (!Number.isSafeInteger(configuredLimit) || configuredLimit < 0 || configuredLimit > 1_000_000) throw new ApiError("Translation is not available yet.", 503, undefined, "TRANSLATION_UNAVAILABLE");
  const dailyLimit = configuredLimit;
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(usage);
    const used = Number(snapshot.get("characters") ?? 0);
    if (!Number.isFinite(used) || used < 0 || used + inputCharacters > dailyLimit) throw new ApiError("Translation limit reached. Try again later.", 429, undefined, "TRANSLATION_DAILY_LIMIT");
    // Reserve before calling Google; failed requests stay reserved so retries cannot bypass the budget.
    transaction.set(usage, { characters: used + inputCharacters, expires_at: admin.firestore.Timestamp.fromMillis(now + 2 * 86_400_000) });
  });
  const response = await fetch("https://translation.googleapis.com/language/translate/v2", {
    method: "POST", cache: "no-store", redirect: "error", signal,
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
    body: JSON.stringify({ q: prepared.map(item => item.text), source: "ko", target: "en", format: prepared[0].html ? "html" : "text" }),
  });
  if (!response.ok) throw new Error("Translation provider rejected the request");
  const body = JSON.parse(new TextDecoder().decode(await readResponseBytes(response, 256 * 1024, "Translation")));
  const values = body?.data?.translations;
  if (!Array.isArray(values) || values.length !== prepared.length || values.some(value => !record(value) || !validTranslation(value.translatedText))) throw new Error("Invalid translation response");
  return values.map(value => value.translatedText);
}

function validTranslation(value: unknown): value is string { return typeof value === "string" && Boolean(value.trim()) && value.length <= 30_000; }

function readCachedTranslations(value: unknown, fields: string[]): Record<string, string> | null {
  if (!record(value) || fields.some(field => !validTranslation(value[field]))) return null;
  const selected = Object.fromEntries(fields.map(field => [field, value[field] as string]));
  return Buffer.byteLength(JSON.stringify(selected), "utf8") <= 256 * 1024 ? selected : null;
}

const NUMBER_PATTERN = /\d+(?:[.,:/~−–—-]\d+)*/g;

function prepareNumbers(original: string, html: boolean) {
  const prefix = `SYUN${randomUUID().replace(/-/g, "")}X`;
  const tokens: { placeholder: string; value: string }[] = [];
  // Keep Korean calendar dates unambiguous when NMT moves their numeric spans.
  const dated = original.replace(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g, "$1/$2/$3").replace(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/g, "$1/$2");
  const escaped = html ? dated.replace(/[&<>"']/g, value => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[value]!) : dated;
  const text = escaped.replace(NUMBER_PATTERN, value => {
    // Keep the numeric context visible to NMT while checking every protected span on return.
    const placeholder = html ? `<span translate="no" class="notranslate" id="${prefix}${tokens.length}">${value}</span>` : `__${prefix}${tokens.length}__`;
    tokens.push({ placeholder, value });
    return placeholder;
  });
  return { text, tokens, html };
}

function restoreNumbers(translated: string, prepared: ReturnType<typeof prepareNumbers>) {
  function removeProtected(text: string) {
    for (const { placeholder } of prepared.tokens) {
      const parts = text.split(placeholder);
      if (parts.length !== 2) throw new Error("Translation changed a protected number");
      text = parts.join("");
    }
    return text;
  }
  const unprotected = removeProtected(translated);
  if (prepared.html && /[<>]/.test(unprotected)) throw new Error("Translation introduced markup");
  // Decode before removing tokens or restoring numbers so entities cannot reinterpret numeric data.
  let result = decodeEntities(translated);
  if (/\d/.test(removeProtected(result))) throw new Error("Translation introduced numeric data");
  for (const { placeholder, value } of prepared.tokens) result = result.split(placeholder).join(value);
  return result;
}

function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity: string) => {
    const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const code = entity[1]?.toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : match;
  });
}
