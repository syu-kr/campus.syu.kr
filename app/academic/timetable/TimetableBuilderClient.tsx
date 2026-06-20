"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";

import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { Icon } from "@/app/components/Icon";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import { fetchJson } from "@/lib/fetch-json";
import { localizePath, type Dictionary, type Locale } from "@/lib/i18n";
import { normalizeCourseName } from "@/lib/lecture-timetable";
import type {
  LectureDay,
  LectureTimeSlot,
  LectureTimetableCourse,
  LectureTimetableDataset,
} from "@/lib/lecture-timetable";

type TimetableDictionary = Dictionary["pages"]["timetable"];

interface TimetableApiResponse {
  success: boolean;
  data: LectureTimetableDataset;
  timestamp?: string;
  error?: string;
}

interface TimetableShareResponse {
  success: boolean;
  data?: {
    shareId: string;
    courseIds: string[];
    year: string | null;
    semester: string | null;
    createdAt: string | null;
  };
  error?: string;
}

interface CreateShareResponse {
  success: boolean;
  shareId?: string;
  error?: string;
}

const DAYS: LectureDay[] = ["월", "화", "수", "목", "금"];
const PERIODS = Array.from({ length: 15 }, (_, index) => index + 1);
const MAX_VISIBLE_RESULTS = 300;
type CompletionGroupId =
  | "major"
  | "liberal"
  | "linked"
  | "teaching"
  | "chapel"
  | "general"
  | "other";

const COMPLETION_GROUPS: Array<{
  id: CompletionGroupId;
  label: string;
  types: string[];
}> = [
  { id: "major", label: "전공", types: ["전공필수", "전공선택"] },
  { id: "liberal", label: "교양", types: ["교양필수", "교양선택"] },
  { id: "linked", label: "연계", types: ["연계필수", "연계선택"] },
  { id: "teaching", label: "교직", types: ["교직필수"] },
  { id: "chapel", label: "채플", types: ["채플"] },
  { id: "general", label: "일반", types: ["일반선택"] },
  { id: "other", label: "기타", types: [] },
];

interface CompletionGroupStat {
  id: CompletionGroupId;
  label: string;
  credits: number;
  count: number;
}

interface TimetableConflictPair {
  firstCourse: LectureTimetableCourse;
  secondCourse: LectureTimetableCourse;
  slots: Array<{
    day: LectureDay;
    startPeriod: number;
    endPeriod: number;
  }>;
}

const emptyTimetableResponse: TimetableApiResponse = {
  success: false,
  data: { courses: [] },
};

const emptyShareResponse: TimetableShareResponse = {
  success: false,
};

