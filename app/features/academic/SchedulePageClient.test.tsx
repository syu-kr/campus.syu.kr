import { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SchedulePageClient from "./SchedulePageClient";
import { LocaleProvider } from "@/app/components/LocaleProvider";
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

describe("academic schedule content and sources", () => {
  it.each(["ko", "en"] as const)("keeps calendar content and only one set of source links at the bottom in %s", (locale) => {
    const dictionary = getDictionary(locale);
    const { container } = render(<LocaleProvider locale={locale}>
      <SchedulePageClient initialDateStringDot="2026.10.09" initialNowIso="2026-10-09T03:00:00Z"
        initialSchedules={[{ id: "exam", title: "중간고사", startDate: "2026.10.09", endDate: "2026.10.10", category: "exam" }]}
        initialPublicHolidays={holidaySnapshot()} />
    </LocaleProvider>);
    const schedule = screen.getByRole("heading", { name: "중간고사" });
    const source = screen.getByRole("link", { name: dictionary.pages.academicSchedule.title });
    const holidaySource = screen.getByRole("link", { name: dictionary.publicHolidays.source });

    expect(screen.getByRole("button", { name: locale === "ko" ? /한글날/ : /Hangeul Day/ })).toBeInTheDocument();
    expect(source).toHaveAttribute("href", "https://www.syu.ac.kr/academic/major-schedule/");
    expect(holidaySource).toHaveAttribute("href", PUBLIC_HOLIDAY_SOURCE_URL);
    expect(schedule.compareDocumentPosition(source) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(schedule.compareDocumentPosition(holidaySource) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText(dictionary.pages.academicSchedule.answer.title)).not.toBeInTheDocument();
    expect(screen.queryByText(dictionary.pages.academicSchedule.answer.question)).not.toBeInTheDocument();
    expect(screen.queryByText(dictionary.answerSummary.basisLabel, { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText(dictionary.answerSummary.unknownCheckedAt, { exact: false })).not.toBeInTheDocument();
    expect(container.querySelector("time, [data-answer-text], #academic-schedule-answer-schema")).toBeNull();
  });

  it("updates calendar and list data while search leaves the selected day's schedules intact", () => {
    const props = { initialDateStringDot: "2026.10.09", initialNowIso: "2026-10-09T03:00:00Z", initialSchedules: [], initialPublicHolidays: holidaySnapshot() };
    const view = render(<SchedulePageClient {...props} />);
    expect(screen.getByRole("heading", { name: "한글날" })).toBeInTheDocument();

    queryOverrides.schedules = { data: [{ id: "exam", title: "변경된 시험", startDate: "2026.10.09", endDate: "2026.10.09", category: "exam" }] };
    queryOverrides["public-holidays"] = { data: holidaySnapshot({ lastSuccessAt: "2026-10-09T01:00:00Z", holidays: [] }) };
    view.rerender(<SchedulePageClient {...props} />);
    expect(screen.getByRole("heading", { name: "변경된 시험" })).toBeInTheDocument();
    expect(screen.queryByText("한글날")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "일정 검색..." }), { target: { value: "없는 검색어" } });
    expect(screen.queryByRole("heading", { name: "변경된 시험" })).not.toBeInTheDocument();
    expect(screen.getByText("변경된 시험")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "학사일정" })).toBeInTheDocument();
  });

  it("refreshes holiday freshness warnings as the retained snapshot ages", () => {
    render(<SchedulePageClient initialDateStringDot="2026.10.09" initialNowIso="2026-10-09T03:00:00Z"
      initialSchedules={[]} initialPublicHolidays={holidaySnapshot({ lastSuccessAt: "2026-10-06T03:00:30Z" })} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(60 * 1000));
    expect(screen.getByRole("status")).toHaveTextContent(getDictionary("ko").publicHolidays.stale);
    expect(screen.getByRole("button", { name: /공휴일: 한글날/ })).toBeInTheDocument();
  });

  it("marks retained holiday data stale when its refresh fails", () => {
    queryOverrides["public-holidays"] = { data: holidaySnapshot(), isError: true };
    render(<SchedulePageClient initialDateStringDot="2026.10.09" initialNowIso="2026-10-09T03:00:00Z"
      initialSchedules={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent(getDictionary("ko").publicHolidays.stale);
    expect(screen.getByRole("button", { name: /공휴일: 한글날/ })).toBeInTheDocument();
  });

  it.each([
    { label: "retained", schedules: [{ id: "exam", title: "변경 전 시험", startDate: "2026.10.09", endDate: "2026.10.09", category: "exam" as const }] },
    { label: "empty", schedules: [] },
  ])("keeps an error and retry when the $label academic data refresh fails", ({ schedules }) => {
    const dictionary = getDictionary("ko");
    const checkedAt = "2026-10-08T12:34:00Z";
    queryOverrides.schedules = { data: schedules, isError: true };
    render(<SchedulePageClient initialDateStringDot="2026.10.09" initialNowIso="2026-10-09T03:00:00Z"
      initialSchedules={schedules} initialPublicHolidays={holidaySnapshot({ lastSuccessAt: checkedAt })} />);

    expect(screen.getByText(dictionary.home.dashboard.loadFailedTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: dictionary.home.dashboard.retry })).toBeInTheDocument();
    const source = screen.getByRole("link", { name: "학사일정" }).closest("li")!;
    expect(source).toHaveTextContent(dictionary.home.dashboard.loadFailedMessage);
    expect(source).not.toHaveTextContent(dictionary.answerSummary.unknownCheckedAt);
    expect(screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("https://"))).toHaveLength(2);
    if (schedules.length) {
      expect(screen.getByRole("heading", { name: "변경 전 시험" })).toBeInTheDocument();
    }
  });
});

