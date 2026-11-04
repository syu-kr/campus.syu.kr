import { describe, expect, it } from "vitest";
import { DATA_PROVENANCE, DOORS, LAYOUT_VERSION, ROWS, SEATS, SECTION_IDS, UNCONFIRMED_NUMBERS, VIEWBOX } from "./data";
import { getRowSeats, lookupSeat } from "./lookup";

describe("source-reviewed chapel seats", () => {
  it("records source-comparison provenance rather than claiming field measurement", () => {
    expect(DATA_PROVENANCE).toMatchObject({ schemaVersion: 1, layoutVersion: LAYOUT_VERSION, method: "source-comparison" });
    expect(DATA_PROVENANCE.photo).toContain("2023/06/");
    expect(DATA_PROVENANCE.restoredFrom).toContain("2018/09/");
  });

  // Each tuple was read from the source audit ledger: ga start/end, centre start/end, ra start/end.
  it.each([
    [1, 1, 8, 1, 13, 4, 11], [2, 12, 20, 14, 26, 14, 22], [3, 23, 33, 27, 39, 24, 34],
    [4, 35, 46, 40, 52, 35, 46], [5, 47, 58, 53, 65, 47, 58], [6, 59, 70, 66, 78, 59, 70],
    [7, 71, 82, 79, 91, 71, 82], [8, 83, 95, 92, 104, 83, 95], [9, 96, 108, 105, 117, 96, 108],
    [10, 109, 121, 118, 130, 109, 121], [11, 122, 134, 131, 143, 122, 134],
    [12, 135, 148, 144, 156, 135, 148], [13, 149, 162, 157, 169, 149, 162],
    [14, 163, 176, 170, 182, 163, 176], [15, 177, 190, 183, 195, 177, 190],
    [16, 191, 205, 196, 208, 191, 205], [17, 206, 220, 209, 221, 206, 220],
    [18, 221, 235, 222, 234, 221, 235], [19, 236, 250, 235, 247, 236, 250],
    [20, 251, 265, 248, 260, 251, 265], [21, 266, 281, 261, 273, 266, 281],
    [22, 282, 297, 274, 286, 282, 297], [23, 298, 313, 287, 299, 298, 313],
    [24, 314, 329, 300, 312, 314, 329], [25, 330, 345, 313, 325, 330, 345],
    [26, 346, 361, 326, 338, 346, 361],
  ])("matches every source-ledger row boundary for row %i", (row, gaStart, gaEnd, middleStart, middleEnd, raStart, raEnd) => {
    for (const [section, first, last] of [["ga", gaStart, gaEnd], ["na", middleStart, middleEnd], ["da", middleStart, middleEnd], ["ra", raStart, raEnd]] as const) {
      const firstResult = lookupSeat(section, String(first));
      expect(firstResult).toMatchObject({ status: "found", seat: { row, number: first } });
      if (firstResult.status === "found") {
        const seats = getRowSeats(firstResult.seat);
        expect(seats[0].number).toBe(first);
        expect(seats.at(-1)?.number).toBe(last);
        expect(seats).toHaveLength(last - first + 1);
      }
    }
  });

  it("keeps observed and restored counts separate from physical capacity", () => {
    expect(SEATS.filter((seat) => seat.source === "photo")).toHaveLength(1282);
    expect(SEATS.filter((seat) => seat.source === "restored")).toHaveLength(104);
    expect(SEATS).toHaveLength(1386);
    expect(ROWS).toHaveLength(104);
    expect(DOORS).toHaveLength(7);
    for (const section of SECTION_IDS) {
      expect(SEATS.filter((seat) => seat.section === section)).toHaveLength(section === "na" || section === "da" ? 338 : 355);
      for (const number of UNCONFIRMED_NUMBERS[section]) {
        expect(lookupSeat(section, String(number))).toEqual({ status: "unconfirmed" });
      }
    }
  });

  it("keeps source doors behind their seat blocks and at the outer front-row ends", () => {
    const rear = DOORS.filter((door) => door.id.startsWith("rear-"));
    const front = DOORS.filter((door) => door.id.startsWith("front-"));
    expect(rear).toHaveLength(5);
    expect(front).toHaveLength(2);
    expect(new Set(DOORS.map((door) => door.id)).size).toBe(7);

    const rearBlocks = SECTION_IDS.map((section) => {
      const row = SEATS.filter((seat) => seat.section === section && seat.row === 26);
      const left = Math.min(...row.map((seat) => seat.x));
      const right = Math.max(...row.map((seat) => seat.x));
      return { left, right, middle: (left + right) / 2 };
    });
    // Source: ga inner side, na left half, centre aisle, da right half, ra inner side.
    for (const [door, block, side] of [
      [rear[0], rearBlocks[0], "right"], [rear[1], rearBlocks[1], "left"],
      [rear[3], rearBlocks[2], "right"], [rear[4], rearBlocks[3], "left"],
    ] as const) {
      expect(door.x).toBeGreaterThan(block.left);
      expect(door.x).toBeLessThan(block.right);
      expect(side === "left" ? door.x < block.middle : door.x > block.middle).toBe(true);
    }
    expect(rear[2].x).toBeGreaterThan(rearBlocks[1].right);
    expect(rear[2].x).toBeLessThan(rearBlocks[2].left);
    expect(rear.map((door) => door.x)).toEqual(rear.map((door) => door.x).sort((a, b) => a - b));
    expect(rear.every((door) => door.y > Math.max(...SEATS.map((seat) => seat.y)))).toBe(true);
    expect(front[0].x).toBe(SEATS.find((seat) => seat.section === "ga" && seat.number === 1)!.x);
    expect(front[1].x).toBe(SEATS.find((seat) => seat.section === "ra" && seat.number === 11)!.x);
    expect(front.every((door) => door.y < Math.min(...SEATS.map((seat) => seat.y)))).toBe(true);
    expect(DOORS.every((door) => door.x > 0 && door.x < VIEWBOX.width && door.y > 0 && door.y < VIEWBOX.height)).toBe(true);
  });

  it.each([
    ["ga", 8, 1], ["ga", 12, 2], ["ga", 20, 2], ["ga", 23, 3], ["ga", 33, 3],
    ["ra", 4, 1], ["ra", 11, 1], ["ra", 14, 2], ["ra", 22, 2], ["ra", 24, 3], ["ra", 34, 3],
    ["ga", 35, 4], ["ga", 46, 4], ["ga", 47, 5], ["ga", 70, 6], ["ga", 71, 7],
    ["ga", 82, 7], ["ga", 83, 8], ["ga", 95, 8], ["ga", 96, 9], ["ga", 108, 9],
    ["ga", 134, 11], ["ga", 135, 12], ["ga", 148, 12], ["ga", 149, 13],
    ["ga", 190, 15], ["ga", 191, 16], ["ga", 205, 16], ["ga", 206, 17],
    ["ga", 265, 20], ["ga", 266, 21], ["ga", 281, 21], ["ga", 282, 22],
    ["ga", 329, 24], ["ga", 330, 25], ["ga", 345, 25], ["ga", 346, 26], ["ga", 361, 26],
    ["ra", 35, 4], ["ra", 83, 8], ["ra", 135, 12], ["ra", 191, 16], ["ra", 266, 21], ["ra", 361, 26],
    ["na", 1, 1], ["na", 13, 1], ["na", 14, 2], ["na", 26, 2], ["na", 27, 3],
    ["na", 39, 3], ["na", 40, 4], ["na", 52, 4], ["na", 53, 5], ["na", 65, 5],
    ["na", 66, 6], ["na", 130, 10], ["na", 131, 11], ["na", 169, 13],
    ["na", 170, 14], ["na", 260, 20], ["na", 261, 21], ["na", 338, 26],
    ["da", 1, 1], ["da", 52, 4], ["da", 53, 5], ["da", 66, 6], ["da", 338, 26],
  ])("matches independently transcribed boundary %s %i to row %i", (section, number, row) => {
    const result = lookupSeat(String(section), String(number));
    expect(result.status).toBe("found");
    if (result.status === "found") expect(result.seat.row).toBe(row);
  });

  it("has unique identities and coordinates with complete row references", () => {
    expect(new Set(SEATS.map((seat) => seat.id)).size).toBe(SEATS.length);
    expect(new Set(SEATS.map((seat) => `${seat.x}:${seat.y}`)).size).toBe(SEATS.length);
    expect(new Set(ROWS.map((row) => row.id)).size).toBe(ROWS.length);
    expect(ROWS.flatMap((row) => row.seatIds).sort()).toEqual(SEATS.map((seat) => seat.id).sort());
    for (const seat of SEATS) {
      expect(seat.x).toBeGreaterThan(0);
      expect(seat.y).toBeGreaterThan(0);
      expect(seat.x).toBeLessThan(VIEWBOX.width);
      expect(seat.y).toBeLessThan(VIEWBOX.height);
      const rowSeats = getRowSeats(seat);
      expect(rowSeats).toContain(seat);
      expect(rowSeats.every((other) => other.section === seat.section && other.row === seat.row)).toBe(true);
      expect(rowSeats.map((other) => other.number)).toEqual(rowSeats.map((other) => other.number).sort((a, b) => a - b));
    }
    const na = lookupSeat("na", "53"), da = lookupSeat("da", "53");
    if (na.status === "found" && da.status === "found") {
      expect(na.seat.id).not.toBe(da.seat.id);
      expect(na.seat.x).toBeLessThan(da.seat.x);
    }
  });
});
