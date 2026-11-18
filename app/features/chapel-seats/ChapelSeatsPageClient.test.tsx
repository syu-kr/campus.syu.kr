import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientLocaleProvider } from "@/app/components/LocaleContext";
import { enDictionary } from "@/lib/i18n/en";
import { LAYOUT_VERSION } from "@/lib/chapel-seats/data";
import { SAVED_SEAT_KEY } from "@/lib/chapel-seats/storage";
import ChapelSeatsPageClient from "./ChapelSeatsPageClient";

function find(section: string, number: string) {
  fireEvent.change(screen.getByLabelText("구역"), { target: { value: section } });
  fireEvent.change(screen.getByLabelText("좌석 번호"), { target: { value: number } });
  fireEvent.click(screen.getByRole("button", { name: "위치 찾기" }));
}

beforeEach(() => { localStorage.clear(); });

describe("chapel seat finder", () => {
  it("finds restored seats and presents the current row without a seat click", () => {
    render(<ChapelSeatsPageClient />);
    find("na", "001");
    expect(screen.getAllByText("나열 1번 · 01줄")).toHaveLength(2);
    expect(screen.getByText("해당 좌석 등받이 뒤의 번호 표찰을 확인하세요.")).toBeVisible();
    expect(screen.getByText("공식 좌석도를 대조해 보완한 앞쪽 좌석입니다.")).toBeVisible();
    const row = screen.getByRole("region", { name: "선택한 줄" });
    expect(within(row).getAllByRole("listitem")).toHaveLength(13);
    expect(within(row).getByText("1")).toHaveAttribute("aria-current", "true");
    expect(within(row).getByText("왼쪽부터 1 / 13")).toBeVisible();
    expect(screen.getByRole("button", { name: "좌석 확대" })).toBeEnabled();
  });

  it("clears a previous selection on editing and never highlights an unconfirmed number", () => {
    render(<ChapelSeatsPageClient />);
    find("ga", "53");
    expect(screen.getByRole("region", { name: "선택한 줄" })).toBeVisible();
    fireEvent.change(screen.getByLabelText("좌석 번호"), { target: { value: "9" } });
    expect(screen.queryByRole("region", { name: "선택한 줄" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "이 기기에 저장" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "위치 찾기" }));
    expect(screen.getByText(/현재 도면에서 해당 번호의 위치를 확인할 수 없어요/)).toBeVisible();
    expect(screen.getByLabelText("좌석 번호")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "좌석 확대" })).toBeDisabled();
    expect(screen.queryByRole("region", { name: "선택한 줄" })).not.toBeInTheDocument();
  });

  it("does not turn an incomplete outer row into a physical seat ordinal", () => {
    render(<ChapelSeatsPageClient />);
    find("ra", "4");
    const row = screen.getByRole("region", { name: "선택한 줄" });
    expect(within(row).getAllByRole("listitem")).toHaveLength(8);
    expect(within(row).getByText("현재 도면에서 확인된 좌석 8개입니다. 생략된 번호가 있을 수 있어요.")).toBeVisible();
    expect(within(row).queryByText("왼쪽부터 1 / 8")).not.toBeInTheDocument();
  });

  it("rejects malformed numbers and a missing section without HTML number coercion", () => {
    render(<ChapelSeatsPageClient />);
    fireEvent.click(screen.getByRole("button", { name: "위치 찾기" }));
    expect(screen.getByLabelText("구역")).toHaveAttribute("aria-invalid", "true");
    find("na", "339");
    expect(screen.getByLabelText("좌석 번호")).toHaveAttribute("aria-invalid", "true");
    find("na", "1e2");
    expect(screen.getByLabelText("좌석 번호")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("좌석 번호를 양의 정수로 입력하세요.")).toBeVisible();
  });

  it("persists only after save, restores on a revisit, and deletes only its own key", () => {
    localStorage.setItem("other-feature", "keep");
    const first = render(<ChapelSeatsPageClient />);
    find("na", "53");
    expect(localStorage.getItem(SAVED_SEAT_KEY)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "이 기기에 저장" }));
    expect(JSON.parse(localStorage.getItem(SAVED_SEAT_KEY)!)).toMatchObject({ section: "na", number: 53 });
    find("da", "66");
    expect(JSON.parse(localStorage.getItem(SAVED_SEAT_KEY)!)).toMatchObject({ section: "na", number: 53 });
    fireEvent.click(screen.getByRole("button", { name: "이 좌석으로 변경" }));
    first.unmount();
    render(<ChapelSeatsPageClient />);
    fireEvent.click(screen.getByRole("button", { name: "저장한 좌석 보기" }));
    expect(screen.getByLabelText("구역")).toHaveValue("da");
    expect(screen.getByLabelText("좌석 번호")).toHaveValue("66");
    fireEvent.click(screen.getByRole("button", { name: "저장 삭제" }));
    expect(localStorage.getItem(SAVED_SEAT_KEY)).toBeNull();
    expect(localStorage.getItem("other-feature")).toBe("keep");
  });

  it("requires explicit saving again when the stored map version has changed", () => {
    localStorage.setItem(SAVED_SEAT_KEY, JSON.stringify({ schemaVersion: 1,
      seatId: "grand-auditorium:1:na:53", section: "na", number: 53,
      layoutVersion: "old-map", savedAt: "2026-10-01T00:00:00.000Z", confirmedAt: "2026-10-01T00:00:00.000Z" }));
    render(<ChapelSeatsPageClient />);
    expect(screen.getByText(/좌석 배치 정보가 변경됐어요/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "저장한 좌석 보기" }));
    expect(JSON.parse(localStorage.getItem(SAVED_SEAT_KEY)!)).toHaveProperty("layoutVersion", "old-map");
    fireEvent.click(screen.getByRole("button", { name: "이 좌석으로 변경" }));
    expect(JSON.parse(localStorage.getItem(SAVED_SEAT_KEY)!)).toHaveProperty("layoutVersion", LAYOUT_VERSION);
  });

  it("keeps lookup usable when persistent saving fails", () => {
    render(<ChapelSeatsPageClient />);
    find("na", "53");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("blocked"); });
    fireEvent.click(screen.getByRole("button", { name: "이 기기에 저장" }));
    expect(screen.getByText(/저장소를 사용할 수 없어요. 좌석 조회는 계속 이용할 수 있습니다/)).toBeVisible();
    expect(screen.queryByText("이 기기에 좌석을 저장했어요.")).not.toBeInTheDocument();
    find("da", "338");
    expect(screen.getAllByText("다열 338번 · 26줄")).toHaveLength(2);
  });

  it("handles blocked storage access without preventing a seat lookup", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("blocked"); });
    render(<ChapelSeatsPageClient />);
    expect(screen.getByText("이 기기의 저장소를 사용할 수 없어요.")).toBeVisible();
    find("na", "53");
    expect(screen.getAllByText("나열 53번 · 05줄")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "이 기기에 저장" }));
    expect(screen.getByText(/저장소를 사용할 수 없어요. 좌석 조회는 계속 이용할 수 있습니다/)).toBeVisible();
  });

  it("keeps edge seats inside the map when using zoom and restores the whole view", () => {
    render(<ChapelSeatsPageClient />);
    for (const [section, number] of [["ga", "1"], ["ra", "361"]]) {
      find(section, number);
      fireEvent.click(screen.getByRole("button", { name: "좌석 확대" }));
      fireEvent.click(screen.getByRole("button", { name: "확대" }));
      fireEvent.click(screen.getByRole("button", { name: "확대" }));
      const svg = screen.getByRole("img", { name: /좌석 위치/ });
      const [x, y, width, height] = svg.getAttribute("viewBox")!.split(" ").map(Number);
      const marker = svg.querySelector(`[data-seat-id="grand-auditorium:1:${section}:${number}"] rect`)!;
      const markerX = Number(marker.getAttribute("x")), markerY = Number(marker.getAttribute("y"));
      expect(markerX).toBeGreaterThanOrEqual(x);
      expect(markerX + Number(marker.getAttribute("width"))).toBeLessThanOrEqual(x + width);
      expect(markerY).toBeGreaterThanOrEqual(y);
      expect(markerY + Number(marker.getAttribute("height"))).toBeLessThanOrEqual(y + height);
      const check = Array.from(svg.querySelectorAll("text")).find((node) => node.textContent === "✓")!;
      expect(Number(check.getAttribute("y")) - 3.5).toBeGreaterThanOrEqual(y);
      expect(screen.getByRole("button", { name: "확대" })).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "전체 보기" }));
      expect(svg).toHaveAttribute("viewBox", "0 0 1000 900");
    }
  });

  it("starts with the whole location, exposes row labels, and shows numbered detail with a non-color selection", () => {
    render(<ChapelSeatsPageClient />);
    find("na", "53");
    const map = screen.getByRole("img", { name: /좌석 위치/ });
    expect(map).toHaveAttribute("viewBox", "0 0 1000 900");
    expect(screen.getByRole("button", { name: "전체 보기" })).toHaveAttribute("aria-pressed", "true");
    expect(map.parentElement).toHaveTextContent("05");
    fireEvent.click(screen.getByRole("button", { name: "좌석 확대" }));
    expect(map.querySelector('[data-seat-id="grand-auditorium:1:na:53"] text')).toHaveTextContent("53");
    expect(map.querySelector('[data-seat-id="grand-auditorium:1:na:54"] text')).toHaveTextContent("54");
    expect(map.querySelector('[data-seat-id="grand-auditorium:1:ga:9"]')).toBeNull();
    expect(map.querySelector("circle")).toBeNull();
    expect(screen.getByRole("button", { name: "좌석 확대" })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("region", { name: "좌석 위치" })).getByText("✓")).toBeVisible();
    expect(within(screen.getByRole("region", { name: "선택한 줄" })).getByText("✓")).toBeVisible();
    expect(screen.getByText("↑ 무대 · 선택 좌석: 나열 53번 · 05줄")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "전체 보기" }));
    expect(map.querySelector('[data-seat-id="grand-auditorium:1:na:54"] text')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "확대" }));
    expect(map.querySelector('[data-seat-id="grand-auditorium:1:na:54"] text')).toHaveTextContent("54");
  });

  it("puts the map and row before saving on the page", () => {
    render(<ChapelSeatsPageClient />);
    find("ra", "220");
    const map = screen.getByRole("region", { name: "좌석 위치" });
    const row = screen.getByRole("region", { name: "선택한 줄" });
    const saved = screen.getByRole("region", { name: "저장한 좌석" });
    expect(map.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(row.compareDocumentPosition(saved) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("supports English while preserving the real Korean section label", () => {
    render(<ClientLocaleProvider locale="en" dictionary={enDictionary}><ChapelSeatsPageClient /></ClientLocaleProvider>);
    fireEvent.change(screen.getByLabelText("Section"), { target: { value: "na" } });
    fireEvent.change(screen.getByLabelText("Seat number"), { target: { value: "53" } });
    fireEvent.click(screen.getByRole("button", { name: "Find seat" }));
    expect(screen.getAllByText("나열 · Seat 53 · Row 05")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Save on this device" })).toBeEnabled();
  });
});
