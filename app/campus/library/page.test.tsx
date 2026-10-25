import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useQuery } from "@tanstack/react-query";
import { getDictionary } from "@/lib/i18n";
import { ROOM_SEAT_MAP_URLS } from "@/lib/library";
import LibraryPage from "./page";

vi.mock("@tanstack/react-query", () => ({ useQuery: vi.fn() }));

it("hides unused rooms from both lists and preserves the eighth room's seat-modal destination", () => {
  vi.mocked(useQuery).mockImplementation((options) => ({
    data: options.queryKey[0] === "library-reading-rooms" ? {
      success: true, source: "library-reading-room", sourceStatus: "fresh", stale: false,
      timestamp: "2026-10-26T00:00:00Z",
      data: ROOM_SEAT_MAP_URLS.map((_, index) => ({
        strRoomNm: index === 3 ? "채움실" : index === 7 ? "1층 집중실" : `열람실 ${index + 1}`,
        strTotalSeat: 100, strUseSeat: 10, strRemainSeat: 90,
      })),
    } : { semesterPeriods: [] },
    isLoading: false, isFetching: false, isError: false, refetch: vi.fn(),
  } as unknown as ReturnType<typeof useQuery>));
  render(<LibraryPage />);
  const text = getDictionary("ko").pages.library;
  expect(screen.queryByText("채움실")).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: text.viewSeats })).toHaveLength(7);
  fireEvent.click(screen.getByRole("button", { name: text.semester }));
  expect(screen.queryByText("채움실")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: text.vacation }));
  expect(screen.queryByText("채움실")).not.toBeInTheDocument();
  const focusRoom = screen.getByText("1층 집중실").closest("div")!;
  fireEvent.click(within(focusRoom).getByRole("button", { name: text.viewSeats }));
  const dialog = screen.getByRole("dialog", { name: text.seatStatusTitle });
  expect(dialog.querySelector("iframe")).toHaveAttribute("src", ROOM_SEAT_MAP_URLS[7]);
  expect(within(dialog).getByRole("link", { name: text.openInNewTab })).toHaveAttribute("href", ROOM_SEAT_MAP_URLS[7]);
});
