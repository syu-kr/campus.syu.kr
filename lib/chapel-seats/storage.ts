import { LAYOUT_VERSION, SECTION_IDS, type ChapelSeat, type SectionId } from "./data";
import { lookupSeat } from "./lookup";

export const SAVED_SEAT_KEY = "syu-campus:chapel-seat:v1";
interface SavedSeat {
  schemaVersion: 1;
  seatId: string;
  section: SectionId;
  number: number;
  layoutVersion: string;
  savedAt: string;
  confirmedAt: string;
}
export type SavedSeatState = { status: "empty" | "invalid" | "unavailable" } | {
  status: "saved"; value: SavedSeat; seat: ChapelSeat | null; needsConfirmation: boolean;
};

function parseSavedSeat(raw: string): SavedSeat | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    if (v.schemaVersion !== 1 || !SECTION_IDS.includes(v.section as SectionId)
      || typeof v.number !== "number" || !Number.isSafeInteger(v.number) || v.number < 1
      || v.seatId !== `grand-auditorium:1:${v.section}:${v.number}`
      || typeof v.layoutVersion !== "string" || !v.layoutVersion
      || typeof v.savedAt !== "string" || !Number.isFinite(Date.parse(v.savedAt))
      || typeof v.confirmedAt !== "string" || !Number.isFinite(Date.parse(v.confirmedAt))) return null;
    return { schemaVersion: 1, seatId: v.seatId as string, section: v.section as SectionId,
      number: v.number, layoutVersion: v.layoutVersion, savedAt: v.savedAt, confirmedAt: v.confirmedAt };
  } catch { return null; }
}

export function readSavedSeat(storage: Pick<Storage, "getItem">): SavedSeatState {
  try {
    const raw = storage.getItem(SAVED_SEAT_KEY);
    if (raw === null) return { status: "empty" };
    const value = parseSavedSeat(raw);
    if (!value) return { status: "invalid" };
    const result = lookupSeat(value.section, String(value.number));
    const seat = result.status === "found" ? result.seat : null;
    return { status: "saved", value, seat,
      needsConfirmation: value.layoutVersion !== LAYOUT_VERSION || seat === null };
  } catch { return { status: "unavailable" }; }
}

export function saveSeat(storage: Pick<Storage, "setItem">, seat: ChapelSeat, now = new Date()): boolean {
  try {
    const current = lookupSeat(seat.section, String(seat.number));
    if (current.status !== "found" || current.seat.id !== seat.id) return false;
    const timestamp = now.toISOString();
    const value: SavedSeat = { schemaVersion: 1, seatId: seat.id, section: seat.section,
      number: seat.number, layoutVersion: LAYOUT_VERSION, savedAt: timestamp, confirmedAt: timestamp };
    storage.setItem(SAVED_SEAT_KEY, JSON.stringify(value));
    return true;
  } catch { return false; }
}

export function deleteSavedSeat(storage: Pick<Storage, "removeItem">): boolean {
  try { storage.removeItem(SAVED_SEAT_KEY); return true; }
  catch { return false; }
}
