import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TimetableBuilderClient } from "./TimetableBuilderClient";

const responses = vi.hoisted(() => ({
  search: "",
  timetable: {} as Record<string, unknown>,
  share: {} as Record<string, unknown>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/academic/timetable",
  useSearchParams: () => new URLSearchParams(responses.search),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    data: queryKey[0] === "lecture-timetable" ? responses.timetable : responses.share,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

describe("timetable recovery and mobile editing", () => {
  beforeEach(() => {
    localStorage.clear();
    responses.search = "";
    responses.share = { success: false };
    responses.timetable = {
      success: true,
      data: {
        year: "2026", semester: "2", updatedAt: "2026-09-10",
        courses: [{ id: "same-id", courseName: "테스트 시간 미정 강의", normalizedName: "테스트 시간 미정 강의", credits: 3, timeSlots: [] }],
      },
    };
  });

  it("keeps the search input focused while typing multiple characters", () => {
    render(<TimetableBuilderClient />);
    fireEvent.click(screen.getAllByRole("button", { name: "강의 추가" }).at(-1)!);
    const input = screen.getByRole("dialog").querySelector<HTMLInputElement>('input[type="search"]')!;
    input.focus();
    fireEvent.change(input, { target: { value: "테" } });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "테스트" } });
    expect(input).toHaveFocus();
    expect(input).toHaveValue("테스트");
  });

  it("does not map a previous semester's shared course ID to the current course", () => {
    responses.search = "share=previous";
    responses.share = { success: true, data: { year: "2026", semester: "1", courseIds: ["same-id"] } };
    render(<TimetableBuilderClient />);
    expect(screen.getByText(/학기가 현재 강의 정보와 다르거나/)).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: "삭제" })).toHaveLength(0);
  });

  it("reports missing courses and allows removing a restored time-missing course", () => {
    responses.search = "share=current";
    responses.share = { success: true, data: { year: "2026", semester: "2", courseIds: ["same-id", "missing"] } };
    render(<TimetableBuilderClient />);
    expect(screen.getByText(/현재 강의 정보에 없는 1개 과목/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "삭제" })[0]);
    expect(screen.queryAllByRole("button", { name: "삭제" })).toHaveLength(0);
  });

  it("shows the age and recovery action for an upstream fallback snapshot", () => {
    responses.timetable.stale = true;
    responses.timetable.timestamp = "2026-10-01T00:00:00Z";
    render(<TimetableBuilderClient />);
    expect(screen.getByText(/마지막 정상 저장본을 표시/)).toBeInTheDocument();
    expect(screen.getByText(/마지막 정상 조회:/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 불러오기" })).toBeInTheDocument();
  });

  it("retries a rejected share after the current semester data recovers", () => {
    responses.search = "share=current";
    responses.share = { success: true, data: { year: "2026", semester: "2", courseIds: ["same-id"] } };
    responses.timetable = { ...responses.timetable, data: { ...(responses.timetable.data as object), semester: "1" } };
    const view = render(<TimetableBuilderClient />);
    expect(screen.queryAllByRole("button", { name: "삭제" })).toHaveLength(0);
    responses.timetable = { ...responses.timetable, data: { ...(responses.timetable.data as object), semester: "2" } };
    view.rerender(<TimetableBuilderClient />);
    expect(screen.getAllByRole("button", { name: "삭제" }).length).toBeGreaterThan(0);
    expect(screen.getByText("공유 시간표를 불러왔습니다.")).toBeInTheDocument();
  });
});
