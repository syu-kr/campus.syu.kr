import { createHash } from "node:crypto";
import type { ManagedContentRecord } from "../types/managed-content";

type Document = Record<string, unknown>;
export interface NoticeMigrationEntry {
  id: string;
  action: "create" | "enrich" | "unchanged" | "conflict";
  before: Document | null;
  beforeHash: string;
  after: Document | null;
  afterHash: string;
}
export interface NoticeMigrationBackup {
  schemaVersion: 1;
  createdAt: string;
  sourceManifestHash: string;
  entries: NoticeMigrationEntry[];
}

function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value !== "object" || !value || Object.getPrototypeOf(value) !== Object.prototype) throw new Error("Migration backup requires JSON-compatible documents");
  return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b, "en")).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
}
export function noticeDocumentHash(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}
function importedDocument(seed: ManagedContentRecord): Document {
  if (seed.draft.kind !== "notice" || !seed.noticeMetadata || seed.published?.kind !== "notice") throw new Error("Incomplete repository notice identity");
  return { ...seed, source: "database", revision: 1, publishedRevision: 1, publishedUpdatedAt: seed.updatedAt,
    draftEnglishSourceHash: seed.draft.english ? createHash("sha256").update(JSON.stringify([seed.draft.title, seed.draft.summary, seed.draft.content])).digest("hex") : null };
}

export function planNoticeMigration(seeds: ManagedContentRecord[], stored: Map<string, Document>): NoticeMigrationBackup {
  if (seeds.length === 0) throw new Error("No repository notices to migrate");
  const ids = new Set<string>();
  const entries = seeds.map(seed => {
    if (ids.has(seed.id)) throw new Error("Duplicate notice identity");
    ids.add(seed.id);
    const imported = importedDocument(seed), before = stored.get(seed.id) ?? null;
    let action: NoticeMigrationEntry["action"] = before ? "enrich" : "create";
    let after = before ? { ...before, noticeMetadata: seed.noticeMetadata } : imported;
    if (before) {
      const draft = before.draft as { kind?: string; slug?: string } | undefined;
      if (draft?.kind !== "notice" || draft.slug !== seed.id || !Number.isSafeInteger(before.revision) || Number(before.revision) < 1) action = "conflict";
      else if (before.noticeMetadata !== undefined) action = noticeDocumentHash(before.noticeMetadata) === noticeDocumentHash(seed.noticeMetadata) ? "unchanged" : "conflict";
      if (action === "unchanged" || action === "conflict") after = before;
    }
    return { id: seed.id, action, before, beforeHash: noticeDocumentHash(before), after, afterHash: noticeDocumentHash(after) };
  });
  return { schemaVersion: 1, createdAt: new Date().toISOString(), sourceManifestHash: noticeDocumentHash(seeds.map(seed => ({ id: seed.id, metadata: seed.noticeMetadata, draft: seed.draft })).sort((a, b) => a.id.localeCompare(b.id, "en"))), entries };
}

export function checkNoticeMigrationBackup(value: unknown): NoticeMigrationBackup {
  const backup = value as NoticeMigrationBackup;
  if (!backup || backup.schemaVersion !== 1 || !Number.isFinite(Date.parse(backup.createdAt)) || !/^[a-f0-9]{64}$/.test(backup.sourceManifestHash) || !Array.isArray(backup.entries) || backup.entries.length > 500) throw new Error("Invalid notice migration backup");
  const ids = new Set<string>();
  for (const entry of backup.entries) {
    if (!entry || typeof entry.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9-]{0,119}$/.test(entry.id) || ids.has(entry.id) || !["create", "enrich", "unchanged", "conflict"].includes(entry.action) || noticeDocumentHash(entry.before) !== entry.beforeHash || noticeDocumentHash(entry.after) !== entry.afterHash) throw new Error("Invalid notice migration entry");
    ids.add(entry.id);
    if (entry.action === "create" && (entry.before !== null || !entry.after)) throw new Error("Invalid create entry");
    if (["unchanged", "conflict"].includes(entry.action) && entry.beforeHash !== entry.afterHash) throw new Error("Non-writing migration entry changes content");
    if (entry.action === "enrich") {
      if (!entry.before || !entry.after || entry.before.noticeMetadata !== undefined) throw new Error("Invalid enrichment entry");
      const withoutMetadata = { ...entry.after }; delete withoutMetadata.noticeMetadata;
      if (noticeDocumentHash(withoutMetadata) !== entry.beforeHash) throw new Error("Enrichment changes existing content");
    }
  }
  return backup;
}

export function summarizeNoticeMigration(plan: NoticeMigrationBackup) {
  return { sourceRecords: plan.entries.length, sourceManifestHash: plan.sourceManifestHash,
    create: plan.entries.filter(entry => entry.action === "create").length,
    enrich: plan.entries.filter(entry => entry.action === "enrich").length,
    unchanged: plan.entries.filter(entry => entry.action === "unchanged").length,
    conflicts: plan.entries.filter(entry => entry.action === "conflict").length };
}

export function assertNoticeMigrationState(entry: NoticeMigrationEntry, current: Document | null, rollback = false): "skip" | "write" {
  const hash = noticeDocumentHash(current), expected = rollback ? entry.afterHash : entry.beforeHash, target = rollback ? entry.beforeHash : entry.afterHash;
  if (hash === target) return "skip";
  if (entry.action === "conflict" || hash !== expected) throw new Error(`Concurrent content change: ${entry.id}`);
  return "write";
}
