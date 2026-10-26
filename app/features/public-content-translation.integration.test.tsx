import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ClientLocaleProvider } from "@/app/components/LocaleContext";
import { getDictionary } from "@/lib/i18n";
import type { ContentTranslationSource, PublicContentFields } from "@/lib/content-translation";
import { TodayMenuCard, WeeklyMenuCard } from "./cafeteria/CafeteriaMenuCards";
import { TodaySchedulesSection } from "./home/HomeDashboardSections";
import { FacilityPanel } from "@/app/campus/map/components/FacilityPanel";
import buildings from "@/app/campus/map/data/buildings.json";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PhonePageClient from "./phone/PhonePageClient";
import { AcademicTimetablePresentation } from "./academic/AcademicTimetablePresentation";

const translationCalls = vi.hoisted(() => vi.fn());
beforeEach(() => translationCalls.mockClear());

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/campus/phone",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/app/components/ContentTranslation", () => {
  const translation = (source: ContentTranslationSource, content: PublicContentFields) => {
    if (Object.keys(content).length) translationCalls(source, content);
    return { text: (field: string, fallback: string) => field in content ? `English ${field}` : fallback, lang: "en-x-mtfrom-ko", translated: true, controls: null };
  };
  return {
    useContentTranslation: translation,
    PublicContentTranslation: ({ source, content, children }: { source: ContentTranslationSource; content: PublicContentFields; children?: ReactNode | ((value: ReturnType<typeof translation>) => ReactNode) }) => {
      const value = translation(source, content);return typeof children === "function" ? children(value) : children ?? null;
    },
  };
});

function english(children: React.ReactNode) {
  return <ClientLocaleProvider locale="en" dictionary={getDictionary("en")}>{children}</ClientLocaleProvider>;
}

function requests() {
  return translationCalls.mock.calls.map(([source, fields]) => ({ source: source as ContentTranslationSource, fields: fields as PublicContentFields }));
}

const menu = {
  id: "menu-2026-10-26", date: "2026-10-26", dayOfWeek: "월", location: "SU-Lounge",
  breakfast: [{ name: "아침 메뉴", calories: 400, allergens: ["계란"] }],
  lunch: { a: [{ name: "점심 A" }], b: [{ name: "점심 B" }] },
  dinner: [{ name: "저녁 메뉴" }],
};

