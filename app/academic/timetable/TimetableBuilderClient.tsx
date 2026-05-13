"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";

import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { Icon } from "@/app/components/Icon";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import { fetchJson } from "@/lib/fetch-json";
import { normalizeCourseName } from "@/lib/lecture-timetable";
import type {
  LectureDay,
  LectureTimeSlot,
  LectureTimetableCourse,
  LectureTimetableDataset,
} from "@/lib/lecture-timetable";

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
      setShareMessage("공유 시간표를 불러왔습니다.");
    }
  }, [appliedShareId, courseById, shareId, shareResponse]);

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
  const semesterBaseLabel = `${response.data.year ?? ""}년 ${
    response.data.semester ?? ""
  } 시간표를 기준으로 합니다.`
    .replace(/\s+/g, " ")
    .trim();

  function clearShareFromUrl() {
    if (shareId) {
      router.replace(pathname, { scroll: false });
      setAppliedShareId("");
    }
  }

  function replaceSelectedCourses(nextIds: string[], options = { clearShare: true }) {
    setSelectedCourseIds(Array.from(new Set(nextIds)));
    setShareMessage("");
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
        setShareMessage(share.error ?? "공유 링크를 만들지 못했습니다.");
        return;
      }

      const nextUrl = `${pathname}?share=${encodeURIComponent(share.shareId)}`;
      router.replace(nextUrl, { scroll: false });

      if (typeof window !== "undefined") {
        const absoluteUrl = `${window.location.origin}${nextUrl}`;
        await navigator.clipboard?.writeText(absoluteUrl);
      }

      setAppliedShareId(share.shareId);
      setShareMessage("공유 링크를 만들고 클립보드에 복사했습니다.");
    } catch {
      setShareMessage("공유 링크를 만들지 못했습니다.");
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
    <Container className="py-6 sm:py-8">
      <div className="mb-6">
        <Link
          href="/academic"
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          <Icon name="chevron-right" size={16} className="rotate-180" />
          학사 정보
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mb-2 text-2xl font-bold text-neutral-900 sm:text-3xl">
              시간표 짜기
            </h1>
            <p className="text-sm text-neutral-600 sm:text-base">
              {semesterBaseLabel}
            </p>
          </div>
        </div>
      </div>

      <section className="sticky top-0 z-20 mb-5 rounded-card border border-neutral-200 bg-white/95 p-3 shadow-card backdrop-blur sm:p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <SummaryMetric label="총 학점" value={`${totalCredits}학점`} />
          <SummaryMetric label="선택" value={`${selectedCourses.length}개`} />
          <SummaryMetric label="시간 미정" value={`${unscheduledCount}개`} />
          <SummaryMetric
            label="충돌"
            value={`${conflictSummary.pairCount}건`}
            isWarning={conflictSummary.pairCount > 0}
          />
          <button
            type="button"
            onClick={createShareLink}
            disabled={selectedCourses.length === 0 || isCreatingShare}
            className="col-span-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-300 sm:col-span-1"
          >
            {isCreatingShare ? "공유 생성 중" : "공유"}
          </button>
        </div>
        {visibleCompletionStats.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {visibleCompletionStats.map((stat) => (
              <span
                key={stat.id}
                className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-semibold text-neutral-700"
              >
                {stat.label} {stat.credits}학점/{stat.count}과목
              </span>
            ))}
          </div>
        )}
        {(shareMessage || isShareFetching || (shareId && !shareResponse.success)) && (
          <p className="mt-3 text-sm font-medium text-neutral-600">
            {isShareFetching
              ? "공유 시간표를 불러오는 중입니다."
              : shareMessage ||
                shareResponse.error ||
                "공유 시간표를 불러오지 못했습니다."}
          </p>
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
          title="강의 정보를 불러올 수 없습니다"
          message={
            response.error ??
            "잠시 후 다시 시도하거나 네트워크 상태를 확인해 주세요."
          }
          action={
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              다시 불러오기
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          <Card hover={false} className="border border-neutral-200">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">
                  주간 시간표
                </h2>
                <p className="text-sm text-neutral-500">
                  교시별 시간과 선택한 강의를 한눈에 확인하세요.
                </p>
              </div>
            </div>

            <TimetableGrid
              selectedCourses={selectedCourses}
              conflictCourseIds={conflictSummary.courseIds}
            />
          </Card>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
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

            <SelectedCoursesPanel
              selectedCourses={selectedCourses}
              conflictCourseIds={conflictSummary.courseIds}
              completionStats={visibleCompletionStats}
              totalCredits={totalCredits}
              onClear={() => replaceSelectedCourses([])}
              onRemove={toggleCourse}
            />
          </section>

          <button
            type="button"
            onClick={() => setIsPickerOpen(true)}
            className="fixed bottom-5 right-5 z-30 rounded-full bg-primary-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition-colors hover:bg-primary-700 lg:hidden"
          >
            강의 추가
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
  const searchInputId = `${idPrefix}-course-search`;

  return (
    <Card hover={false} className="border border-neutral-200">
      <div className="space-y-4">
        <div>
          <label
            htmlFor={searchInputId}
            className="mb-1 block text-sm font-semibold text-neutral-800"
          >
            과목 필터
          </label>
          <input
            id={searchInputId}
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="과목명, 교수, 코드, 강좌번호"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-500"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <FilterSelect
            id={`${idPrefix}-department-filter`}
            label="학과"
            value={departmentFilter}
            onChange={onDepartmentFilterChange}
            options={departments}
            allLabel="전체 학과"
          />
          <FilterSelect
            id={`${idPrefix}-grade-filter`}
            label="학년"
            value={gradeFilter}
            onChange={onGradeFilterChange}
            options={grades}
            allLabel="전체 학년"
          />
          <FilterSelect
            id={`${idPrefix}-completion-filter`}
            label="이수구분"
            value={completionTypeFilter}
            onChange={onCompletionTypeFilterChange}
            options={completionTypes}
            allLabel="전체 구분"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-neutral-600">
            {filteredCoursesCount.toLocaleString("ko-KR")}개 결과
          </p>
          <button
            type="button"
            onClick={onResetFilters}
            className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-200"
          >
            초기화
          </button>
        </div>

        <div
          key={listKey}
          className="max-h-[60vh] space-y-3 overflow-y-auto pr-1 lg:max-h-[620px]"
        >
          {visibleCourses.map((course) => {
            const isSelected = selectedIdSet.has(course.id);
            const hasConflict =
              isSelected && conflictCourseIds.has(course.id);

            return (
              <CourseResultCard
                key={getCourseRenderKey(course)}
                course={course}
                isSelected={isSelected}
                hasConflict={hasConflict}
                onToggle={() => onToggleCourse(course)}
              />
            );
          })}

          {filteredCoursesCount > visibleCourses.length && (
            <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-center text-sm font-medium text-neutral-600">
              상위 {MAX_VISIBLE_RESULTS.toLocaleString("ko-KR")}개 표시
            </div>
          )}

          {filteredCoursesCount === 0 && (
            <StateCard type="info" message="조건에 맞는 강의가 없습니다." />
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
            강의 추가
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-semibold text-neutral-700"
          >
            닫기
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
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  allLabel: string;
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
            {option}
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
              <Badge tone="blue">{course.completionType}</Badge>
            )}
            {course.credits != null && (
              <Badge tone="green">{course.credits}학점</Badge>
            )}
            {hasConflict && <Badge tone="red">충돌</Badge>}
          </div>
          <h3 className="break-keep text-base font-bold text-neutral-900">
            {course.courseName}
          </h3>
          <p className="mt-1 text-sm text-neutral-600">
            {joinParts([
              course.professor || "교수 미지정",
              course.departmentName,
              course.grade ? `${course.grade}학년` : undefined,
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
          {isSelected ? "삭제" : "추가"}
        </button>
      </div>

      <dl className="mt-3 grid gap-2 text-sm text-neutral-700">
        <CourseMeta label="시간" value={course.classTime || "시간 미정"} />
        <CourseMeta label="장소" value={course.place || "장소 미정"} />
        {course.note && <CourseMeta label="비고" value={course.note} />}
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
  return (
    <div className="max-h-[72vh] overflow-y-auto overflow-x-hidden rounded-lg border border-neutral-200 lg:max-h-[760px]">
      <div className="w-full">
        <div className="sticky top-0 z-10 grid grid-cols-[38px_repeat(5,minmax(0,1fr))] border-b border-neutral-200 bg-neutral-50 text-center text-[11px] font-bold text-neutral-700 sm:grid-cols-[56px_repeat(5,minmax(0,1fr))] sm:text-sm">
          <div className="border-r border-neutral-200 px-1 py-2 sm:px-2 sm:py-3">
            교시
          </div>
          {DAYS.map((day) => (
            <div
              key={day}
              className="border-r border-neutral-200 px-1 py-2 last:border-r-0 sm:px-2 sm:py-3"
            >
              {day}
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
                {period}교시
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
                          {course.classTime || "시간 미정"}
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
  return (
    <Card hover={false} className="border border-neutral-200">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-neutral-900">선택 강의</h2>
        {selectedCourses.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            전체 삭제
          </button>
        )}
      </div>

      {selectedCourses.length === 0 ? (
        <StateCard type="info" message="선택한 강의가 없습니다." />
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <p className="text-sm font-bold text-neutral-900">
              총 {totalCredits}학점 / {selectedCourses.length}과목
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {completionStats.map((stat) => (
                <div
                  key={stat.id}
                  className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm"
                >
                  <span className="font-semibold text-neutral-700">
                    {stat.label}
                  </span>
                  <span className="font-bold text-neutral-900">
                    {stat.credits}학점 / {stat.count}과목
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
              <Badge tone="green">{course.credits}학점</Badge>
            )}
            {course.timeSlots.length === 0 && (
              <Badge tone="neutral">시간 미정</Badge>
            )}
            {hasConflict && <Badge tone="red">충돌</Badge>}
          </div>
          <p className="break-keep font-bold text-neutral-900">
            {course.courseName}
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            {joinParts([
              course.classTime || "시간 미정",
              course.professor || "교수 미지정",
              course.place || "장소 미정",
            ])}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-200"
        >
          삭제
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

function getConflictSummary(courses: LectureTimetableCourse[]) {
  const courseIds = new Set<string>();
  let pairCount = 0;

  courses.forEach((course, courseIndex) => {
    courses.slice(courseIndex + 1).forEach((otherCourse) => {
      if (hasTimeConflict(course.timeSlots, otherCourse.timeSlots)) {
        courseIds.add(course.id);
        courseIds.add(otherCourse.id);
        pairCount += 1;
      }
    });
  });

  return { courseIds, pairCount };
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

function hasTimeConflict(
  firstSlots: LectureTimeSlot[],
  secondSlots: LectureTimeSlot[],
) {
  return firstSlots.some((firstSlot) =>
    secondSlots.some(
      (secondSlot) =>
        firstSlot.day === secondSlot.day &&
        firstSlot.startPeriod <= secondSlot.endPeriod &&
        secondSlot.startPeriod <= firstSlot.endPeriod,
    ),
  );
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

function getCourseRenderKey(course: LectureTimetableCourse) {
  return [
    course.id,
    course.courseCode,
    course.departmentName,
    course.professor,
    course.classTime,
  ]
    .filter(Boolean)
    .join("-");
}

function joinParts(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" · ");
}
