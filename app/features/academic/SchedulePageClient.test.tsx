import { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SchedulePageClient from "./SchedulePageClient";
import { getDictionary } from "@/lib/i18n";
import { PUBLIC_HOLIDAY_SOURCE_URL } from "@/lib/public-holidays";
import type { PublicHolidaySnapshot } from "@/types/public-holidays";

const queryOverrides = vi.hoisted(() => ({} as Record<string, { data?: unknown; isError?: boolean }>));
vi.mock("@/lib/use-url-search", () => ({ useUrlSearch: () => useState("") }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey, initialData }: { queryKey: string[]; initialData: unknown }) => ({
    data: initialData, isLoading: false, isError: false, refetch: vi.fn(), ...queryOverrides[queryKey[0]],
  }),
}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(new Date("2026-10-09T03:00:00Z"));
  Object.keys(queryOverrides).forEach((key) => delete queryOverrides[key]);
});
afterEach(() => vi.useRealTimers());

describe("academic schedule search", () => {
  it("shows only matching list results during search and restores the full list after clearing", () => {
    render(<SchedulePageClient initialDateStringDot="2026.10.04" initialNowIso="2026-10-04T03:00:00Z" initialSchedules={[
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
    render(<SchedulePageClient initialDateStringDot="2026.10.09" initialNowIso="2026-10-09T03:00:00Z" initialPublicHolidays={holidaySnapshot()} initialSchedules={[
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
    for (const link of screen.getAllByRole("link", { name: text.source })) {
      expect(link).toHaveAttribute("href", PUBLIC_HOLIDAY_SOURCE_URL);
    }

    fireEvent.change(screen.getByRole("textbox", { name: "일정 검색..." }), { target: { value: "한글" } });
    expect(screen.getAllByRole("heading", { name: "한글날" })).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "보강" })).not.toBeInTheDocument();
  });

  it("warns when navigating into an uncovered year instead of claiming there are no holidays", () => {
    const text = getDictionary("ko").publicHolidays;
    render(<SchedulePageClient initialDateStringDot="2026.12.31" initialNowIso="2026-12-31T03:00:00Z" initialSchedules={[]} initialPublicHolidays={holidaySnapshot()} />);
    expect(screen.queryByText(text.unavailable)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다음 달" }));
    expect(screen.getByRole("status")).toHaveTextContent(text.unavailable);
  });

  it("keeps known holidays with a stale warning and preserves unrelated school holiday ranges", () => {
    const text = getDictionary("ko").publicHolidays;
    render(<SchedulePageClient initialDateStringDot="2026.10.09" initialNowIso="2026-10-09T03:00:00Z" initialPublicHolidays={holidaySnapshot({ stale: true })} initialSchedules={[
      { id: "break", title: "겨울방학", startDate: "2026.12.20", endDate: "2026.12.31", category: "holiday" },
    ]} />);
    expect(screen.getByRole("status")).toHaveTextContent(text.stale);
    expect(screen.getByRole("button", { name: /공휴일: 한글날/ })).toBeInTheDocument();
    const breakRow = screen.getByRole("heading", { name: "겨울방학" }).parentElement!.parentElement!.parentElement!;
    expect(within(breakRow).getByText("일정")).toBeInTheDocument();
    expect(within(breakRow).queryByText(text.label)).not.toBeInTheDocument();
  });
});

function expectMatchingAnswer() {
  const section = screen.getByRole("region", { name: getDictionary("ko").pages.academicSchedule.answer.title });
  const script = document.getElementById("academic-schedule-answer-schema")!;
  const schema = JSON.parse(script.textContent!);
  const visibleAnswer = section.querySelector("[data-answer-text]")!;
  expect(schema.mainEntity[0].acceptedAnswer.text).toBe(visibleAnswer.textContent);
  expect(schema.mainEntity[0].name).toBe(getDictionary("ko").pages.academicSchedule.answer.question);
  return { section, script, answer: visibleAnswer.textContent! };
}

describe("academic answer provenance", () => {
  it("shows an unknown academic confirmation time and the holiday's actual timestamp separately", () => {
    const checkedAt = "2026-10-08T12:34:00Z";
    render(<SchedulePageClient initialDateStringDot="2026.10.09" initialNowIso="2026-10-09T03:00:00Z"
      initialSchedules={[]} initialPublicHolidays={holidaySnapshot({ lastSuccessAt: checkedAt, stale: true })} nonce="test-nonce" />);
    const { section, script, answer } = expectMatchingAnswer();
    expect(within(section).getByRole("link", { name: "학사일정" }))
      .toHaveAttribute("href", "https://www.syu.ac.kr/academic/major-schedule/");
    expect(within(section).getByText(getDictionary("ko").answerSummary.unknownCheckedAt, { exact: false })).toBeInTheDocument();
    expect(section.querySelector(`time[datetime="${checkedAt}"]`)).toBeInTheDocument();
    expect(script).toHaveAttribute("nonce", "test-nonce");
    expect(answer).toContain("한글날");
    expect(answer).toContain(getDictionary("ko").publicHolidays.stale);
  });

  it("updates the visible answer and JSON-LD with query data while list search leaves today's answer intact", () => {
    const props = { initialDateStringDot: "2026.10.09", initialNowIso: "2026-10-09T03:00:00Z", initialSchedules: [], initialPublicHolidays: holidaySnapshot() };
    const view = render(<SchedulePageClient {...props} />);
    expect(expectMatchingAnswer().answer).toContain("한글날");

    queryOverrides.schedules = { data: [{ id: "exam", title: "변경된 시험", startDate: "2026.10.09", endDate: "2026.10.09", category: "exam" }] };
    queryOverrides["public-holidays"] = { data: holidaySnapshot({ lastSuccessAt: "2026-10-09T01:00:00Z", holidays: [] }) };
    view.rerender(<SchedulePageClient {...props} />);
    const { answer, section } = expectMatchingAnswer();
    expect(answer).toContain("변경된 시험");
    expect(answer).not.toContain("한글날");
    expect(screen.getByRole("heading", { name: "변경된 시험" })).toBeInTheDocument();
    expect(section.querySelector('time[datetime="2026-10-09T01:00:00Z"]')).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "일정 검색..." }), { target: { value: "없는 검색어" } });
    expect(screen.queryByRole("heading", { name: "변경된 시험" })).not.toBeInTheDocument();
    expect(expectMatchingAnswer().answer).toBe(answer);
  });

  it("refreshes the Korean basis date and answer across midnight without inventing a source confirmation", () => {
    vi.setSystemTime(new Date("2026-10-08T14:59:30Z"));
    render(<SchedulePageClient initialDateStringDot="2026.10.08" initialNowIso="2026-10-08T14:59:30Z"
      initialSchedules={[]} initialPublicHolidays={holidaySnapshot({ lastSuccessAt: "2026-10-08T12:00:00Z" })} />);
    const before = expectMatchingAnswer().answer;
    expect(before).toContain("2026년 10월 8일");
    act(() => vi.advanceTimersByTime(60 * 1000));
    const { answer, section } = expectMatchingAnswer();
    expect(answer).toContain("2026년 10월 9일");
    expect(answer).toContain("진행 중인 주요 학사일정은 한글날");
    expect(section.querySelector('time[datetime="2026-10-08T12:00:00Z"]')).toBeInTheDocument();
    expect(within(section).getByText(getDictionary("ko").answerSummary.unknownCheckedAt, { exact: false })).toBeInTheDocument();
  });

  it("marks retained holiday data stale when its refresh fails", () => {
    queryOverrides["public-holidays"] = { data: holidaySnapshot(), isError: true };
    render(<SchedulePageClient initialDateStringDot="2026.10.09" initialNowIso="2026-10-09T03:00:00Z"
      initialSchedules={[]} />);
    expect(expectMatchingAnswer().answer).toContain(getDictionary("ko").publicHolidays.stale);
    expect(screen.getByRole("status")).toHaveTextContent(getDictionary("ko").publicHolidays.stale);
  });

  it.each([
    { label: "retained", schedules: [{ id: "exam", title: "변경 전 시험", startDate: "2026.10.09", endDate: "2026.10.09", category: "exam" as const }] },
    { label: "empty", schedules: [] },
  ])("warns in the visible answer and JSON-LD when the $label academic data refresh fails", ({ schedules }) => {
    const dictionary = getDictionary("ko");
    const checkedAt = "2026-10-08T12:34:00Z";
    queryOverrides.schedules = { data: schedules, isError: true };
    render(<SchedulePageClient initialDateStringDot="2026.10.09" initialNowIso="2026-10-09T03:00:00Z"
      initialSchedules={schedules} initialPublicHolidays={holidaySnapshot({ lastSuccessAt: checkedAt })} />);

    const { section, answer } = expectMatchingAnswer();
    expect(answer).toBe(dictionary.home.dashboard.loadFailedMessage);
    expect(answer).not.toContain("변경 전 시험");
    expect(screen.getByText(dictionary.home.dashboard.loadFailedTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: dictionary.home.dashboard.retry })).toBeInTheDocument();
    const source = within(section).getByRole("link", { name: "학사일정" }).closest("li")!;
    expect(source).toHaveTextContent(dictionary.home.dashboard.loadFailedMessage);
    expect(source).toHaveTextContent(dictionary.answerSummary.unknownCheckedAt);
    expect(section.querySelector(`time[datetime="${checkedAt}"]`)).toBeInTheDocument();
    expect(section.querySelectorAll("a")).toHaveLength(2);
    if (schedules.length) {
      expect(screen.getByRole("heading", { name: "변경 전 시험" })).toBeInTheDocument();
    }
  });
});
