import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { lookupSeat } from "@/lib/chapel-seats/lookup";
import { SAVED_SEAT_KEY, saveSeat } from "@/lib/chapel-seats/storage";
import { SavedSeatPanel } from "./SavedSeatPanel";

function seat(section: string, number: string) {
  const result = lookupSeat(section, number);
  if (result.status !== "found") throw new Error("Missing reviewed fixture");
  return result.seat;
}

const onRestore = vi.fn();
beforeEach(() => localStorage.clear());

describe("saved seat action messages", () => {
  it("clears save and replacement messages on input/result changes without reviving them or changing storage", () => {
    const na = seat("na", "53"), da = seat("da", "66");
    const view = render(<SavedSeatPanel selected={na} searchKey="na:53" onRestore={onRestore} />);
    fireEvent.click(screen.getByRole("button", { name: "이 기기에 저장" }));
    expect(screen.getByRole("status")).toHaveTextContent("이 기기에 좌석을 저장했어요.");

    view.rerender(<SavedSeatPanel searchKey="na:53" onRestore={onRestore} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    view.rerender(<SavedSeatPanel selected={na} searchKey="na:53" onRestore={onRestore} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(JSON.parse(localStorage.getItem(SAVED_SEAT_KEY)!)).toMatchObject({ section: "na", number: 53 });

    view.rerender(<SavedSeatPanel selected={da} searchKey="da:66" onRestore={onRestore} />);
    fireEvent.click(screen.getByRole("button", { name: "이 좌석으로 변경" }));
    expect(screen.getByRole("status")).toHaveTextContent("이 기기에 좌석을 저장했어요.");
    expect(JSON.parse(localStorage.getItem(SAVED_SEAT_KEY)!)).toMatchObject({ section: "da", number: 66 });
    view.rerender(<SavedSeatPanel searchKey="ga:9" onRestore={onRestore} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("clears a deletion message when editing an unsuccessful query with no selected seat", () => {
    saveSeat(localStorage, seat("na", "53"));
    const view = render(<SavedSeatPanel searchKey="ga:9" onRestore={onRestore} />);
    fireEvent.click(screen.getByRole("button", { name: "저장 삭제" }));
    expect(screen.getByRole("status")).toHaveTextContent("저장한 좌석을 삭제했어요.");
    expect(localStorage.getItem(SAVED_SEAT_KEY)).toBeNull();
    view.rerender(<SavedSeatPanel searchKey="ga:10" onRestore={onRestore} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    view.rerender(<SavedSeatPanel searchKey="ga:9" onRestore={onRestore} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("shows save/delete failures without claiming success or losing the saved seat", () => {
    const na = seat("na", "53"), da = seat("da", "66");
    saveSeat(localStorage, na);
    const view = render(<SavedSeatPanel selected={da} searchKey="da:66" onRestore={onRestore} />);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("blocked"); });
    fireEvent.click(screen.getByRole("button", { name: "이 좌석으로 변경" }));
    expect(screen.getByRole("status")).toHaveTextContent("저장소를 사용할 수 없어요.");
    expect(JSON.parse(localStorage.getItem(SAVED_SEAT_KEY)!)).toMatchObject({ section: "na", number: 53 });

    view.rerender(<SavedSeatPanel searchKey="ga:9" onRestore={onRestore} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new DOMException("blocked"); });
    fireEvent.click(screen.getByRole("button", { name: "저장 삭제" }));
    expect(screen.getByRole("status")).toHaveTextContent("저장소를 사용할 수 없어요.");
    expect(JSON.parse(localStorage.getItem(SAVED_SEAT_KEY)!)).toMatchObject({ section: "na", number: 53 });
  });
});
