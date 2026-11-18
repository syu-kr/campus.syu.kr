import { beforeEach, describe, expect, it } from "vitest";
import { lookupSeat } from "./lookup";
import { deleteSavedSeat, readSavedSeat, SAVED_SEAT_KEY, saveSeat } from "./storage";

function seat(section = "na", number = "1") {
  const result = lookupSeat(section, number);
  if (result.status !== "found") throw new Error("Missing reviewed fixture");
  return result.seat;
}
beforeEach(() => localStorage.clear());

describe("saved chapel seat", () => {
  it("stores only identity and version metadata, restores a reviewed front seat and replaces/deletes only its own key", () => {
    localStorage.setItem("unrelated", "keep");
    expect(saveSeat(localStorage, seat(), new Date("2026-11-04T00:00:00Z"))).toBe(true);
    const stored = JSON.parse(localStorage.getItem(SAVED_SEAT_KEY)!);
    expect(Object.keys(stored).sort()).toEqual(["schemaVersion", "seatId", "section", "number", "layoutVersion", "savedAt", "confirmedAt"].sort());
    expect(readSavedSeat(localStorage)).toMatchObject({ status: "saved", seat: { number: 1, section: "na" }, needsConfirmation: false });
    expect(saveSeat(localStorage, seat("da", "53"))).toBe(true);
    expect(readSavedSeat(localStorage)).toMatchObject({ status: "saved", seat: { section: "da", number: 53 } });
    expect(deleteSavedSeat(localStorage)).toBe(true);
    expect(readSavedSeat(localStorage)).toEqual({ status: "empty" });
    expect(localStorage.getItem("unrelated")).toBe("keep");
  });
  it("marks a changed layout for reconfirmation while resolving against current coordinates", () => {
    saveSeat(localStorage, seat());
    const stored = JSON.parse(localStorage.getItem(SAVED_SEAT_KEY)!);
    localStorage.setItem(SAVED_SEAT_KEY, JSON.stringify({ ...stored, layoutVersion: "old-map", x: -999 }));
    const result = readSavedSeat(localStorage);
    expect(result).toMatchObject({ status: "saved", needsConfirmation: true, seat: { id: seat().id } });
    if (result.status === "saved") expect(result.value).not.toHaveProperty("x");
  });
  it("keeps an old identity whose location is now unknown without fabricating a marker", () => {
    saveSeat(localStorage, seat());
    const stored = JSON.parse(localStorage.getItem(SAVED_SEAT_KEY)!);
    localStorage.setItem(SAVED_SEAT_KEY, JSON.stringify({ ...stored, section: "ga", number: 9, seatId: "grand-auditorium:1:ga:9" }));
    expect(readSavedSeat(localStorage)).toMatchObject({ status: "saved", seat: null, needsConfirmation: true });
  });
  it.each(["{broken", "null", "[]", '{"schemaVersion":2}', '{"schemaVersion":1,"savedAt":"bad"}'])("recovers from invalid data %s", (raw) => {
    localStorage.setItem(SAVED_SEAT_KEY, raw);
    expect(readSavedSeat(localStorage)).toEqual({ status: "invalid" });
  });
  it("rejects mismatched identities and invalid dates", () => {
    saveSeat(localStorage, seat());
    const stored = JSON.parse(localStorage.getItem(SAVED_SEAT_KEY)!);
    for (const change of [{ seatId: "another-seat" }, { confirmedAt: "bad" }, { number: 1.5 }]) {
      localStorage.setItem(SAVED_SEAT_KEY, JSON.stringify({ ...stored, ...change }));
      expect(readSavedSeat(localStorage)).toEqual({ status: "invalid" });
    }
  });
  it("handles denied reads, writes, and deletes without breaking seat lookup", () => {
    const deny = () => { throw new Error("Storage denied"); };
    expect(readSavedSeat({ getItem: deny })).toEqual({ status: "unavailable" });
    expect(saveSeat({ setItem: deny }, seat())).toBe(false);
    expect(deleteSavedSeat({ removeItem: deny })).toBe(false);
    expect(lookupSeat("na", "1").status).toBe("found");
  });
});