export function TimetableBuilderClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dictionary = useDictionary();
  const locale = useLocale();
  const text = dictionary.pages.timetable;
  const shareId = searchParams.get("share")?.trim() ?? "";

  const [departmentFilter, setDepartmentFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [completionTypeFilter, setCompletionTypeFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [appliedShareId, setAppliedShareId] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [shareFallbackUrl, setShareFallbackUrl] = useState("");

  const {
    data: response = emptyTimetableResponse,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["lecture-timetable"],
    queryFn: () =>
      fetchJson<TimetableApiResponse>("/api/lecture/timetable", {
        fallback: emptyTimetableResponse,
        timeoutMs: 20_000,
      }),
    staleTime: 60 * 60 * 1000,
    gcTime: 6 * 60 * 60 * 1000,
  });

  const {
    data: shareResponse = emptyShareResponse,
    isFetching: isShareFetching,
  } = useQuery({
    queryKey: ["lecture-timetable-share", shareId],
    queryFn: () =>
      fetchJson<TimetableShareResponse>(
        `/api/lecture/timetable/shares/${encodeURIComponent(shareId)}`,
        {
          fallback: emptyShareResponse,
          timeoutMs: 12_000,
        },
      ),
    enabled: Boolean(shareId),
    staleTime: 5 * 60 * 1000,
  });

  const courses = response.data.courses;
  const courseById = useMemo(() => {
    return new Map(courses.map((course) => [course.id, course]));
  }, [courses]);

  useEffect(() => {
    if (!shareId) {
      if (appliedShareId) setAppliedShareId("");
      return;
    }

    if (
      appliedShareId !== shareId &&
      shareResponse.success &&
      shareResponse.data &&
      courseById.size > 0
    ) {
      const restoredIds = shareResponse.data.courseIds.filter((courseId) =>
        courseById.has(courseId),
      );
      setSelectedCourseIds(restoredIds);
      setAppliedShareId(shareId);
      setShareMessage(text.shareLoaded);
    }
  }, [appliedShareId, courseById, shareId, shareResponse, text.shareLoaded]);

  const selectedCourses = useMemo(
    () =>
      selectedCourseIds
        .map((courseId) => courseById.get(courseId))
        .filter((course): course is LectureTimetableCourse => Boolean(course)),
    [courseById, selectedCourseIds],
  );

  const departments = useMemo(
    () => uniqueSorted(courses.map((course) => course.departmentName)),
    [courses],
  );
  const grades = useMemo(
    () =>
      uniqueSorted(courses.map((course) => course.grade?.toString())).sort(
        (first, second) => Number(first) - Number(second),
      ),
    [courses],
  );
  const completionTypes = useMemo(
    () => uniqueSorted(courses.map((course) => course.completionType)),
    [courses],
  );

  const filteredCourses = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);

    return courses.filter((course) => {
      if (departmentFilter && course.departmentName !== departmentFilter) {
        return false;
      }

      if (gradeFilter && course.grade?.toString() !== gradeFilter) {
        return false;
      }

      if (
        completionTypeFilter &&
        course.completionType !== completionTypeFilter
      ) {
        return false;
      }

      if (!normalizedQuery) return true;

      const searchable = normalizeSearchText(
        [
          course.id,
          course.courseCode,
          course.courseName,
          course.normalizedName,
          course.professor,
        ].join(" "),
      );

      return searchable.includes(normalizedQuery);
    });
  }, [
    completionTypeFilter,
    courses,
    departmentFilter,
    gradeFilter,
    searchQuery,
  ]);

  const visibleCourses = useMemo(
    () => filteredCourses.slice(0, MAX_VISIBLE_RESULTS),
    [filteredCourses],
  );
  const courseListKey = [
    normalizeSearchText(searchQuery),
    departmentFilter,
    gradeFilter,
    completionTypeFilter,
    filteredCourses.length,
  ].join("|");
  const selectedIdSet = useMemo(
    () => new Set(selectedCourses.map((course) => course.id)),
    [selectedCourses],
  );
  const conflictSummary = useMemo(
    () => getConflictSummary(selectedCourses),
    [selectedCourses],
  );
  const completionStats = useMemo(
    () => getCompletionStats(selectedCourses),
    [selectedCourses],
  );
  const visibleCompletionStats = completionStats.filter(
    (stat) => stat.count > 0,
  );
  const totalCredits = selectedCourses.reduce(
    (total, course) => total + (course.credits ?? 0),
    0,
  );
  const unscheduledCount = selectedCourses.filter(
    (course) => course.timeSlots.length === 0,
  ).length;
  const hasCourses = courses.length > 0;
  const semesterBaseLabel = formatSemesterBaseLabel(
    response.data.year,
    response.data.semester,
    locale,
    text,
  );

  function clearShareFromUrl() {
    if (shareId) {
      router.replace(pathname, { scroll: false });
      setAppliedShareId("");
    }
  }

  function replaceSelectedCourses(nextIds: string[], options = { clearShare: true }) {
    setSelectedCourseIds(Array.from(new Set(nextIds)));
    setShareMessage("");
    setShareFallbackUrl("");
    if (options.clearShare) clearShareFromUrl();
  }

  function toggleCourse(course: LectureTimetableCourse) {
    if (selectedIdSet.has(course.id)) {
      replaceSelectedCourses(selectedCourseIds.filter((id) => id !== course.id));
      return;
    }

    replaceSelectedCourses([...selectedCourseIds, course.id]);
  }

  async function createShareLink() {
    if (selectedCourses.length === 0 || isCreatingShare) return;

    setIsCreatingShare(true);
    setShareMessage("");
    setShareFallbackUrl("");

    try {
      const share = await fetchJson<CreateShareResponse>(
        "/api/lecture/timetable/shares",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseIds: selectedCourses.map((course) => course.id),
            year: response.data.year,
            semester: response.data.semester,
          }),
          fallback: { success: false },
          timeoutMs: 12_000,
        },
      );

      if (!share.success || !share.shareId) {
        setShareMessage(share.error ?? text.shareCreateFailed);
        setShareFallbackUrl("");
        return;
      }

      const nextUrl = `${pathname}?share=${encodeURIComponent(share.shareId)}`;
      router.replace(nextUrl, { scroll: false });

      let didCopy = false;
      let absoluteUrl = "";
      if (typeof window !== "undefined") {
        absoluteUrl = `${window.location.origin}${nextUrl}`;
        if (navigator.clipboard?.writeText) {
          try {
            await navigator.clipboard.writeText(absoluteUrl);
            didCopy = true;
          } catch {
            didCopy = false;
          }
        }
      }

      setAppliedShareId(share.shareId);
      setShareMessage(
        didCopy ? text.shareCreated : text.shareCreatedCopyFailed,
      );
      setShareFallbackUrl(didCopy ? "" : absoluteUrl);
    } catch {
      setShareMessage(text.shareCreateFailed);
      setShareFallbackUrl("");
    } finally {
      setIsCreatingShare(false);
    }
  }

  function resetFilters() {
    setDepartmentFilter("");
    setGradeFilter("");
    setCompletionTypeFilter("");
    setSearchQuery("");
  }

  return (
    <Container
      size="full"
      className="min-w-0 max-w-[88rem] overflow-x-hidden py-6 sm:py-8"
    >
      <div className="mb-6">
        <Link
          href={localizePath("/academic", locale)}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          <Icon name="chevron-right" size={16} className="rotate-180" />
          {text.backToAcademic}
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="mb-2 inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
              {text.desktopHint}
            </span>
            <h1 className="mb-2 text-2xl font-bold text-neutral-900 sm:text-3xl">
              {text.title}
            </h1>
            <p className="text-sm text-neutral-600 sm:text-base">
              {semesterBaseLabel}
            </p>
          </div>
        </div>
      </div>

      <section className="sticky top-[73px] z-20 mb-5 rounded-card border border-neutral-200 bg-white/95 p-3 shadow-card backdrop-blur sm:p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <SummaryMetric
            label={text.totalCredits}
            value={formatCredits(totalCredits, text)}
          />
          <SummaryMetric
            label={text.selected}
            value={formatCount(selectedCourses.length, text.itemsUnit)}
          />
          <SummaryMetric
            label={text.unscheduled}
            value={formatCount(unscheduledCount, text.itemsUnit)}
          />
          <SummaryMetric
            label={text.conflicts}
            value={formatCount(conflictSummary.pairCount, text.casesUnit)}
            isWarning={conflictSummary.pairCount > 0}
          />
          <button
            type="button"
            onClick={createShareLink}
            disabled={selectedCourses.length === 0 || isCreatingShare}
            className="col-span-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-300 sm:col-span-1"
          >
            {isCreatingShare ? text.creatingShare : text.share}
          </button>
        </div>
        {visibleCompletionStats.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {visibleCompletionStats.map((stat) => (
              <span
                key={stat.id}
                className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-semibold text-neutral-700"
              >
                {getCompletionGroupLabel(stat.id, text)}{" "}
                {formatCredits(stat.credits, text)}/
                {formatCount(stat.count, text.coursesUnit)}
              </span>
            ))}
          </div>
        )}
        {(shareMessage || isShareFetching || (shareId && !shareResponse.success)) && (
          <p className="mt-3 text-sm font-medium text-neutral-600">
            {isShareFetching
              ? text.shareLoading
              : shareMessage ||
                shareResponse.error ||
                text.shareLoadFailed}
          </p>
        )}
        {shareFallbackUrl && (
          <input
            type="text"
            readOnly
            value={shareFallbackUrl}
            aria-label={text.shareFallbackInputLabel}
            onFocus={(event) => event.target.select()}
            className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-700"
          />
        )}
        {conflictSummary.pairs.length > 0 && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <p className="font-bold">{text.conflictSummaryTitle}</p>
            <ul className="mt-2 space-y-1.5 text-xs leading-5">
              {conflictSummary.pairs.slice(0, 3).map((pair) => (
                <li key={`${pair.firstCourse.id}-${pair.secondCourse.id}`}>
                  <span className="font-semibold">
                    {pair.firstCourse.courseName} / {pair.secondCourse.courseName}
                  </span>
                  <span className="ml-1 text-red-800">
                    {formatConflictSlots(pair.slots, text)}
                  </span>
                </li>
              ))}
            </ul>
            {conflictSummary.pairs.length > 3 && (
              <p className="mt-2 text-xs">
                {conflictSummary.pairs.length - 3} {text.conflictSummaryMore}
              </p>
            )}
          </div>
        )}
      </section>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton height="620px" />
          <Skeleton count={3} height="120px" />
        </div>
      ) : !hasCourses ? (
        <StateCard
          type={isError || !response.success ? "error" : "info"}
          title={text.loadFailedTitle}
          message={
            response.error ??
            text.loadFailedMessage
          }
          action={
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              {text.retry}
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
            <Card
              hover={false}
              className="min-w-0 overflow-hidden border border-neutral-200"
            >
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-neutral-900">
                    {text.weeklyTimetable}
                  </h2>
                  <p className="text-sm text-neutral-500">
                    {text.weeklyTimetableDescription}
                  </p>
                </div>
              </div>

              <TimetableGrid
                selectedCourses={selectedCourses}
                conflictCourseIds={conflictSummary.courseIds}
              />
            </Card>

            <SelectedCoursesPanel
              selectedCourses={selectedCourses}
              conflictCourseIds={conflictSummary.courseIds}
              completionStats={visibleCompletionStats}
              totalCredits={totalCredits}
              onClear={() => replaceSelectedCourses([])}
              onRemove={toggleCourse}
            />
          </section>

          <div className="hidden lg:block">
            <CoursePicker
              completionTypeFilter={completionTypeFilter}
              departments={departments}
              departmentFilter={departmentFilter}
              filteredCoursesCount={filteredCourses.length}
              grades={grades}
              gradeFilter={gradeFilter}
              completionTypes={completionTypes}
              onCompletionTypeFilterChange={setCompletionTypeFilter}
              onDepartmentFilterChange={setDepartmentFilter}
              onGradeFilterChange={setGradeFilter}
              onResetFilters={resetFilters}
              onSearchQueryChange={setSearchQuery}
              onToggleCourse={toggleCourse}
              searchQuery={searchQuery}
              selectedIdSet={selectedIdSet}
              visibleCourses={visibleCourses}
              conflictCourseIds={conflictSummary.courseIds}
              idPrefix="desktop"
              listKey={courseListKey}
            />
          </div>

          <button
            type="button"
            onClick={() => setIsPickerOpen(true)}
            className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-4 right-4 z-30 max-w-[calc(100vw-2rem)] rounded-lg bg-primary-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition-colors hover:bg-primary-700 lg:hidden"
          >
            {text.addCourse}
          </button>

          {isPickerOpen && (
            <MobileCoursePickerSheet onClose={() => setIsPickerOpen(false)}>
              <CoursePicker
                completionTypeFilter={completionTypeFilter}
                departments={departments}
                departmentFilter={departmentFilter}
                filteredCoursesCount={filteredCourses.length}
                grades={grades}
                gradeFilter={gradeFilter}
                completionTypes={completionTypes}
                onCompletionTypeFilterChange={setCompletionTypeFilter}
                onDepartmentFilterChange={setDepartmentFilter}
                onGradeFilterChange={setGradeFilter}
                onResetFilters={resetFilters}
                onSearchQueryChange={setSearchQuery}
                onToggleCourse={toggleCourse}
                searchQuery={searchQuery}
                selectedIdSet={selectedIdSet}
                visibleCourses={visibleCourses}
                conflictCourseIds={conflictSummary.courseIds}
                idPrefix="mobile"
                listKey={courseListKey}
              />
            </MobileCoursePickerSheet>
          )}
        </div>
      )}
    </Container>
  );
}

