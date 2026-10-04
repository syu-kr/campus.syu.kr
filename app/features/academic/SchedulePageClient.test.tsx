import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SchedulePageClient from "./SchedulePageClient";
import { getDictionary } from "@/lib/i18n";
import { PUBLIC_HOLIDAY_SOURCE_URL } from "@/lib/public-holidays";
import type { PublicHolidaySnapshot } from "@/types/public-holidays";

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

function holidaySnapshot(overrides: Partial<PublicHolidaySnapshot> = {}): PublicHolidaySnapshot {
  return {
    schemaVersion: 1,
    sourceUrl: PUBLIC_HOLIDAY_SOURCE_URL,
    lastSuccessAt: new Date().toISOString(),
    years: [2026],
    holidays: [{ date: "2026-10-09", names: ["한글날"] }],
    ...overrides,
  };
}

describe("academic calendar public holidays", () => {
  it("keeps exams and school events visible alongside the accessible holiday label and source", () => {
    const text = getDictionary("ko").publicHolidays;
    render(<SchedulePageClient initialDateStringDot="2026.10.09" initialPublicHolidays={holidaySnapshot()} initialSchedules={[
      { id: "school-holiday", title: "한글날", startDate: "2026.10.09", endDate: "2026.10.09", category: "event" },
      { id: "exam", title: "중간고사", startDate: "2026.10.09", endDate: "2026.10.10", category: "exam" },
      { id: "event", title: "보강", startDate: "2026.10.09", endDate: "2026.10.09", category: "event" },
    ]} />);

    const holidayButton = screen.getByRole("button", { name: /공휴일: 한글날, 시험/ });
    expect(within(holidayButton).getByText(text.label)).toBeInTheDocument();
    expect(within(holidayButton).getByText("시험")).toBeInTheDocument();
    expect(holidayButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("heading", { name: "한글날" })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "보강" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: text.source })).toHaveAttribute("href", PUBLIC_HOLIDAY_SOURCE_URL);

    fireEvent.change(screen.getByRole("textbox", { name: "일정 검색..." }), { target: { value: "한글" } });
    expect(screen.getAllByRole("heading", { name: "한글날" })).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "보강" })).not.toBeInTheDocument();
  });

  it("warns when navigating into an uncovered year instead of claiming there are no holidays", () => {
    const text = getDictionary("ko").publicHolidays;
    render(<SchedulePageClient initialDateStringDot="2026.12.31" initialSchedules={[]} initialPublicHolidays={holidaySnapshot()} />);
    expect(screen.queryByText(text.unavailable)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다음 달" }));
    expect(screen.getByRole("status")).toHaveTextContent(text.unavailable);
  });

  it("keeps known holidays with a stale warning and preserves unrelated school holiday ranges", () => {
    const text = getDictionary("ko").publicHolidays;
    render(<SchedulePageClient initialDateStringDot="2026.10.09" initialPublicHolidays={holidaySnapshot({ stale: true })} initialSchedules={[
      { id: "break", title: "겨울방학", startDate: "2026.12.20", endDate: "2026.12.31", category: "holiday" },
    ]} />);
    expect(screen.getByRole("status")).toHaveTextContent(text.stale);
    expect(screen.getByRole("button", { name: /공휴일: 한글날/ })).toBeInTheDocument();
    const breakRow = screen.getByRole("heading", { name: "겨울방학" }).parentElement!.parentElement!.parentElement!;
    expect(within(breakRow).getByText("일정")).toBeInTheDocument();
    expect(within(breakRow).queryByText(text.label)).not.toBeInTheDocument();
  });
});
