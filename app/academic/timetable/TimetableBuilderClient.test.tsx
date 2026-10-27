import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimetableBuilderClient } from "./TimetableBuilderClient";
import { LocaleProvider } from "@/app/components/LocaleProvider";
import { getDictionary } from "@/lib/i18n";
import { TIMETABLE_DRAFT_STORAGE_KEY } from "@/lib/timetable-draft";

const responses = vi.hoisted(() => ({
  search: "",
  timetable: {} as Record<string, unknown>,
  share: {} as Record<string, unknown>,
  loading: false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/academic/timetable",
  useSearchParams: () => new URLSearchParams(responses.search),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    data: queryKey[0] === "lecture-timetable" ? responses.timetable : responses.share,
    isLoading: queryKey[0] === "lecture-timetable" && responses.loading,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

let viewportWidth = 390;
const mediaListeners = new Set<() => void>();

function resizeViewport(width: number) {
  viewportWidth = width;
  act(() => mediaListeners.forEach((listener) => listener()));
}

function setManyCourses() {
  responses.timetable = {
    success: true,
    data: {
      year: "2026", semester: "2",
      courses: Array.from({ length: 320 }, (_, index) => ({
        id: `course-${index}`,
        courseName: `테스트 강의 ${index}`,
        normalizedName: `테스트 강의 ${index}`,
        credits: 3,
        timeSlots: [],
      })),
    },
  };
}

describe("timetable recovery and mobile editing", () => {
  beforeEach(() => {
    viewportWidth = 390;
    mediaListeners.clear();
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: viewportWidth >= Number(query.match(/\d+/)![0]),
      addEventListener: (_event: string, listener: () => void) => mediaListeners.add(listener),
      removeEventListener: (_event: string, listener: () => void) => mediaListeners.delete(listener),
    }));
    localStorage.clear();
    responses.search = "";
    responses.loading = false;
    responses.share = { success: false };
    responses.timetable = {
      success: true,
      data: {
        year: "2026", semester: "2", updatedAt: "2026-09-10",
        courses: [{ id: "same-id", courseName: "테스트 시간 미정 강의", normalizedName: "테스트 시간 미정 강의", credits: 3, timeSlots: [] }],
      },
    };
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each(["ko", "en"] as const)("announces loading instead of leaving an unexplained empty surface in %s", (locale) => {
    responses.loading = true;
    responses.timetable = { success: true, data: { courses: [] } };
    render(<LocaleProvider locale={locale}><TimetableBuilderClient /></LocaleProvider>);
    const status = screen.getByText(getDictionary(locale).errorBoundary.loading).closest('[role="status"]');
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it.each(["ko", "en"] as const)("distinguishes empty results and server failures without raw diagnostics in %s", (locale) => {
    const text = getDictionary(locale).pages.timetable;
    responses.timetable = { success: false, error: "Internal provider traceback", data: { courses: [] } };
    const view = render(<LocaleProvider locale={locale}><TimetableBuilderClient /></LocaleProvider>);
    expect(screen.getByText(text.loadFailedMessage)).toBeInTheDocument();
    expect(screen.queryByText("Internal provider traceback")).not.toBeInTheDocument();
    responses.timetable = { success: true, data: { year: "2026", semester: "2", courses: [] } };
    view.rerender(<LocaleProvider locale={locale}><TimetableBuilderClient /></LocaleProvider>);
    expect(screen.getByText(text.emptyCoursesTitle)).toBeInTheDocument();
    expect(screen.queryByText(text.loadFailedTitle)).not.toBeInTheDocument();
  });

  it.each(["ko", "en"] as const)("uses localized share recovery copy in %s", (locale) => {
    responses.search = "share=test-share";
    responses.share = { success: false, error: "Internal share diagnostic" };
    const text = getDictionary(locale).pages.timetable;
    render(<LocaleProvider locale={locale}><TimetableBuilderClient /></LocaleProvider>);
    expect(screen.getByText(text.shareLoadFailed)).toBeInTheDocument();
    expect(screen.queryByText("Internal share diagnostic")).not.toBeInTheDocument();
  });

  it("automatically replaces public course fields inline without changing the draft", async () => {
    const fetch = vi.fn(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      return { ok: true, json: async () => ({ results: body.requests.map((request: { fields: string[] }) => ({ ok: true, result: { target: "en", provider: "google", originals: { courseName: "테스트 시간 미정 강의" }, translations: Object.fromEntries(request.fields.map(field => [field, "English course"])) } })) }) };
    });
    vi.stubGlobal("fetch", fetch);
    render(<LocaleProvider locale="en"><TimetableBuilderClient /></LocaleProvider>);
    fireEvent.click(screen.getAllByRole("button", { name: getDictionary("en").pages.timetable.addCourse }).at(-1)!);
    const originalDraft = localStorage.getItem(TIMETABLE_DRAFT_STORAGE_KEY);
    const article = screen.getByRole("article");
    expect(await within(article).findByText("English course")).toBeInTheDocument();
    expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual({ requests: [{ source: { kind: "course", id: "same-id" }, fields: ["courseName"], target: "en" }] });
    expect(within(article).getByRole("heading", { name: "English course" })).toBeInTheDocument();
    expect(within(article).queryByRole("heading", { name: "테스트 시간 미정 강의" })).not.toBeInTheDocument();
    expect(article.querySelector(".m3-content-translation")).toBeNull();
    expect(localStorage.getItem(TIMETABLE_DRAFT_STORAGE_KEY)).toBe(originalDraft);
  });

  it("translates department option labels while retaining their raw filter values", async () => {
    const department = "컴퓨터공학부";
    responses.timetable = { success: true, data: { courses: [{ id: "department-fixture", courseName: "Public course", normalizedName: "Public course", departmentName: department, professor: "교수 이름", grade: 0, credits: 3, timeSlots: [] }] } };
    const fetch = vi.fn(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      return { ok: true, json: async () => ({ results: body.requests.map((request: { fields: string[] }) => ({ ok: true, result: { target: "en", provider: "google", originals: Object.fromEntries(request.fields.map(field => [field, department])), translations: Object.fromEntries(request.fields.map(field => [field, "Computer Science"])) } })) }) };
    });vi.stubGlobal("fetch", fetch);
    render(<LocaleProvider locale="en"><TimetableBuilderClient /></LocaleProvider>);
    fireEvent.click(screen.getAllByRole("button", { name: getDictionary("en").pages.timetable.addCourse }).at(-1)!);
    const dialog = screen.getByRole("dialog"), combo = within(dialog).getByRole("combobox", { name: getDictionary("en").pages.timetable.department });
    await within(dialog).findByText("Computer Science");fireEvent.click(combo);
    expect(within(dialog).getByRole("heading", { name: "Public course" }).nextElementSibling).not.toHaveTextContent("0");
    const option = await screen.findByRole("option", { name: "Computer Science" });fireEvent.pointerDown(option);fireEvent.click(option);
    expect(combo).toHaveAttribute("data-value", department);
    const requests = fetch.mock.calls.flatMap(([, init]) => JSON.parse(String(init.body)).requests);
    expect(requests.some(request => request.source.id === "__departments__" && request.fields.includes("departments.0"))).toBe(true);
    expect(JSON.stringify(requests)).not.toContain("교수 이름");
    expect(requests.every(request => !request.fields.includes("professor"))).toBe(true);
  });

  it.each([1023, 1024, 1279, 1280, 1440])("mounts only the usable course picker at %ipx", (width) => {
    viewportWidth = width;
    setManyCourses();
    render(<TimetableBuilderClient />);
    expect(screen.queryAllByRole("article")).toHaveLength(width < 1024 ? 0 : 300);
    expect(screen.queryAllByRole("searchbox")).toHaveLength(width < 1024 ? 0 : 1);
  });

  it("formats public semester and source-date metadata in English while retaining the raw dataset", () => {
    const data = { year: "2026", semester: "2학기 정규", updatedAt: "'26.09.10.(목)", courses: [] };
    responses.timetable = { success: true, data };
    render(<LocaleProvider locale="en"><TimetableBuilderClient /></LocaleProvider>);
    expect(screen.getAllByText("Based on 2026 Semester 2 (regular) timetable data.").length).toBeGreaterThan(0);
    expect(screen.getByText("Course source updated: Sep 10, 2026")).toBeInTheDocument();
    expect(data.semester).toBe("2학기 정규");expect(data.updatedAt).toBe("'26.09.10.(목)");
  });

  it("mounts mobile results only while the sheet is open and keeps detailed filters collapsed", () => {
    setManyCourses();
    render(<TimetableBuilderClient />);
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    fireEvent.click(screen.getAllByRole("button", { name: "강의 추가" }).at(-1)!);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("article")).toHaveLength(300);
    const filters = dialog.querySelector("details")!;
    expect(filters).not.toHaveAttribute("open");
    expect(within(dialog).getByRole("searchbox")).toBeInTheDocument();
    const department = within(dialog).getByRole("combobox", { name: "학과" });
    expect(department).toHaveTextContent("전체 학과");
    expect(department.closest("details")).toBeNull();
    filters.open = true;
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "월" }));
    expect(filters).toHaveAttribute("open");
    expect(within(dialog).getByRole("checkbox", { name: "월" })).toBeChecked();
    fireEvent.click(within(dialog).getByRole("button", { name: "모달 닫기" }));
    expect(screen.queryAllByRole("article")).toHaveLength(0);
  });

  it("keeps search and selected courses when the picker moves between layouts", () => {
    viewportWidth = 1024;
    setManyCourses();
    render(<TimetableBuilderClient />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "강의 29" } });
    const selectedCard = screen.getByRole("heading", { name: "테스트 강의 29" }).closest("article")!;
    fireEvent.click(within(selectedCard).getByRole("button", { name: "추가" }));

    for (const width of [1280, 390, 1279, 1440]) {
      resizeViewport(width);
      if (width < 1024) {
        expect(screen.queryAllByRole("article")).toHaveLength(0);
        fireEvent.click(screen.getAllByRole("button", { name: "강의 추가" }).at(-1)!);
      }
      expect(screen.getByRole("searchbox")).toHaveValue("강의 29");
      expect(screen.getAllByRole("article")).toHaveLength(11);
      const card = screen.getByRole("heading", { name: "테스트 강의 29" }).closest("article")!;
      expect(within(card).getByRole("button", { name: "삭제" })).toBeInTheDocument();
      if (width >= 1024) expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    }
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("hydrates the server layout before mounting the desktop picker", async () => {
    viewportWidth = 1440;
    const container = document.createElement("div");
    container.innerHTML = renderToString(<TimetableBuilderClient />);
    document.body.append(container);
    expect(container.querySelector('input[type="search"]')).toBeNull();
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, <TimetableBuilderClient />, { onRecoverableError });
    });
    expect(container.querySelectorAll('input[type="search"]')).toHaveLength(1);
    expect(onRecoverableError).not.toHaveBeenCalled();
    act(() => root.unmount());
    container.remove();
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

  it("compares up to four plans on mobile and keeps courses in their chosen plan", () => {
    const { container } = render(<TimetableBuilderClient />);
    fireEvent.click(screen.getAllByRole("button", { name: "여러 시간표로" })[0]);
    expect(container.querySelectorAll(".m3-timetable-comparison-card")).toHaveLength(2);
    const addPlan = screen.getByRole("button", { name: "시간표 추가" });
    fireEvent.click(addPlan);
    fireEvent.click(addPlan);
    expect(container.querySelectorAll(".m3-timetable-comparison-card")).toHaveLength(4);
    expect(addPlan).toBeDisabled();
    const thirdPlan = container.querySelectorAll<HTMLElement>(".m3-timetable-comparison-card")[2];
    fireEvent.click(within(thirdPlan).getByRole("button", { name: "선택" }));
    fireEvent.click(screen.getAllByRole("button", { name: "강의 추가" }).at(-1)!);
    const picker = screen.getByRole("dialog");
    fireEvent.click(within(picker).getByRole("button", { name: "추가" }));
    expect(within(picker).getByRole("button", { name: "삭제" })).toBeInTheDocument();
    fireEvent.click(within(picker).getByRole("button", { name: "시간표 보기" }));
    const plans = container.querySelectorAll<HTMLElement>(".m3-timetable-comparison-card");
    expect(plans[0].querySelector(".m3-academic-print-surface")).not.toHaveTextContent("테스트 시간 미정 강의");
    expect(plans[2].querySelector(".m3-academic-print-surface")).toHaveTextContent("테스트 시간 미정 강의");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([390, 1440])("preserves department options and filtering through the M3 Select at %ipx", async (width) => {
    viewportWidth = width;
    responses.timetable = { success: true, data: { year: "2026", semester: "2", courses: [
      { id: "computer", courseName: "컴퓨터 강의", normalizedName: "컴퓨터 강의", departmentName: "컴퓨터공학부", credits: 3, timeSlots: [] },
      { id: "nursing", courseName: "간호 강의", normalizedName: "간호 강의", departmentName: "간호학과", credits: 3, timeSlots: [] },
    ] } };
    render(<TimetableBuilderClient />);
    if (width < 1024) {
      fireEvent.click(screen.getAllByRole("button", { name: "강의 추가" }).at(-1)!);
      screen.getByRole("dialog").querySelector("details")!.open = true;
    }
    fireEvent.click(screen.getByRole("combobox", { name: "학과" }));
    const computer = await screen.findByRole("option", { name: "컴퓨터공학부" });
    expect(screen.getByRole("option", { name: "간호학과" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "전체 학과" })).toBeInTheDocument();
    fireEvent.pointerDown(computer);
    fireEvent.click(computer);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "컴퓨터 강의" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "초기화" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
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
    expect(screen.getByText(getDictionary("ko").pages.timetable.staleDataNotice)).toBeInTheDocument();
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