function SummaryMetric({
  label,
  value,
  isWarning = false,
}: {
  label: string;
  value: string;
  isWarning?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-lg border px-3 py-2",
        isWarning
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-neutral-200 bg-neutral-50 text-neutral-900",
      )}
    >
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-0.5 text-base font-bold">{value}</p>
    </div>
  );
}

function CoursePicker({
  completionTypeFilter,
  completionTypes,
  departmentFilter,
  departments,
  filteredCoursesCount,
  gradeFilter,
  grades,
  onCompletionTypeFilterChange,
  onDepartmentFilterChange,
  onGradeFilterChange,
  onResetFilters,
  onSearchQueryChange,
  onToggleCourse,
  searchQuery,
  selectedIdSet,
  visibleCourses,
  conflictCourseIds,
  idPrefix,
  listKey,
}: {
  completionTypeFilter: string;
  completionTypes: string[];
  departmentFilter: string;
  departments: string[];
  filteredCoursesCount: number;
  gradeFilter: string;
  grades: string[];
  onCompletionTypeFilterChange: (value: string) => void;
  onDepartmentFilterChange: (value: string) => void;
  onGradeFilterChange: (value: string) => void;
  onResetFilters: () => void;
  onSearchQueryChange: (value: string) => void;
  onToggleCourse: (course: LectureTimetableCourse) => void;
  searchQuery: string;
  selectedIdSet: Set<string>;
  visibleCourses: LectureTimetableCourse[];
  conflictCourseIds: Set<string>;
  idPrefix: string;
  listKey: string;
}) {
  const text = useDictionary().pages.timetable;
  const locale = useLocale();
  const numberLocale = getNumberLocale(locale);
  const searchInputId = `${idPrefix}-course-search`;

  return (
    <Card hover={false} className="border border-neutral-200">
      <div className="space-y-4">
        <div>
          <label
            htmlFor={searchInputId}
            className="mb-1 block text-sm font-semibold text-neutral-800"
          >
            {text.courseFilter}
          </label>
          <input
            id={searchInputId}
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder={text.searchPlaceholder}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-500"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <FilterSelect
            id={`${idPrefix}-department-filter`}
            label={text.department}
            value={departmentFilter}
            onChange={onDepartmentFilterChange}
            options={departments}
            allLabel={text.allDepartments}
          />
          <FilterSelect
            id={`${idPrefix}-grade-filter`}
            label={text.grade}
            value={gradeFilter}
            onChange={onGradeFilterChange}
            options={grades}
            allLabel={text.allGrades}
            getOptionLabel={(option) => formatGrade(option, text, locale)}
          />
          <FilterSelect
            id={`${idPrefix}-completion-filter`}
            label={text.completionType}
            value={completionTypeFilter}
            onChange={onCompletionTypeFilterChange}
            options={completionTypes}
            allLabel={text.allCompletionTypes}
            getOptionLabel={(option) => formatCompletionType(option, text)}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-neutral-600">
            {locale === "ko"
              ? `${filteredCoursesCount.toLocaleString(numberLocale)}${text.results}`
              : `${filteredCoursesCount.toLocaleString(numberLocale)} ${
                  text.results
                }`}
          </p>
          <button
            type="button"
            onClick={onResetFilters}
            className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-200"
          >
            {text.reset}
          </button>
        </div>

        <div
          key={listKey}
          className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1 lg:max-h-[620px] lg:grid-cols-2 2xl:grid-cols-3"
        >
          {visibleCourses.map((course) => {
            const isSelected = selectedIdSet.has(course.id);
            const hasConflict =
              isSelected && conflictCourseIds.has(course.id);

            return (
              <CourseResultCard
                key={course.id}
                course={course}
                isSelected={isSelected}
                hasConflict={hasConflict}
                onToggle={() => onToggleCourse(course)}
              />
            );
          })}

          {filteredCoursesCount > visibleCourses.length && (
            <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-center text-sm font-medium text-neutral-600">
              {text.showingTop}{" "}
              {MAX_VISIBLE_RESULTS.toLocaleString(numberLocale)}
              {locale === "ko" ? "" : " "}
              {text.showingTopSuffix}
            </div>
          )}

          {filteredCoursesCount === 0 && (
            <StateCard type="info" message={text.noCourses} />
          )}
        </div>
      </div>
    </Card>
  );
}

