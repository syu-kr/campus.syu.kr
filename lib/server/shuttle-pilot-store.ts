import { createHash } from "node:crypto";
import { advancePilotObservation, type PilotEvent, type PilotFieldEvent, type PilotObservation } from "../shuttle-observations";
import { getFirestore, admin } from "./firestore";
import { etaServiceDate } from "../shuttle-eta";
import { advanceShuttleLearning, type LearningState } from "../shuttle-learning";
import { publishShuttleState } from "./shuttle-eta-cache";
import { recordShuttleMetric } from "./shuttle-metrics";

type Cursor = ReturnType<typeof advancePilotObservation>["state"];
type StoredState = LearningState & { cursors?: Cursor[]; lastFrameEmpty?: boolean; revision?: number };
type Field = PilotFieldEvent & { vehicleKey: string };
type WriteBlock = () => "closed" | "delayed" | undefined;
const SAVE_INTERVAL_MS = 60_000;
let pending: Promise<string> | undefined;
let nextReceiptAt = -Infinity;

export async function savePilotSample(rows: PilotObservation[], receipt: number, writeBlock: WriteBlock, field?: Field): Promise<string> {
  const blocked = writeBlock();
  if (blocked) return blocked;
  if (!field) {
    if (receipt < nextReceiptAt) {
      recordShuttleMetric("collection.frame", { cacheHits: 1 });
      return "duplicate";
    }
    if (pending) return pending.then(result => writeBlock() ?? (result === "saved" || result === "duplicate" ?
      receipt < nextReceiptAt ? "duplicate" : savePilotSample(rows, receipt, writeBlock) : result));
    const operation = saveFrame(rows, receipt, writeBlock);
    pending = operation;
    try { return await operation; } finally { if (pending === operation) pending = undefined; }
  }
  return saveFrame(rows, receipt, writeBlock, field);
}

