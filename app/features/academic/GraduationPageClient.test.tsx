import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GraduationPageClient from "./GraduationPageClient";
import {
  createGraduationSavedState,
  GRADUATION_STORAGE_KEY,
} from "./graduation-persistence";

const savedState = createGraduationSavedState(
  {
    admissionYear: "2024",
    collegeId: "future_fusion",
    departmentId: "ff_computer",
    majorId: "cs_cs",
    admissionType: "freshman",
    majorTrack: "single",
  },
  { totalCredits: 120 },
  ["COURSE-1"],
  { chapel: "satisfied" },
  { chapel: "남은 학기 계획" },
);

function readSavedState() {
  return JSON.parse(window.localStorage.getItem(GRADUATION_STORAGE_KEY)!);
}

function renderSavedProgress(initialState = savedState) {
  window.localStorage.setItem(
    GRADUATION_STORAGE_KEY,
    JSON.stringify(initialState),
  );
  render(<GraduationPageClient />);
  return screen.getByRole("textbox", { name: /입학년도/ });
}

describe("graduation selection preserves progress", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/academic/graduation");
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
  });

  it("keeps saved records while editing and rejects an incomplete year on blur", () => {
    const year = renderSavedProgress();

    fireEvent.change(year, { target: { value: "202" } });
    expect(year).toHaveValue("202");
    expect(readSavedState()).toEqual(savedState);

    fireEvent.blur(year);
    expect(year).toHaveValue("2024");
    expect(readSavedState()).toEqual(savedState);
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("keeps course search and checklist notes labeled after typing", () => {
    renderSavedProgress();
    const courseSearch = screen.getByRole("searchbox", {
      name: "과목명 또는 이수구분 검색",
    });
    const plan = screen.getAllByRole("textbox", {
      name: /.+:\s*확인 방법이나 이수 계획을 메모하세요/,
    })[0];

    fireEvent.change(courseSearch, { target: { value: "프로그래밍" } });
    fireEvent.change(plan, { target: { value: "담당 부서에 확인" } });

    expect(courseSearch).toHaveAccessibleName("과목명 또는 이수구분 검색");
    expect(plan).toHaveAccessibleName(
      /.+:\s*확인 방법이나 이수 계획을 메모하세요/,
    );
  });

  it("restores the previous year and all records when its change is canceled", () => {
    const year = renderSavedProgress();

    fireEvent.change(year, { target: { value: "2025" } });
    expect(readSavedState()).toEqual(savedState);
    fireEvent.blur(year);

    expect(window.confirm).toHaveBeenCalledOnce();
    expect(year).toHaveValue("2024");
    expect(readSavedState()).toEqual(savedState);
  });

  it("keeps every record when the current conditions are selected again", () => {
    const year = renderSavedProgress();
    fireEvent.change(year, { target: { value: "202" } });
    fireEvent.change(year, { target: { value: "2024" } });
    fireEvent.blur(year);
    for (const name of [
      "미래융합대학",
      "컴퓨터공학부",
      "컴퓨터공학전공",
      "신입생",
      "단일전공",
    ]) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${name}`) }));
      expect(readSavedState()).toEqual(savedState);
    }
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("leaves the selected conditions unchanged when another major is canceled", () => {
    renderSavedProgress();
    fireEvent.click(screen.getByRole("button", { name: "소프트웨어전공" }));

    expect(window.confirm).toHaveBeenCalledOnce();
    expect(readSavedState()).toEqual(savedState);
  });

  it("commits a confirmed year on Enter and clears records only then", () => {
    const year = renderSavedProgress();
    vi.mocked(window.confirm).mockReturnValue(true);
    year.focus();
    fireEvent.change(year, { target: { value: "2025" } });
    expect(readSavedState()).toEqual(savedState);
    fireEvent.keyDown(year, { key: "Enter" });

    expect(window.confirm).toHaveBeenCalledOnce();
    expect(readSavedState()).toEqual({
      selection: { ...savedState.selection, admissionYear: "2025" },
      completedCredits: {},
      selectedCourseIds: [],
      checklistAnswers: {},
      plans: {},
    });
  });

  it("resets dependent selections and records only after confirming a new major", () => {
    renderSavedProgress();
    vi.mocked(window.confirm).mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "소프트웨어전공" }));

    expect(window.confirm).toHaveBeenCalledOnce();
    expect(readSavedState()).toEqual({
      selection: {
        ...savedState.selection,
        majorId: "cs_sw",
        admissionType: "",
        majorTrack: "",
      },
      completedCredits: {},
      selectedCourseIds: [],
      checklistAnswers: {},
      plans: {},
    });
  });

  it("keeps editing available when automatic storage writes fail", () => {
    window.localStorage.setItem(
      GRADUATION_STORAGE_KEY,
      JSON.stringify(savedState),
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "SecurityError");
    });

    render(<GraduationPageClient />);

    expect(screen.getByRole("textbox", { name: /입학년도/ })).toHaveValue("2024");
    expect(screen.getByText(/자동 저장할 수 없습니다/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "소프트웨어전공" }));
    expect(window.confirm).toHaveBeenCalledOnce();
  });

  it("never overwrites an unread saved record after storage restoration fails", () => {
    window.localStorage.setItem(
      GRADUATION_STORAGE_KEY,
      JSON.stringify(savedState),
    );
    const write = vi.spyOn(Storage.prototype, "setItem");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "SecurityError");
    });

    render(<GraduationPageClient />);

    expect(screen.getByText(/자동 저장할 수 없습니다/)).toBeInTheDocument();
    expect(write).not.toHaveBeenCalled();
  });

  it("preserves existing stored records when a shared progress link is invalid", () => {
    window.history.replaceState(
      null,
      "",
      "/academic/graduation#graduation-progress=invalid",
    );
    window.localStorage.setItem(
      GRADUATION_STORAGE_KEY,
      JSON.stringify(savedState),
    );
    const write = vi.spyOn(Storage.prototype, "setItem");

    render(<GraduationPageClient />);

    expect(readSavedState()).toEqual(savedState);
    expect(write).not.toHaveBeenCalled();
  });

  it("shows the 2026 nursing reference and removes the not-applicable shortcut", () => {
    renderSavedProgress({
      ...savedState,
      selection: { ...savedState.selection, admissionYear: "2026", collegeId: "nursing", departmentId: "nursing_nursing", majorId: undefined },
    });
    expect(screen.getByText(/^2026학년도 요람 기준으로 업데이트했습니다/)).toBeInTheDocument();
    expect(screen.getByText("참고 요구학점 130")).toBeInTheDocument();
    expect(screen.queryByText("참고 요구학점 150")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "해당 없음" })).not.toBeInTheDocument();
    expect(screen.getAllByText(/근거 쪽:.*56.*58/).length).toBeGreaterThan(0);
  });

  it("selects and persists the department-transfer year before showing its major credits", () => {
    renderSavedProgress({
      selection: { ...savedState.selection, admissionType: "departmentTransfer", majorTrack: "" },
      completedCredits: {}, selectedCourseIds: [], checklistAnswers: {}, plans: {},
    });
    expect(screen.queryByRole("button", { name: "단일전공" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "2학년 전과" }));
    fireEvent.click(screen.getByRole("button", { name: "단일전공" }));
    expect(screen.getByText("참고 요구학점 73")).toBeInTheDocument();
    expect(readSavedState().selection.transferYear).toBe(2);
  });
});
