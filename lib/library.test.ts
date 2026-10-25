import { describe, expect, it } from "vitest";

import { getLibrarySeason, getVisibleReadingRooms, isLibraryRoomVisible, ROOM_SEAT_MAP_URLS } from "@/lib/library";

const SEMESTER_PERIODS = [
  {
    startDate: "2026-03-03",
    endDate: "2026-06-15",
  },
  {
    startDate: "2026-09-01",
    endDate: "2026-12-14",
  },
];

describe("getLibrarySeason", () => {
  it.each([
    ["2026-03-03", "semester"],
    ["2026-06-15", "semester"],
    ["2026-06-16", "vacation"],
    ["2026-07-26", "vacation"],
    ["2026-09-01", "semester"],
    ["2026-12-14", "semester"],
    ["2026-12-15", "vacation"],
  ] as const)("%s 날짜를 %s으로 판정한다", (dateString, expected) => {
    expect(getLibrarySeason(dateString, SEMESTER_PERIODS)).toBe(expected);
  });

  it("학기 데이터가 없으면 단축 운영인 방학으로 안전하게 판정한다", () => {
    expect(getLibrarySeason("2026-07-26")).toBe("vacation");
  });
});

describe("visible library rooms", () => {
  it.each(["채움실", "2층 채움실", "채 움 실 (이용 중지)"])("hides %s without matching other reading rooms", (name) => {
    expect(isLibraryRoomVisible(name)).toBe(false);
    expect(isLibraryRoomVisible("1층 집중실")).toBe(true);
  });

  it("keeps source seat-map indexes and excludes the unused room from visible seat totals", () => {
    const rooms = Object.freeze(ROOM_SEAT_MAP_URLS.map((_, index) => Object.freeze({
      strRoomNm: index === 3 ? "채움실" : index === 7 ? "1층 집중실" : `열람실 ${index + 1}`,
      strTotalSeat: index === 3 ? 999 : 100,
      strUseSeat: index === 3 ? 333 : 10,
      strRemainSeat: index === 3 ? 666 : 90,
    })));
    const visible = getVisibleReadingRooms(rooms);
    expect(visible).toHaveLength(7);
    expect(visible.map(({ sourceIndex }) => sourceIndex)).toEqual([0, 1, 2, 4, 5, 6, 7]);
    expect(visible.at(-1)?.seatMapUrl).toBe(ROOM_SEAT_MAP_URLS[7]);
    expect(visible.at(-1)?.seatMapUrl).toContain("roomNo=13&searchGB=S");
    expect(visible.reduce((sum, { room }) => sum + room.strTotalSeat, 0)).toBe(700);
    expect(visible.reduce((sum, { room }) => sum + room.strUseSeat, 0)).toBe(70);
    expect(visible.reduce((sum, { room }) => sum + room.strRemainSeat, 0)).toBe(630);
    expect(rooms).toHaveLength(8);
    expect(rooms[3].strRoomNm).toBe("채움실");
  });
});
