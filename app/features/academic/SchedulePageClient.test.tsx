import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SchedulePageClient from "./SchedulePageClient";

vi.mock("@/lib/use-url-search", () => ({ useUrlSearch: () => useState("") }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ initialData }: { initialData: unknown }) => ({
    data: initialData, isLoading: false, isError: false, refetch: vi.fn(),
  }),
}));

describe("academic schedule search", () => {
  it("shows only matching list results during search and restores the full list after clearing", () => {
    render(<SchedulePageClient initialDateStringDot="2026.10.04" initialSchedules={[
      { id: "exam", title: "중간고사", startDate: "2026.10.20", endDate: "2026.10.24", category: "exam" },
      { id: "holiday", title: "겨울방학", startDate: "2026.12.20", endDate: "2026.12.31", category: "holiday" },
    ]} />);
    expect(screen.getByRole("heading", { name: "중간고사" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "겨울방학" })).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: "일정 검색..." });
    fireEvent.change(input, { target: { value: " 중간 " } });
    expect(screen.getAllByRole("heading", { name: "중간고사" })).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "겨울방학" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "검색 초기화" }));
    expect(screen.getByRole("heading", { name: "겨울방학" })).toBeInTheDocument();
  });
});