function MobileCoursePickerSheet({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  const text = useDictionary().pages.timetable;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-picker-title"
      onClick={onClose}
    >
      <div
        className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-hidden rounded-t-2xl bg-white p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="course-picker-title" className="text-lg font-bold text-neutral-900">
            {text.addCourse}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-semibold text-neutral-700"
          >
            {text.close}
          </button>
        </div>
        <div className="max-h-[calc(88vh-64px)] overflow-y-auto pb-2">
          {children}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  allLabel,
  getOptionLabel,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  allLabel: string;
  getOptionLabel?: (value: string) => string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-semibold text-neutral-800"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-primary-500"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {getOptionLabel ? getOptionLabel(option) : option}
          </option>
        ))}
      </select>
    </div>
  );
}

function CourseResultCard({
  course,
  isSelected,
  hasConflict,
  onToggle,
}: {
  course: LectureTimetableCourse;
  isSelected: boolean;
  hasConflict: boolean;
  onToggle: () => void;
}) {
  const text = useDictionary().pages.timetable;
  const locale = useLocale();

  return (
    <article
      className={clsx(
        "rounded-card border bg-white p-4 shadow-card",
        hasConflict
          ? "border-red-300"
          : isSelected
            ? "border-primary-300"
            : "border-neutral-200",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">{course.id}</Badge>
            {course.completionType && (
              <Badge tone="blue">
                {formatCompletionType(course.completionType, text)}
              </Badge>
            )}
            {course.credits != null && (
              <Badge tone="green">{formatCredits(course.credits, text)}</Badge>
            )}
            {hasConflict && <Badge tone="red">{text.conflictBadge}</Badge>}
          </div>
          <h3 className="break-keep text-base font-bold text-neutral-900">
            {course.courseName}
          </h3>
          <p className="mt-1 text-sm text-neutral-600">
            {joinParts([
              course.professor || text.professorMissing,
              course.departmentName,
              course.grade
                ? formatGrade(course.grade.toString(), text, locale)
                : undefined,
            ])}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={clsx(
            "shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
            isSelected
              ? "bg-neutral-100 text-neutral-800 hover:bg-neutral-200"
              : "bg-primary-600 text-white hover:bg-primary-700",
          )}
        >
          {isSelected ? text.delete : text.add}
        </button>
      </div>

      <dl className="mt-3 grid gap-2 text-sm text-neutral-700">
        <CourseMeta label={text.time} value={course.classTime || text.timeMissing} />
        <CourseMeta label={text.place} value={course.place || text.placeMissing} />
        {course.note && <CourseMeta label={text.note} value={course.note} />}
      </dl>
    </article>
  );
}

function CourseMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[3rem_1fr] gap-2">
      <dt className="font-semibold text-neutral-500">{label}</dt>
      <dd className="break-keep text-neutral-800">{value}</dd>
    </div>
  );
}

