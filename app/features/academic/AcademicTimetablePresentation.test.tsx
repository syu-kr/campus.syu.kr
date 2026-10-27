import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { LectureTimetableCourse } from "@/lib/lecture-timetable";
import { AcademicTimetablePresentation, getAcademicAgendaRows } from "./AcademicTimetablePresentation";

const courses: LectureTimetableCourse[] = [
  { id: "monday", courseName: "월요일 강의", normalizedName: "월요일 강의", credits: 3, professor: "담당 교수", place: "101호", timeSlots: [{ day: "월", startPeriod: 3, endPeriod: 4 }] },
  { id: "sunday", courseName: "일요일 강의", normalizedName: "일요일 강의", credits: 2, note: "원본 강의 비고", timeSlots: [{ day: "일", startPeriod: 11, endPeriod: 12 }] },
  { id: "unknown", courseName: "시간 미정 강의", normalizedName: "시간 미정 강의", credits: null, timeSlots: [] },
];

const props = {
  contextLabel: "시간표 1",
  selectedCourses: courses,
  conflictCourseIds: new Set(["sunday"]),
  dayLabel: (day: string) => day,
  periodLabel: (period: number) => `${period}교시`,
  periodTimeLabel: (period: number) => `${period + 8}:00-${period + 8}:50`,
  completionLabel: (value: string) => value,
  renderWeek: () => <div>주간 격자</div>,
};

describe("responsive academic timetable", () => {
  it("server-renders both selected-course views without reading the viewport", () => {
    const matchMedia = vi.fn(() => { throw new Error("Viewport access during SSR"); });
    vi.stubGlobal("matchMedia", matchMedia);
    try {
      const html = renderToString(<AcademicTimetablePresentation {...props} />);
      expect(html).toContain("m3-academic-weekly");
      expect(html).toContain("m3-academic-agenda");
      expect(html).toContain('data-mobile-view="day"');
      expect(matchMedia).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("retains every selected day and time-missing course in print while switching the visible day", () => {
    const { container } = render(<AcademicTimetablePresentation {...props} />);
    const agenda = container.querySelector(".m3-academic-agenda") as HTMLElement;
    const print = container.querySelector(".m3-academic-print-surface") as HTMLElement;
    fireEvent.click(within(agenda).getByRole("button", { name: "일요일" }));
    expect(within(agenda).getByRole("button", { name: "일요일 강의 상세 보기" })).toBeInTheDocument();
    expect(within(agenda).queryByRole("button", { name: "월요일 강의 상세 보기" })).not.toBeInTheDocument();
    expect(within(print).getByText(/월요일 강의/)).toBeInTheDocument();
    expect(within(print).getByText(/일요일 강의/)).toBeInTheDocument();
    expect(within(print).getByText("시간 미정 강의")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "주간표" }));
    expect(container.querySelector(".m3-academic-responsive")).toHaveAttribute("data-mobile-view", "week");
    expect(within(print).getByText(/일요일 강의/)).toBeInTheDocument();
  });

  it("opens complete original course details and returns focus when closed", () => {
    const { container } = render(<AcademicTimetablePresentation {...props} />);
    const agenda = container.querySelector(".m3-academic-agenda") as HTMLElement;
    fireEvent.click(within(agenda).getByRole("button", { name: "일요일" }));
    const trigger = within(agenda).getByRole("button", { name: "일요일 강의 상세 보기" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "일요일 강의" });
    expect(within(dialog).getByText("원본 강의 비고")).toBeInTheDocument();
    expect(within(dialog).getByText(/11교시–12교시/)).toBeInTheDocument();
    expect(within(dialog).getByText("시간 충돌 강의")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("sorts each original meeting without dropping multiple slots", () => {
    const extra: LectureTimetableCourse = { ...courses[0], id: "multi", timeSlots: [
      { day: "월", startPeriod: 8, endPeriod: 9 },
      { day: "월", startPeriod: 1, endPeriod: 2 },
    ] };
    expect(getAcademicAgendaRows([...courses, extra], "월").map(({ slot }) => slot.startPeriod)).toEqual([1, 3, 8]);
  });
});
