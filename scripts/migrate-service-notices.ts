import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Firestore } from "firebase-admin/firestore";
import { readRepositoryManagedContent } from "../lib/service-notice-repository";
import { assertNoticeMigrationState, checkNoticeMigrationBackup, noticeDocumentHash, planNoticeMigration, summarizeNoticeMigration } from "../lib/service-notice-migration";
import type { NoticeMigrationBackup } from "../lib/service-notice-migration";
import { initializeScriptFirestore } from "./firebase-admin";

const collection = "site_managed_content";
async function readStored(db: Firestore, ids: string[]) {
  const docs = await db.getAll(...ids.map(id => db.collection(collection).doc(id)));
  return new Map(docs.filter(doc => doc.exists).map(doc => [doc.id, doc.data()!]));
}
async function applyPlan(db: Firestore, plan: NoticeMigrationBackup, rollback: boolean) {
  if (plan.entries.some(entry => entry.action === "conflict")) throw new Error("Resolve migration conflicts before applying");
  let writes = 0, skipped = 0;
  for (const entry of plan.entries) {
    const changed = await db.runTransaction(async tx => {
      const ref = db.collection(collection).doc(entry.id), snapshot = await tx.get(ref);
      const current = snapshot.exists ? snapshot.data()! : null;
      if (assertNoticeMigrationState(entry, current, rollback) === "skip") return false;
      const target = rollback ? entry.before : entry.after;
      if (!rollback && current === null) {
        const all = await tx.get(db.collection(collection).limit(500));
        if (all.size >= 500) throw new Error("Managed content capacity reached");
      }
      if (target === null) tx.delete(ref); else tx.set(ref, target);
      return true;
    });
    if (changed) writes++; else skipped++;
  }
  return { writes, skipped };
}

async function main() {
  const args = process.argv.slice(2), allowed = new Set(["--apply", "--dry-run", "--verify", "--repository-only", "--backup", "--rollback"]);
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!allowed.has(arg) || flags.has(arg) || values.has(arg)) throw new Error("Unknown or duplicate migration option");
    if (arg === "--backup" || arg === "--rollback") { if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error("Migration file path is required"); values.set(arg, args[++i]); }
    else flags.add(arg);
  }
  const apply = flags.has("--apply"), verify = flags.has("--verify"), repositoryOnly = flags.has("--repository-only"), rollback = values.get("--rollback");
  if ((apply && flags.has("--dry-run")) || (verify && (apply || rollback || repositoryOnly)) || (repositoryOnly && (apply || rollback)) || (rollback && values.has("--backup"))) throw new Error("Conflicting migration options");
  if (apply && !rollback && !values.has("--backup")) throw new Error("--apply requires a new --backup file");
  if (rollback) {
    const backupPath = path.resolve(rollback);
    const plan = checkNoticeMigrationBackup(JSON.parse(await readFile(backupPath, "utf8")));
    const db = await initializeScriptFirestore();
    const stored = await readStored(db, plan.entries.map(entry => entry.id));
    const states = plan.entries.map(entry => assertNoticeMigrationState(entry, stored.get(entry.id) ?? null, true));
    const result = apply ? await applyPlan(db, plan, true) : { plannedWrites: states.filter(state => state === "write").length };
    console.log(JSON.stringify({ mode: apply ? "rollback" : "rollback-dry-run", ...result }));
    return;
  }
  const seeds = await readRepositoryManagedContent(true);
  const db = repositoryOnly ? null : await initializeScriptFirestore();
  const stored = db ? await readStored(db, seeds.map(seed => seed.id)) : new Map();
  const plan = checkNoticeMigrationBackup(planNoticeMigration(seeds, stored));
  const summary = summarizeNoticeMigration(plan);
  const backupFile = values.get("--backup");
  if (backupFile) {
    const resolved = path.resolve(backupFile);
    if (!["output", ".cache"].some(dir => resolved.startsWith(path.resolve(dir) + path.sep))) throw new Error("Backups must stay inside ignored output or .cache");
    await writeFile(resolved, JSON.stringify(plan, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  }
  if (verify) {
    const originalPublications = seeds.filter(seed => {
      const row = stored.get(seed.id);
      return row && row.archived === false && noticeDocumentHash(row.published) === noticeDocumentHash(seed.published);
    }).length;
    console.log(JSON.stringify({ mode: "verify", ...summary, originalPublications, preservedEditsOrSuppressions: summary.unchanged - originalPublications }));
    if (summary.create || summary.enrich || summary.conflicts) process.exitCode = 1;
    return;
  }
  const result = apply ? await applyPlan(db!, plan, false) : { writes: 0 };
  console.log(JSON.stringify({ mode: repositoryOnly ? "repository-only" : apply ? "apply" : "dry-run", reviewedEnglishVariants: seeds.filter(seed => seed.noticeMetadata?.reviewedEnglishSourceSha256).length, ...summary, ...result }));
  if (summary.conflicts) process.exitCode = 1;
}

if (require.main === module) main().catch(() => { console.error("Service notice migration failed. Check configuration, backup and concurrent edits; no credentials are printed."); process.exitCode = 1; });