describe("public content reader boundaries", () => {
  it("distinguishes duplicate department names by their source row while preserving telephone links", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(english(<QueryClientProvider client={client}><PhonePageClient initialPhoneNumbers={[
      { department: "학생처 학생복지팀", phone: "02-3399-3221", description: "첫 번째 업무" },
      { department: "학생처 학생복지팀", phone: "02-3399-3222", description: "두 번째 업무" },
    ]} /></QueryClientProvider>));
    expect(requests()).toEqual([
      { source: { kind: "phone", id: "0" }, fields: { department: "학생처 학생복지팀", description: "첫 번째 업무" } },
      { source: { kind: "phone", id: "1" }, fields: { department: "학생처 학생복지팀", description: "두 번째 업무" } },
    ]);
    expect(screen.getAllByRole("heading", { name: "English department" })).toHaveLength(2);
    expect(screen.queryByText("학생처 학생복지팀")).not.toBeInTheDocument();
    expect(view.container.querySelectorAll('a[href^="tel:"]')).toHaveLength(2);
    client.clear();
  });

  it("replaces meals and allergens inline while preserving nutrition and today navigation", () => {
    const view = render(english(<TodayMenuCard menu={menu} />));
    expect(requests()).toEqual([
      { source: { kind: "cafeteria", id: menu.id }, fields: { location: "SU-Lounge" } },
      { source: { kind: "cafeteria", id: menu.id }, fields: { "breakfast.0": "아침 메뉴", "allergens.breakfast.0.0": "계란" } },
      { source: { kind: "cafeteria", id: menu.id }, fields: { "lunch.a.0": "점심 A" } },
      { source: { kind: "cafeteria", id: menu.id }, fields: { "lunch.b.0": "점심 B" } },
      { source: { kind: "cafeteria", id: menu.id }, fields: { "dinner.0": "저녁 메뉴" } },
    ]);
    expect(screen.getByText("English breakfast.0")).toHaveAttribute("lang", "en-x-mtfrom-ko");
    expect(screen.queryByText("아침 메뉴")).not.toBeInTheDocument();
    expect(screen.getByText("400kcal")).toBeInTheDocument();
    translationCalls.mockClear();
    view.rerender(english(<WeeklyMenuCard menu={menu} isToday />));
    expect(requests()).toEqual([{ source: { kind: "cafeteria", id: menu.id }, fields: { location: "SU-Lounge" } }]);
    expect(screen.queryByRole("button", { name: /Translate/ })).not.toBeInTheDocument();
  });

  it("keeps schedule navigation as a link and excludes synthetic public holiday IDs", () => {
    const view = render(english(<TodaySchedulesSection isLoading={false} isError={false} onRetry={vi.fn()} schedules={[
      { id: "academic-1", title: "중간고사", category: "exam", startDate: "2026.10.26", endDate: "2026.10.30" },
      { id: "public-holiday-2026-10-09", title: "한글날", category: "holiday", startDate: "2026.10.09", endDate: "2026.10.09" },
    ]} />));
    expect(requests()).toEqual([
      { source: { kind: "schedule", id: "academic-1" }, fields: { title: "중간고사" } },
    ]);
    expect(screen.getByRole("link", { name: /English title/ })).toHaveAttribute("href", "/en/academic/schedule");
    expect(view.container.querySelectorAll(".m3-translated-content")).toHaveLength(0);
  });

  it("uses original building/floor indexes and replaces facility names at their existing positions", () => {
    const building = buildings.buildings.find(item => item.id === "practice-center-1")!;
    const view = render(english(<FacilityPanel buildingId={building.id} />));
    const payload = requests()[0];
    expect(payload.source).toEqual({ kind: "map", id: building.id });expect(payload.fields.name).toBe(building.name);
    const floorIndex = building.floors.findIndex(floor => floor.facilities.length === 18);
    expect(payload.fields[`floors.${floorIndex}.facilities.17.name`]).toBe(building.floors[floorIndex].facilities[17].name);
    expect(screen.getByRole("heading", { name: "English name" })).toBeVisible();
    expect(screen.getAllByText("Research").length).toBeGreaterThan(0);
    expect(screen.getByText(`English floors.${floorIndex}.facilities.17.name`)).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { expanded: true })[floorIndex]);
    expect(screen.queryByText(`English floors.${floorIndex}.facilities.17.name`)).not.toBeInTheDocument();
    expect(view.container.querySelectorAll(".m3-public-translation")).toHaveLength(0);
  });

  it("uses translated course labels in agenda and details without sending professor names or changing course IDs", () => {
    const course = { id: "public-course", courseName: "공개 강의명", normalizedName: "공개 강의명", professor: "담당 교수", place: "강의실", classTime: "월 1교시", credits: 3, timeSlots: [] };
    const view = render(english(<AcademicTimetablePresentation selectedCourses={[course]} conflictCourseIds={new Set()} dayLabel={value => value} periodLabel={String} periodTimeLabel={String} completionLabel={value => value} renderWeek={() => null} />));
    const trigger = view.container.querySelector<HTMLButtonElement>('.m3-academic-agenda [data-academic-course-id="public-course"]')!;
    expect(trigger).toHaveAccessibleName(`English courseName ${getDictionary("en").pages.timetable.presentation.details}`);fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "English courseName" })).toBeVisible();
    expect(requests().every(({ fields }) => !("professor" in fields) && !("classTime" in fields))).toBe(true);
    expect(screen.getAllByText("담당 교수").every(node => node.getAttribute("translate") === "no")).toBe(true);
  });
});
