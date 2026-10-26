import { bundledGraduationReference } from "@/lib/graduation";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientLocaleProvider } from "@/app/components/LocaleContext";
import { getDictionary } from "@/lib/i18n";
import GraduationPageClient from "./GraduationPageClient";
import publicReference from "@/public/data/graduation-requirements-2026.json";
import publicRules from "@/public/data/graduation-department-rules.json";
import publicSources from "@/public/data/graduation-sources.json";
import publicCurriculum from "@/public/data/curriculum-courses-2026-verified.json";
import publicSelectionRules from "@/public/data/curriculum-course-selection-rules-2026.json";
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
  render(<GraduationPageClient snapshot={bundledGraduationReference} />);
  return screen.getByRole("textbox", { name: /입학년도/ });
}

describe("graduation selection preserves progress", () => {
  afterEach(() => vi.unstubAllGlobals());

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

  it("starts with the next available condition and keeps pending steps compact without dropping their guidance", () => {
    render(<GraduationPageClient snapshot={bundledGraduationReference} />);
    expect(screen.getByText("입학년도를 먼저 선택하세요.")).toBeVisible();
    expect(screen.queryByText("대학을 먼저 선택하세요.")).not.toBeInTheDocument();
    const pending = screen.getByText("3. 학점 입력").closest("details")!;
    expect(pending).not.toHaveAttribute("open");
    expect(screen.getByText("내 조건을 모두 선택하면 입력할 학점 항목이 표시됩니다.")).not.toBeVisible();
    pending.open = true;
    expect(screen.getByText("내 조건을 모두 선택하면 입력할 학점 항목이 표시됩니다.")).toBeVisible();

    const year = screen.getByRole("textbox", { name: /입학년도/ });
    fireEvent.change(year, { target: { value: "2024" } });
    fireEvent.blur(year);
    expect(screen.getByRole("button", { name: "미래융합대학" })).toBeVisible();
    expect(screen.getByText("대학을 먼저 선택하세요.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "미래융합대학" }));
    expect(screen.getByRole("button", { name: /^컴퓨터공학부/ })).toBeVisible();
  });

  it("translates only published reference paths while preserving private progress", async () => {
    const fetch = vi.fn(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      const results = body.requests.map((request: { source: { id: string }; fields: string[] }) => {
        const read = (field: string) => {
          if (request.source.id === "2026") return field.split(".").reduce<unknown>((value, part) => (value as Record<string, unknown>)[part], publicReference);
          const [section, id, key] = field.split(".");
          const rows = request.source.id === "curriculum-2026" ? publicCurriculum.courses : section === "rules" ? publicRules.rules : section === "sources" ? publicSources.sources : publicSelectionRules.exclusiveGroups;
          return (rows.find(item => item.id === id) as unknown as Record<string, unknown>)?.[key];
        };
        return { ok: true, result: { target: "en", provider: "google", originals: Object.fromEntries(request.fields.map(field => [field, read(field)])), translations: Object.fromEntries(request.fields.map(field => [field, `English ${field}`])) } };
      });
      return { ok: true, json: async () => ({ results }) };
    });
    vi.stubGlobal("fetch", fetch);
    const dictionary = getDictionary("en");
    localStorage.setItem(GRADUATION_STORAGE_KEY, JSON.stringify(savedState));
    render(<ClientLocaleProvider locale="en" dictionary={dictionary}><GraduationPageClient snapshot={bundledGraduationReference} /></ClientLocaleProvider>);
    const original = localStorage.getItem(GRADUATION_STORAGE_KEY);
    expect(screen.getByRole("button", { name: "미래융합대학" }).querySelector("span")).toHaveAttribute("lang", "ko");
    expect(await screen.findByRole("button", { name: "English colleges.4.name" })).toBeInTheDocument();
    const requests = fetch.mock.calls.flatMap(([, init]) => JSON.parse(init.body as string).requests);
    const request = requests.find(item => item.source.id === "2026" && item.fields.includes("metadata.sourceTitle"));
    expect(request.source).toEqual({ kind: "graduation", id: "2026" });
    expect(request.fields.length).toBeLessThanOrEqual(40);
    expect(request.fields).toContain("metadata.sourceTitle");
    expect(request.fields.some((field: string) => /requirementProfiles\.\d+\.graduationConditions\.\d+/.test(field))).toBe(true);
    expect(JSON.stringify(requests)).not.toContain("COURSE-1");
    expect(JSON.stringify(requests)).not.toContain("남은 학기 계획");
    expect(JSON.stringify(requests)).not.toContain("completedCredits");
    expect(document.querySelector(".m3-content-translation")).toBeNull();
    expect(localStorage.getItem(GRADUATION_STORAGE_KEY)).toBe(original);
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

  it("offers nonblocking mobile guidance and preserves progress when dismissed", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    const year = renderSavedProgress();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const guidance = screen.getByText("모바일 이용 안내").closest("details")!;
    expect(guidance).not.toHaveAttribute("open");
    guidance.open = true;
    fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }));
    expect(screen.queryByText("모바일 이용 안내")).not.toBeInTheDocument();
    expect(year).toHaveFocus();
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

  it.each(["ko", "en"] as const)("labels and selects the fallback share link after clipboard failure in %s", async (locale) => {
    const writeText = vi.fn().mockRejectedValue(new Error("Clipboard denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const dictionary = getDictionary(locale);
    window.history.replaceState(null, "", `${locale === "en" ? "/en" : ""}/academic/graduation`);
    window.localStorage.setItem(GRADUATION_STORAGE_KEY, JSON.stringify(savedState));
    render(
      <ClientLocaleProvider locale={locale} dictionary={dictionary}>
        <GraduationPageClient snapshot={bundledGraduationReference} />
      </ClientLocaleProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: dictionary.pages.graduation.sidebar.shareProgress }));
    const input = await screen.findByRole("textbox", { name: dictionary.pages.graduation.sidebar.shareProgress }) as HTMLInputElement;
    expect(input).toHaveAttribute("readonly");
    expect(input.value).toBe(writeText.mock.calls[0][0]);
    expect(input.value).toContain("#graduation-progress=");
    input.focus();
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
    expect(readSavedState()).toEqual(savedState);
  });

  it("restores the previous year and all records when its change is canceled", () => {
    const year = renderSavedProgress();

    fireEvent.change(year, { target: { value: "2025" } });
    expect(readSavedState()).toEqual(savedState);
    fireEvent.blur(year);

    expect(screen.getByRole("dialog", { name: "입력한 이수 현황을 초기화할까요?" })).toBeInTheDocument();
    expect(readSavedState()).toEqual(savedState);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(year).toHaveValue("2024");
    expect(year).toHaveFocus();
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
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cancels a full reset with Escape and clears progress only after approval", () => {
    const year = renderSavedProgress();
    const reset = screen.getByRole("button", { name: getDictionary("ko").pages.graduation.sidebar.reset });
    reset.focus();
    fireEvent.click(reset);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(reset).toHaveFocus();
    expect(readSavedState()).toEqual(savedState);
    fireEvent.click(reset);
    fireEvent.click(screen.getByRole("button", { name: "초기화하고 변경" }));
    expect(year).toHaveValue("");
    expect(readSavedState().completedCredits).toEqual({});
    expect(readSavedState().selectedCourseIds).toEqual([]);
    expect(readSavedState().checklistAnswers).toEqual({});
    expect(readSavedState().plans).toEqual({});
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("leaves the selected conditions unchanged when another major is canceled", () => {
    renderSavedProgress();
    const trigger = screen.getByRole("button", { name: "소프트웨어전공" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog", { name: "입력한 이수 현황을 초기화할까요?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(trigger).toHaveFocus();
    expect(readSavedState()).toEqual(savedState);
  });

  it("commits a confirmed year on Enter and clears records only then", () => {
    const year = renderSavedProgress();
    year.focus();
    fireEvent.change(year, { target: { value: "2025" } });
    expect(readSavedState()).toEqual(savedState);
    fireEvent.keyDown(year, { key: "Enter" });

    expect(readSavedState()).toEqual(savedState);
    fireEvent.click(screen.getByRole("button", { name: "초기화하고 변경" }));
    expect(year).toHaveValue("2025");
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
    fireEvent.click(screen.getByRole("button", { name: "소프트웨어전공" }));

    expect(readSavedState()).toEqual(savedState);
    fireEvent.click(screen.getByRole("button", { name: "초기화하고 변경" }));
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

    render(<GraduationPageClient snapshot={bundledGraduationReference} />);

    expect(screen.getByRole("textbox", { name: /입학년도/ })).toHaveValue("2024");
    expect(screen.getByText(/자동 저장할 수 없습니다/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "소프트웨어전공" }));
    expect(screen.getByRole("dialog", { name: "입력한 이수 현황을 초기화할까요?" })).toBeInTheDocument();
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

    render(<GraduationPageClient snapshot={bundledGraduationReference} />);

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

    render(<GraduationPageClient snapshot={bundledGraduationReference} />);

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
