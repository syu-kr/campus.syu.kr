import { ROWS, SEATS, SECTION_IDS, type ChapelSeat, type SectionId } from "./data";

export type SeatLookup = { status: "found"; seat: ChapelSeat }
  | { status: "invalid-section" | "invalid-number" | "out-of-range" | "unconfirmed" };

const byKey = new Map(SEATS.map((seat) => [`${seat.section}:${seat.number}`, seat]));
const byId = new Map(SEATS.map((seat) => [seat.id, seat]));
const byRow = new Map(ROWS.map((row) => [row.id, row.seatIds.map((id) => byId.get(id)!)]));

function isSectionId(value: string): value is SectionId {
  return SECTION_IDS.some((section) => section === value);
}

export function lookupSeat(section: string, input: string): SeatLookup {
  if (!isSectionId(section)) return { status: "invalid-section" };
  const normalized = input.trim();
  if (!/^\d+$/.test(normalized)) return { status: "invalid-number" };
  const number = Number(normalized);
  if (!Number.isSafeInteger(number) || number <= 0) return { status: "invalid-number" };
  const maximum = section === "ga" || section === "ra" ? 361 : 338;
  if (number > maximum) return { status: "out-of-range" };
  const seat = byKey.get(`${section}:${number}`);
  return seat ? { status: "found", seat } : { status: "unconfirmed" };
}

export function getRowSeats(seat: ChapelSeat): readonly ChapelSeat[] {
  return byRow.get(seat.rowId) ?? [];
}