function TimetableGrid({
  selectedCourses,
  conflictCourseIds,
}: {
  selectedCourses: LectureTimetableCourse[];
  conflictCourseIds: Set<string>;
}) {
  const text = useDictionary().pages.timetable;

  return (
    <div className="w-full max-w-full max-h-[72vh] overflow-x-auto overflow-y-auto rounded-lg border border-neutral-200 lg:max-h-[760px]">
      <div className="w-[420px] max-w-none sm:w-full">
        <div className="sticky top-0 z-10 grid grid-cols-[38px_repeat(5,minmax(0,1fr))] border-b border-neutral-200 bg-neutral-50 text-center text-[11px] font-bold text-neutral-700 sm:grid-cols-[56px_repeat(5,minmax(0,1fr))] sm:text-sm">
          <div className="border-r border-neutral-200 px-1 py-2 sm:px-2 sm:py-3">
            {text.period}
          </div>
          {DAYS.map((day) => (
            <div
              key={day}
              className="border-r border-neutral-200 px-1 py-2 last:border-r-0 sm:px-2 sm:py-3"
            >
              {getDayLabel(day, text)}
            </div>
          ))}
        </div>

        {PERIODS.map((period) => (
          <div
            key={period}
            className="grid min-h-[74px] grid-cols-[38px_repeat(5,minmax(0,1fr))] border-b border-neutral-200 last:border-b-0 sm:min-h-[96px] sm:grid-cols-[56px_repeat(5,minmax(0,1fr))] lg:min-h-[108px]"
          >
            <div className="flex flex-col items-center justify-center border-r border-neutral-200 bg-neutral-50 px-0.5 text-center font-semibold text-neutral-600">
              <span className="text-[11px] leading-4 sm:text-sm">
                {formatPeriodLabel(period, text)}
              </span>
              <span className="text-[8px] leading-3 text-neutral-500 sm:text-[10px]">
                {getPeriodTimeLabel(period)}
              </span>
            </div>
            {DAYS.map((day) => {
              const cellCourses = selectedCourses.filter((course) =>
                course.timeSlots.some((slot) =>
                  includesPeriod(slot, day, period),
                ),
              );

              return (
                <div
                  key={`${day}-${period}`}
                  className="min-h-[74px] border-r border-neutral-100 p-0.5 last:border-r-0 sm:min-h-[96px] sm:p-1.5 lg:min-h-[108px]"
                >
                  <div className="space-y-1">
                    {cellCourses.map((course) => (
                      <div
                        key={course.id}
                        className={clsx(
                          "rounded border px-1 py-1 text-[9px] leading-3 sm:px-2 sm:py-1.5 sm:text-[11px] sm:leading-4",
                          conflictCourseIds.has(course.id)
                            ? "border-red-300 bg-red-50 text-red-900"
                            : "border-primary-200 bg-primary-50 text-primary-900",
                        )}
                      >
                        <p className="line-clamp-2 font-bold sm:text-xs">
                          {course.courseName}
                        </p>
                        <p className="mt-0.5 text-[9px] text-neutral-700 sm:text-[11px]">
                          {course.classTime || text.timeMissing}
                        </p>
                        <p className="mt-0.5 hidden text-[10px] text-neutral-600 sm:line-clamp-2 sm:block">
                          {joinParts([course.professor, course.place])}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function SelectedCoursesPanel({
  selectedCourses,
  conflictCourseIds,
  completionStats,
  totalCredits,
  onClear,
  onRemove,
}: {
  selectedCourses: LectureTimetableCourse[];
  conflictCourseIds: Set<string>;
  completionStats: CompletionGroupStat[];
  totalCredits: number;
  onClear: () => void;
  onRemove: (course: LectureTimetableCourse) => void;
}) {
  const text = useDictionary().pages.timetable;

  return (
    <Card hover={false} className="min-w-0 border border-neutral-200">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-neutral-900">
          {text.selectedCourses}
        </h2>
        {selectedCourses.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            {text.clearAll}
          </button>
        )}
      </div>

      {selectedCourses.length === 0 ? (
        <StateCard type="info" message={text.selectedEmpty} />
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <p className="text-sm font-bold text-neutral-900">
              {text.totalSummaryPrefix} {formatCredits(totalCredits, text)} /{" "}
              {formatCount(selectedCourses.length, text.coursesUnit)}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {completionStats.map((stat) => (
                <div
                  key={stat.id}
                  className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm"
                >
                  <span className="font-semibold text-neutral-700">
                    {getCompletionGroupLabel(stat.id, text)}
                  </span>
                  <span className="font-bold text-neutral-900">
                    {formatCredits(stat.credits, text)} /{" "}
                    {formatCount(stat.count, text.coursesUnit)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {selectedCourses.map((course) => (
              <SelectedCourseRow
                key={course.id}
                course={course}
                hasConflict={conflictCourseIds.has(course.id)}
                onRemove={() => onRemove(course)}
              />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function SelectedCourseRow({
  course,
  hasConflict,
  onRemove,
}: {
  course: LectureTimetableCourse;
  hasConflict: boolean;
  onRemove: () => void;
}) {
  const text = useDictionary().pages.timetable;

  return (
    <div
      className={clsx(
        "rounded-lg border p-3",
        hasConflict ? "border-red-300 bg-red-50" : "border-neutral-200 bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            {course.credits != null && (
              <Badge tone="green">{formatCredits(course.credits, text)}</Badge>
            )}
            {course.timeSlots.length === 0 && (
              <Badge tone="neutral">{text.timeMissing}</Badge>
            )}
            {hasConflict && <Badge tone="red">{text.conflictBadge}</Badge>}
          </div>
          <p className="break-keep font-bold text-neutral-900">
            {course.courseName}
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            {joinParts([
              course.classTime || text.timeMissing,
              course.professor || text.professorMissing,
              course.place || text.placeMissing,
            ])}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-200"
        >
          {text.delete}
        </button>
      </div>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "neutral" | "blue" | "green" | "red";
}) {
  const className = {
    neutral: "border-neutral-200 bg-neutral-50 text-neutral-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
  }[tone];

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-semibold",
        className,
      )}
    >
      {children}
    </span>
  );
}

function getNumberLocale(locale: Locale) {
  return locale === "ko" ? "ko-KR" : "en-US";
}

function formatCount(value: number, unit: string) {
  const numberLocale = /^[A-Za-z]/.test(unit) ? "en-US" : "ko-KR";
  const separator = /^[A-Za-z]/.test(unit) ? " " : "";

  return `${value.toLocaleString(numberLocale)}${separator}${unit}`;
}

function formatCredits(value: number, text: TimetableDictionary) {
  return formatCount(value, text.creditsUnit);
}

function formatGrade(
  value: string,
  text: TimetableDictionary,
  locale: Locale,
) {
  return locale === "ko" ? `${value}${text.gradeSuffix}` : `Year ${value}`;
}

function formatPeriodLabel(period: number, text: TimetableDictionary) {
  return /^[A-Za-z]/.test(text.period)
    ? `${text.period} ${period}`
    : `${period}${text.period}`;
}

function formatSemesterBaseLabel(
  year: string | null | undefined,
  semester: string | null | undefined,
  locale: Locale,
  text: TimetableDictionary,
) {
  const normalizedYear = year?.trim() ?? "";
  const normalizedSemester = semester?.trim() ?? "";

  if (locale === "ko") {
    return `${normalizedYear ? `${normalizedYear}년` : ""} ${
      normalizedSemester || ""
    } ${text.semesterBase}`
      .replace(/\s+/g, " ")
      .trim();
  }

  const sourceLabel = [normalizedYear, normalizedSemester]
    .filter(Boolean)
    .join(" ");

  return sourceLabel
    ? `Based on ${sourceLabel} ${text.semesterBase}.`
    : text.semesterBase;
}

function getDayLabel(day: LectureDay, text: TimetableDictionary) {
  const dayLabels: Partial<Record<LectureDay, string>> = {
    월: text.dayLabels.mon,
    화: text.dayLabels.tue,
    수: text.dayLabels.wed,
    목: text.dayLabels.thu,
    금: text.dayLabels.fri,
  };

  return dayLabels[day] ?? day;
}

function getCompletionGroupLabel(
  id: CompletionGroupId,
  text: TimetableDictionary,
) {
  return text.completionGroups[id];
}

function formatCompletionType(value: string, text: TimetableDictionary) {
  const completionTypeLabels: Record<
    string,
    keyof TimetableDictionary["completionTypes"]
  > = {
    전공필수: "majorRequired",
    전공선택: "majorElective",
    교양필수: "liberalRequired",
    교양선택: "liberalElective",
    연계필수: "linkedRequired",
    연계선택: "linkedElective",
    교직필수: "teachingRequired",
    채플: "chapel",
    일반선택: "generalElective",
  };
  const labelKey = completionTypeLabels[value];

  return labelKey ? text.completionTypes[labelKey] : value;
}

function getConflictSummary(courses: LectureTimetableCourse[]) {
  const courseIds = new Set<string>();
  const pairs: TimetableConflictPair[] = [];

  courses.forEach((course, courseIndex) => {
    courses.slice(courseIndex + 1).forEach((otherCourse) => {
      const conflictSlots = getTimeConflictSlots(
        course.timeSlots,
        otherCourse.timeSlots,
      );

      if (conflictSlots.length > 0) {
        courseIds.add(course.id);
        courseIds.add(otherCourse.id);
        pairs.push({
          firstCourse: course,
          secondCourse: otherCourse,
          slots: conflictSlots,
        });
      }
    });
  });

  return { courseIds, pairCount: pairs.length, pairs };
}

function getCompletionStats(courses: LectureTimetableCourse[]) {
  const stats = new Map<CompletionGroupId, CompletionGroupStat>(
    COMPLETION_GROUPS.map((group) => [
      group.id,
      {
        id: group.id,
        label: group.label,
        credits: 0,
        count: 0,
      },
    ]),
  );

  courses.forEach((course) => {
    const groupId = getCompletionGroupId(course.completionType);
    const stat = stats.get(groupId);
    if (!stat) return;

    stat.credits += course.credits ?? 0;
    stat.count += 1;
  });

  return COMPLETION_GROUPS.map((group) => stats.get(group.id)).filter(
    (stat): stat is CompletionGroupStat => Boolean(stat),
  );
}

function getCompletionGroupId(
  completionType?: string,
): CompletionGroupId {
  const group = COMPLETION_GROUPS.find((item) =>
    item.types.includes(completionType ?? ""),
  );

  return group?.id ?? "other";
}

function getTimeConflictSlots(
  firstSlots: LectureTimeSlot[],
  secondSlots: LectureTimeSlot[],
) {
  const conflicts: TimetableConflictPair["slots"] = [];

  firstSlots.forEach((firstSlot) => {
    secondSlots.forEach((secondSlot) => {
      if (firstSlot.day !== secondSlot.day) return;

      const startPeriod = Math.max(
        firstSlot.startPeriod,
        secondSlot.startPeriod,
      );
      const endPeriod = Math.min(firstSlot.endPeriod, secondSlot.endPeriod);

      if (startPeriod <= endPeriod) {
        conflicts.push({
          day: firstSlot.day,
          startPeriod,
          endPeriod,
        });
      }
    });
  });

  return conflicts;
}

function formatConflictSlots(
  slots: TimetableConflictPair["slots"],
  text: TimetableDictionary,
) {
  return slots
    .map((slot) => {
      const periodLabel =
        slot.startPeriod === slot.endPeriod
          ? formatPeriodLabel(slot.startPeriod, text)
          : `${formatPeriodLabel(slot.startPeriod, text)}-${formatPeriodLabel(
              slot.endPeriod,
              text,
            )}`;

      return `${getDayLabel(slot.day, text)} ${periodLabel}`;
    })
    .join(", ");
}

function includesPeriod(
  slot: LectureTimeSlot,
  day: LectureDay,
  period: number,
) {
  return slot.day === day && slot.startPeriod <= period && period <= slot.endPeriod;
}

function getPeriodTimeLabel(period: number) {
  const startHour = period + 8;
  const endHour = startHour + 1;

  return `${formatHour(startHour)}-${formatHour(endHour)}`;
}

function formatHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function uniqueSorted(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  ).sort((first, second) => first.localeCompare(second, "ko-KR"));
}

function normalizeSearchText(value: string) {
  return normalizeCourseName(value).replace(/[^0-9a-z가-힣]/g, "");
}

function joinParts(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" · ");
}
