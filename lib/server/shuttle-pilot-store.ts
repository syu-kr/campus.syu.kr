import { createHash } from "node:crypto";
import { advancePilotObservation, type PilotEvent, type PilotFieldEvent, type PilotObservation } from "../shuttle-observations";
import { getFirestore, admin } from "./firestore";
import { etaServiceDate } from "../shuttle-eta";

export async function savePilotSample(rows: PilotObservation[], receipt: number, writeBlock: () => "closed" | "delayed" | undefined,
  field?: PilotFieldEvent & { vehicleKey: string }) {
  const db = getFirestore(), expires_at = admin.firestore.Timestamp.fromMillis(receipt + 30 * 86400_000);
  const receipts = db.collection("shuttle_pilot_receipts"), sample = receipts.doc(String(receipt));
  const cursors = rows.map(row => db.collection("shuttle_pilot_state").doc(row.vehicleKey));
  return db.runTransaction(async transaction => {
    const [existing, ...previous] = await transaction.getAll(sample, ...cursors);
    const blocked = writeBlock();
    if (blocked) return blocked;
    if (existing.exists && !field) return "duplicate";
    const derived = rows.map((row, index) => advancePilotObservation(previous[index].data(), row));
    let fieldRecord;
    let fieldEvent: PilotEvent | undefined;
    if (field) {
      const index = rows.findIndex(row => row.vehicleKey === field.vehicleKey), state = derived[index].state;
      if (state.routeId !== rows[index].routeId || state.status !== rows[index].status || state.pattern !== rows[index].pattern ||
        field.observedAt < state.firstObservedAt - 5_000) return "delayed";
      const key = createHash("sha256").update(`${state.runId}:${field.visitId}:${field.event}`).digest("hex");
      fieldRecord = receipts.doc(`field-${key}`);
      if ((await transaction.get(fieldRecord)).exists) return "duplicate";
      fieldEvent = {
        vehicleKey: state.vehicleKey, runId: state.runId, routeId: state.routeId, status: state.status, pattern: state.pattern,
        visitId: field.visitId, event: field.event, observedAt: field.observedAt,
        windowStart: null, windowEnd: field.observedAt, method: "field-observer", validation: "reported",
        measuredAt: field.observedAt, measurementSource: "field-observer",
      };
    }
    // A transaction retry must not write a fresh-looking sample after service closes or the receipt expires.
    const finalBlock = writeBlock();
    if (finalBlock) return finalBlock;
    const common = { schemaVersion: 2, serviceDate: etaServiceDate(receipt), receivedAt: receipt, recordedAt: Date.now(), measuredAt: receipt, measurementSource: "receiver", expires_at };
    if (!existing.exists) {
      transaction.create(sample, { ...common, observedAt: receipt,
        rows: rows.map((row, index) => ({ ...row, sourceMeasuredAt: row.measurementSource === "source" ? row.measuredAt : null,
          runId: derived[index].advanced ? derived[index].state.runId : null,
          runOriginObserved: derived[index].advanced && derived[index].state.originObserved,
          advanced: derived[index].advanced, stopCatalog: "registered-places-20261030" })),
        events: derived.flatMap(result => result.events),
      });
      derived.forEach((result, index) => {
        if (result.advanced) transaction.set(cursors[index], { ...result.state, expires_at });
      });
    }
    if (fieldRecord && fieldEvent) transaction.create(fieldRecord, {
      ...common, observedAt: fieldEvent.observedAt, rows: [], events: [fieldEvent],
      measurementSource: "field-observer", measuredAt: fieldEvent.observedAt, recordedAt: Date.now(),
    });
    return "saved";
  });
}
