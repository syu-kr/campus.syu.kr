export const SECTION_IDS = ["ga", "na", "da", "ra"] as const;
export type SectionId = (typeof SECTION_IDS)[number];
export const SECTION_LABELS: Record<SectionId, string> = { ga: "가열", na: "나열", da: "다열", ra: "라열" };
export const LAYOUT_VERSION = "auditorium-1f-2026-11-04-v1";
export const DATA_PROVENANCE = {
  schemaVersion: 1,
  layoutVersion: LAYOUT_VERSION,
  reviewedAt: "2026-11-04",
  method: "source-comparison",
  photo: "https://www.syu.ac.kr/wp-content/uploads/2023/06/6월7일수-대강당채플좌석_1.jpg",
  restoredFrom: "https://www.syu.ac.kr/wp-content/uploads/2018/09/삼육대학교_대관안내문전체.pdf",
} as const;
export const VIEWBOX = { width: 1000, height: 900 } as const;
export const DOORS = [
  // Source-relative placement within the adjacent seat blocks; not measured route coordinates.
  { id: "front-left", x: 166, y: 100 }, { id: "front-right", x: 834, y: 100 },
  { id: "rear-1", x: 246, y: 850 }, { id: "rear-2", x: 376, y: 850 },
  { id: "rear-3", x: 500, y: 850 }, { id: "rear-4", x: 624, y: 850 },
  { id: "rear-5", x: 754, y: 850 },
] as const;

type Range = readonly [number, number];

// Source-transcribed row boundaries; gaps in the current drawing are not filled from its header.
const outerRows: readonly Range[] = [
  [35, 46], [47, 58], [59, 70], [71, 82], [83, 95], [96, 108],
  [109, 121], [122, 134], [135, 148], [149, 162], [163, 176], [177, 190],
  [191, 205], [206, 220], [221, 235], [236, 250], [251, 265], [266, 281],
  [282, 297], [298, 313], [314, 329], [330, 345], [346, 361],
];
const centreRows: readonly Range[] = [
  [1, 13], [14, 26], [27, 39], [40, 52], [53, 65], [66, 78],
  [79, 91], [92, 104], [105, 117], [118, 130], [131, 143], [144, 156],
  [157, 169], [170, 182], [183, 195], [196, 208], [209, 221], [222, 234],
  [235, 247], [248, 260], [261, 273], [274, 286], [287, 299], [300, 312],
  [313, 325], [326, 338],
];
const ROW_RANGES: Record<SectionId, readonly Range[]> = {
  ga: [[1, 8], [12, 20], [23, 33], ...outerRows],
  na: centreRows,
  da: centreRows,
  ra: [[4, 11], [14, 22], [24, 34], ...outerRows],
};
export const UNCONFIRMED_NUMBERS: Record<SectionId, readonly number[]> = {
  ga: [9, 10, 11, 21, 22, 34], na: [], da: [], ra: [1, 2, 3, 12, 13, 23],
};

export interface ChapelSeat {
  id: string;
  section: SectionId;
  number: number;
  row: number;
  rowId: string;
  x: number;
  y: number;
  source: "photo" | "restored";
}
export interface ChapelRow {
  id: string;
  section: SectionId;
  row: number;
  seatIds: string[];
}

export const ROWS: ChapelRow[] = [];
export const SEATS: ChapelSeat[] = [];

for (const section of SECTION_IDS) {
  ROW_RANGES[section].forEach(([start, end], rowIndex) => {
    const row = rowIndex + 1;
    const rowId = `grand-auditorium:1:${section}:row:${row}`;
    const seatIds: string[] = [];
    const outer = section === "ga" || section === "ra";
    const nominalStart = row === 1 ? 1 : row === 2 ? 12 : row === 3 ? 23 : start;
    const nominalEnd = row === 1 ? 11 : row === 2 ? 22 : row === 3 ? 34 : end;
    for (let number = start; number <= end; number++) {
      const slot = number - (outer ? nominalStart : start);
      const count = outer ? nominalEnd - nominalStart + 1 : end - start + 1;
      const id = `grand-auditorium:1:${section}:${number}`;
      const x = section === "ga" ? 286 - (count - 1 - slot) * 12
        : section === "na" ? 330 + slot * 12
        : section === "da" ? 526 + slot * 12 : 714 + slot * 12;
      // Schematic fan-shaped rows preserve seat order; these coordinates are not measured distances.
      const y = 190 + rowIndex * 24 + (section === "ga" ? slot * 0.7 : section === "ra" ? (count - 1 - slot) * 0.7 : 0);
      SEATS.push({ id, section, number, row, rowId, x, y, source: !outer && row <= 4 ? "restored" : "photo" });
      seatIds.push(id);
    }
    ROWS.push({ id: rowId, section, row, seatIds });
  });
}