async function saveFrame(rows: PilotObservation[], receipt: number, writeBlock: WriteBlock, field?: Field) {
  const db = getFirestore(), expires_at = admin.firestore.Timestamp.fromMillis(receipt + 30 * 86400_000);
  const receipts = db.collection("shuttle_pilot_receipts"), sample = receipts.doc(String(receipt));
  const latest = db.collection("shuttle_eta").doc("current");
  const model = db.collection("shuttle_eta").doc("model");
  let committed: StoredState | undefined, readback: StoredState | undefined, gate = -Infinity, writes = 0;
  const result = await db.runTransaction(async transaction => {
    committed = undefined; readback = undefined; gate = -Infinity; writes = 0;
    recordShuttleMetric("collection.transaction", { attempts: 1, reads: 1 });
    const current = await transaction.get(latest);
    const stored = current.data() as (StoredState & { schemaVersion?: number }) | undefined;
    if (stored?.receivedAt && Number.isSafeInteger(stored.receivedAt)) gate = stored.receivedAt + SAVE_INTERVAL_MS;
    if (stored?.schemaVersion === 3 && Array.isArray(stored.runs)) readback = stored;
    const blocked = writeBlock();
    if (blocked) return blocked;
    // Elapsed time, rather than minute buckets, prevents two writes around a clock boundary.
    if (!field && receipt < gate) return "duplicate";
    if (!field && rows.length === 0 && stored?.lastFrameEmpty) { gate = receipt + SAVE_INTERVAL_MS; return "duplicate"; }
    recordShuttleMetric("collection.transaction", { reads: 1 });
    const existing = await transaction.get(sample);
    if (existing.exists && !field) { gate = Math.max(gate, receipt + SAVE_INTERVAL_MS); return "duplicate"; }
    let currentData = stored?.schemaVersion === 3 ? stored : undefined;
    if (!currentData) {
      recordShuttleMetric("collection.transaction", { reads: 1 });
      currentData = { receivedAt: receipt, runs: [], pending: [], learned: [], profiles: (await transaction.get(model)).data()?.profiles ?? {} };
    }
    let oldCursors = currentData.cursors;
    if (!Array.isArray(oldCursors)) {
      const refs = rows.map(row => db.collection("shuttle_pilot_state").doc(row.vehicleKey));
      recordShuttleMetric("collection.transaction", { reads: refs.length });
      const previous = refs.length ? await transaction.getAll(...refs) : [];
      oldCursors = previous.map(doc => doc.data() as Cursor).filter(Boolean);
    }
    const derived = rows.map(row => advancePilotObservation(oldCursors.find(cursor => cursor.vehicleKey === row.vehicleKey), row));
    let fieldRecord;
    let fieldEvent: PilotEvent | undefined;
    if (field) {
      const index = rows.findIndex(row => row.vehicleKey === field.vehicleKey);
      if (index < 0) return "delayed";
      const state = derived[index].state;
      if (state.routeId !== rows[index].routeId || state.status !== rows[index].status || state.pattern !== rows[index].pattern ||
        field.observedAt < state.firstObservedAt - 5_000) return "delayed";
      const key = createHash("sha256").update(`${state.runId}:${field.visitId}:${field.event}`).digest("hex");
      fieldRecord = receipts.doc(`field-${key}`);
      recordShuttleMetric("collection.transaction", { reads: 1 });
      if ((await transaction.get(fieldRecord)).exists) return "duplicate";
      fieldEvent = {
        vehicleKey: state.vehicleKey, runId: state.runId, routeId: state.routeId, status: state.status, pattern: state.pattern,
        visitId: field.visitId, event: field.event, observedAt: field.observedAt,
        windowStart: null, windowEnd: field.observedAt, method: "field-observer", validation: "reported",
        measuredAt: field.observedAt, measurementSource: "field-observer",
      };
    }
    const finalBlock = writeBlock();
    if (finalBlock) return finalBlock;
    const common = { schemaVersion: 2, serviceDate: etaServiceDate(receipt), receivedAt: receipt, recordedAt: Date.now(), measuredAt: receipt, measurementSource: "receiver", expires_at };
    if (!existing.exists) {
      transaction.create(sample, { ...common, observedAt: receipt,
        rows: rows.map((row, index) => ({ ...row, sourceMeasuredAt: row.measurementSource === "source" ? row.measuredAt : null,
          runId: derived[index].advanced ? derived[index].state.runId : null,
          runOriginObserved: derived[index].advanced && derived[index].state.originObserved,
          advanced: derived[index].advanced, stopCatalog: "registered-places-20261030" })),
        events: derived.flatMap(value => value.events),
      });
      writes++;
    }
    if (fieldRecord && fieldEvent) {
      transaction.create(fieldRecord, { ...common, observedAt: fieldEvent.observedAt, rows: [], events: [fieldEvent],
        measurementSource: "field-observer", measuredAt: fieldEvent.observedAt, recordedAt: Date.now() });
      writes++;
    }
    const learningReceipt = Math.max(receipt, currentData.receivedAt);
    const points = receipt < currentData.receivedAt ? currentData.runs.map(run => ({ ...run, advanced: false })) :
      rows.map((row, index) => ({ ...row, runId: derived[index].state.runId, advanced: derived[index].advanced }));
    const learning = advanceShuttleLearning(currentData, points,
      [...(!existing.exists ? derived.flatMap(value => value.events) : []), ...(fieldEvent ? [fieldEvent] : [])], learningReceipt);
    if (!stored?.receivedAt || receipt >= stored.receivedAt || fieldEvent) {
      const cursors = new Map(oldCursors.map(cursor => [cursor.vehicleKey, cursor]));
      derived.forEach(value => { if (value.advanced) cursors.set(value.state.vehicleKey, value.state); });
      committed = { ...learning,
        revision: (stored?.revision ?? 0) + 1,
        cursors: [...cursors.values()].filter(cursor => learningReceipt - cursor.observedAt <= 120_000).sort((a, b) => b.observedAt - a.observedAt).slice(0, 100),
        lastFrameEmpty: receipt >= currentData.receivedAt ? rows.length === 0 : stored?.lastFrameEmpty ?? false,
      };
      gate = committed.receivedAt + SAVE_INTERVAL_MS;
      transaction.set(latest, { ...committed, schemaVersion: 3, expires_at: admin.firestore.Timestamp.fromMillis(learningReceipt + 30 * 86400_000) });
      writes++;
      if (JSON.stringify(currentData.profiles) !== JSON.stringify(learning.profiles)) {
        transaction.set(model, { profiles: learning.profiles, updatedAt: learningReceipt, schemaVersion: 1 });
        writes++;
      }
    }
    return "saved";
  });
  if (committed) publishShuttleState(committed);
  else if (readback) publishShuttleState(readback);
  if (result === "saved" || result === "duplicate") nextReceiptAt = Math.max(nextReceiptAt, gate);
  recordShuttleMetric("collection.transaction", { writes });
  return result;
}