it("uses fixed English holiday names in list and calendar labels without changing Korean search matching", () => {
  const text = getDictionary("en").pages.academicSchedule;
  render(<LocaleProvider locale="en"><SchedulePageClient initialDateStringDot="2026.10.09" initialNowIso="2026-10-09T03:00:00Z" initialSchedules={[]} initialPublicHolidays={holidaySnapshot({ holidays: [
    { date: "2026-10-09", names: ["한글날"] }, { date: "2026-10-10", names: ["대체공휴일(한글날)"] },
    { date: "2026-01-01", names: ["1월1일"] }, { date: "2026-02-17", names: ["설날"] }, { date: "2026-03-01", names: ["삼일절"] },
  ] })} /></LocaleProvider>);
  expect(screen.getByRole("heading", { name: "New Year's Day" })).toBeInTheDocument();expect(screen.getByRole("heading", { name: "Seollal" })).toBeInTheDocument();expect(screen.getByRole("heading", { name: "Independence Movement Day" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Public holiday: Hangeul Day/ })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Substitute holiday (Hangeul Day)" })).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: text.searchPlaceholder }), { target: { value: "대체공휴일" } });
  expect(screen.getByRole("heading", { name: "Substitute holiday (Hangeul Day)" })).toBeInTheDocument();expect(screen.queryByRole("heading", { name: "Seollal" })).not.toBeInTheDocument();
});

describe.each(["ko", "en"] as const)("current month schedule access in %s", (locale) => {
  it("links to the actual current month without changing chronological history or search results", () => {
    const dictionary = getDictionary(locale);
    const text = dictionary.pages.academicSchedule;
    render(
      <LocaleProvider locale={locale}>
        <SchedulePageClient initialDateStringDot="2026.10.09" initialNowIso="2026-10-09T03:00:00Z"
          initialPublicHolidays={holidaySnapshot({ holidays: [] })} initialSchedules={[
            { id: "past", title: "지난 일정", startDate: "2026.01.05", endDate: "2026.01.05", category: "event" },
            { id: "current", title: "이번 달 일정", startDate: "2026.10.20", endDate: "2026.10.20", category: "event" },
            { id: "future", title: "다가오는 일정", startDate: "2026.12.20", endDate: "2026.12.20", category: "event" },
          ]} />
      </LocaleProvider>,
    );

    const link = screen.getByRole("link", { name: text.currentMonthSchedules });
    expect(link).toHaveAttribute("href", "#schedule-month-2026-10");
    const target = screen.getByRole("heading", { level: 2, name: "2026.10" });
    expect(target.id).toBe(link.getAttribute("href")!.slice(1));
    expect(target).toHaveAttribute("tabindex", "-1");
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent).filter((label) => /^\d{4}\.\d{2}$/.test(label ?? "")))
      .toEqual(["2026.01", "2026.10", "2026.12"]);
    fireEvent.click(screen.getByRole("button", { name: text.nextMonth }));
    expect(link).toHaveAttribute("href", "#schedule-month-2026-10");

    fireEvent.change(screen.getByRole("textbox", { name: text.searchPlaceholder }), { target: { value: "다가오는" } });
    expect(screen.queryByRole("link", { name: text.currentMonthSchedules })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "다가오는 일정" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: text.resetSearch }));
    expect(screen.getByRole("link", { name: text.currentMonthSchedules })).toHaveAttribute("href", "#schedule-month-2026-10");
  });

  it("does not offer a jump when the current month has no schedule group", () => {
    const dictionary = getDictionary(locale);
    render(
      <LocaleProvider locale={locale}>
        <SchedulePageClient initialDateStringDot="2026.10.09" initialNowIso="2026-10-09T03:00:00Z"
          initialPublicHolidays={holidaySnapshot({ holidays: [] })} initialSchedules={[
            { id: "past", title: "지난 일정", startDate: "2026.01.05", endDate: "2026.01.05", category: "event" },
          ]} />
      </LocaleProvider>,
    );
    expect(screen.queryByRole("link", { name: dictionary.pages.academicSchedule.currentMonthSchedules })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "지난 일정" })).toBeInTheDocument();
  });
});
