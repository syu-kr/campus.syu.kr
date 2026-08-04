"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";

import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { Icon } from "@/app/components/Icon";
import { Modal } from "@/app/components/Modal";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import { fetchJson } from "@/lib/fetch-json";
import { localizePath, type Dictionary, type Locale } from "@/lib/i18n";
import {
  FILTERABLE_LECTURE_DAYS,
  filterLectureTimetableCourses,
  getLectureCourseSearchMatches,
  normalizeLectureSearchText,
  type LectureSearchMatchField,
} from "@/lib/lecture-timetable-filter";
import {
  createTimetableDraft,
  filterAvailableDraftWorkspace,
  isTimetableDraftForSemester,
  parseTimetableDraft,
  TIMETABLE_DRAFT_STORAGE_KEY,
  type TimetableDraft,
} from "@/lib/timetable-draft";
import {
  addTimetable,
  createTimetableWorkspace,
  duplicateTimetable,
  enterTimetableCompareMode,
  getActiveTimetable,
  hasWorkspaceCourses,
  leaveTimetableCompareMode,
  MAX_TIMETABLES,
  removeTimetable,
  replaceTimetableCourseIds,
  setActiveTimetable,
  toggleTimetableCourse,
  filterWorkspaceCourseIds,
  type TimetableWorkspace,
  type TimetableWorkspaceItem,
} from "@/lib/timetable-workspace";
import type {
  LectureDay,
  LectureTimeSlot,
  LectureTimetableCourse,
  LectureTimetableDataset,
} from "@/lib/lecture-timetable";
import {
  getCoursesBeyondVisibleTimetable,
  TIMETABLE_DAYS,
  TIMETABLE_PERIODS,
} from "@/lib/timetable-display";

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
    workspace?: TimetableWorkspace;
  };
  error?: string;
}

interface CreateShareResponse {
  success: boolean;
  shareId?: string;
  error?: string;
}

const PERIOD_OPTIONS = TIMETABLE_PERIODS.map(String);
const VISIBLE_SEARCH_MATCH_FIELDS: LectureSearchMatchField[] = [
  "departmentName",
  "collegeName",
  "completionType",
  "areaType",
  "classTime",
  "place",
  "note",
  "teamTeaching",
];
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

type DraftPersistenceMode = "pending" | "local" | "shared" | "paused";
type DesktopSidebarView = "courses" | "selected";

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
  const [dayFilters, setDayFilters] = useState<LectureDay[]>([]);
  const [startPeriodFilter, setStartPeriodFilter] = useState("");
  const [endPeriodFilter, setEndPeriodFilter] = useState("");
  const [timetableWorkspace, setTimetableWorkspace] = useState(
    createTimetableWorkspace,
  );
  const [appliedShareId, setAppliedShareId] = useState("");
  const [createdShareId, setCreatedShareId] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [desktopSidebarView, setDesktopSidebarView] =
    useState<DesktopSidebarView>("courses");
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [shareFallbackUrl, setShareFallbackUrl] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [previousSemesterDraft, setPreviousSemesterDraft] =
    useState<TimetableDraft | null>(null);
  const [draftPersistenceMode, setDraftPersistenceMode] =
    useState<DraftPersistenceMode>("pending");
  const [isDraftStorageAvailable, setIsDraftStorageAvailable] = useState(true);

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
    enabled: Boolean(shareId) && shareId !== createdShareId,
    staleTime: 5 * 60 * 1000,
  });

  const courses = response.data.courses;
  const courseById = useMemo(() => {
    return new Map(courses.map((course) => [course.id, course]));
  }, [courses]);
  const activeTimetable = getActiveTimetable(timetableWorkspace);
  const selectedCourseIds = activeTimetable.courseIds;

  useEffect(() => {
    if (
      draftPersistenceMode !== "pending" ||
      !response.success ||
      courseById.size === 0
    ) {
      return;
    }

    if (shareId) {
      setDraftPersistenceMode("shared");
      return;
    }

    try {
      const rawDraft = window.localStorage.getItem(
        TIMETABLE_DRAFT_STORAGE_KEY,
      );
      if (!rawDraft) {
        setDraftPersistenceMode("local");
        return;
      }

      const draft = parseTimetableDraft(rawDraft);
      if (!draft) {
        window.localStorage.removeItem(TIMETABLE_DRAFT_STORAGE_KEY);
        setDraftPersistenceMode("local");
        return;
      }

      if (
        !isTimetableDraftForSemester(
          draft,
          response.data.year,
          response.data.semester,
        )
      ) {
        setPreviousSemesterDraft(draft);
        setDraftPersistenceMode("paused");
        return;
      }

      const restoredWorkspace = filterAvailableDraftWorkspace(
        draft,
        new Set(courseById.keys()),
      );
      if (hasWorkspaceCourses(restoredWorkspace)) {
        setTimetableWorkspace(restoredWorkspace);
        setDraftMessage(text.draftRestored);
      } else {
        window.localStorage.removeItem(TIMETABLE_DRAFT_STORAGE_KEY);
      }
      setDraftPersistenceMode("local");
    } catch {
      setIsDraftStorageAvailable(false);
      setDraftPersistenceMode("local");
    }
  }, [
    courseById,
    draftPersistenceMode,
    response.data.semester,
    response.data.year,
    response.success,
    shareId,
    text.draftRestored,
  ]);

  useEffect(() => {
    if (draftPersistenceMode !== "local" || !response.success) return;

    try {
      if (!hasWorkspaceCourses(timetableWorkspace)) {
        window.localStorage.removeItem(TIMETABLE_DRAFT_STORAGE_KEY);
        return;
      }

      window.localStorage.setItem(
        TIMETABLE_DRAFT_STORAGE_KEY,
        JSON.stringify(
          createTimetableDraft(
            timetableWorkspace,
            response.data.year,
            response.data.semester,
          ),
        ),
      );
    } catch {
      // 비공개 모드나 저장 용량 제한에서도 시간표 편집은 계속 사용할 수 있습니다.
      setIsDraftStorageAvailable(false);
    }
  }, [
    draftPersistenceMode,
    response.data.semester,
    response.data.year,
    response.success,
    timetableWorkspace,
  ]);

  useEffect(() => {
    if (
      shareId &&
      shareId !== createdShareId &&
      draftPersistenceMode === "local"
    ) {
      setDraftPersistenceMode("shared");
      setPreviousSemesterDraft(null);
      setDraftMessage("");
    }
  }, [createdShareId, draftPersistenceMode, shareId]);

  useEffect(() => {
    if (!shareId) {
      if (appliedShareId) setAppliedShareId("");
      if (createdShareId) setCreatedShareId("");
      return;
    }

    if (shareId === createdShareId) {
      return;
    }

    if (
      appliedShareId !== shareId &&
      shareResponse.success &&
      shareResponse.data &&
      courseById.size > 0
    ) {
      const restoredWorkspace = shareResponse.data.workspace
        ? filterWorkspaceCourseIds(
            shareResponse.data.workspace,
            new Set(courseById.keys()),
          )
        : createTimetableWorkspace(
            shareResponse.data.courseIds.filter((courseId) =>
              courseById.has(courseId),
            ),
          );
      setTimetableWorkspace(restoredWorkspace);
      setAppliedShareId(shareId);
      setShareMessage(text.shareLoaded);
    }
  }, [
    appliedShareId,
    courseById,
    createdShareId,
    shareId,
    shareResponse,
    text.shareLoaded,
  ]);

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
    return filterLectureTimetableCourses(courses, {
      query: searchQuery,
      department: departmentFilter,
      grade: gradeFilter,
      completionType: completionTypeFilter,
      days: dayFilters,
      startPeriod: parseOptionalPeriod(startPeriodFilter),
      endPeriod: parseOptionalPeriod(endPeriodFilter),
    });
  }, [
    completionTypeFilter,
    courses,
    dayFilters,
    departmentFilter,
    endPeriodFilter,
    gradeFilter,
    searchQuery,
    startPeriodFilter,
  ]);

  const visibleCourses = useMemo(
    () => filteredCourses.slice(0, MAX_VISIBLE_RESULTS),
    [filteredCourses],
  );
  const courseListKey = [
    normalizeLectureSearchText(searchQuery),
    departmentFilter,
    gradeFilter,
    completionTypeFilter,
    dayFilters.join(","),
    startPeriodFilter,
    endPeriodFilter,
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
  const shouldLoadShareFromUrl = Boolean(shareId && shareId !== createdShareId);
  const hasShareableCourses = timetableWorkspace.isCompareMode
    ? hasWorkspaceCourses(timetableWorkspace)
    : selectedCourses.length > 0;

  function clearShareFromUrl() {
    if (shareId) {
      router.replace(pathname, { scroll: false });
      setAppliedShareId("");
      setCreatedShareId("");
    }
  }

  function replaceSelectedCourses(
    nextIds: string[],
    options = { clearShare: true },
  ) {
    updateWorkspace(
      (workspace) =>
        replaceTimetableCourseIds(
          workspace,
          workspace.activeTimetableId,
          nextIds,
        ),
      options,
    );
  }

  function updateWorkspace(
    updater: (
      workspace: ReturnType<typeof createTimetableWorkspace>,
    ) => ReturnType<typeof createTimetableWorkspace>,
    options = { clearShare: true },
  ) {
    setDraftPersistenceMode("local");
    setPreviousSemesterDraft(null);
    setTimetableWorkspace(updater);
    setDraftMessage("");
    setShareMessage("");
    setShareFallbackUrl("");
    if (options.clearShare) clearShareFromUrl();
  }

  function restorePreviousSemesterDraft() {
    if (!previousSemesterDraft) return;

    const restoredWorkspace = filterAvailableDraftWorkspace(
      previousSemesterDraft,
      new Set(courseById.keys()),
    );
    setPreviousSemesterDraft(null);
    setDraftPersistenceMode("local");
    setTimetableWorkspace(restoredWorkspace);
    setDraftMessage(
      hasWorkspaceCourses(restoredWorkspace)
        ? text.draftRestored
        : text.draftNoMatchingCourses,
    );
  }

  function discardPreviousSemesterDraft() {
    try {
      window.localStorage.removeItem(TIMETABLE_DRAFT_STORAGE_KEY);
    } catch {
      // 저장소를 사용할 수 없어도 화면 상태 전환은 계속합니다.
      setIsDraftStorageAvailable(false);
    }
    setPreviousSemesterDraft(null);
    setDraftPersistenceMode("local");
    setDraftMessage("");
  }

  function toggleCourse(course: LectureTimetableCourse) {
    toggleCourseForTimetable(course, timetableWorkspace.activeTimetableId);
  }

  function toggleCourseForTimetable(
    course: LectureTimetableCourse,
    timetableId: string,
  ) {
    updateWorkspace((workspace) =>
      toggleTimetableCourse(workspace, timetableId, course.id),
    );
  }

  function toggleCompareMode() {
    updateWorkspace((workspace) =>
      workspace.isCompareMode
        ? leaveTimetableCompareMode(workspace)
        : enterTimetableCompareMode(workspace),
    );
    setDesktopSidebarView("courses");
  }

  function createAlternativeTimetable() {
    updateWorkspace((workspace) => addTimetable(workspace));
    setDesktopSidebarView("courses");
  }

  function copyAlternativeTimetable(timetableId: string) {
    updateWorkspace((workspace) =>
      duplicateTimetable(workspace, timetableId),
    );
  }

  function deleteAlternativeTimetable(timetableId: string) {
    updateWorkspace((workspace) => removeTimetable(workspace, timetableId));
  }

  function activateTimetable(timetableId: string) {
    updateWorkspace(
      (workspace) => setActiveTimetable(workspace, timetableId),
      { clearShare: false },
    );
  }

  async function createShareLink() {
    if (!hasShareableCourses || isCreatingShare) return;

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
            workspace: timetableWorkspace.isCompareMode
              ? timetableWorkspace
              : undefined,
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
      setCreatedShareId(share.shareId);
      setAppliedShareId(share.shareId);
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
    setDayFilters([]);
    setStartPeriodFilter("");
    setEndPeriodFilter("");
  }

  function toggleDayFilter(day: LectureDay) {
    setDayFilters((currentDays) =>
      currentDays.includes(day)
        ? currentDays.filter((currentDay) => currentDay !== day)
        : [...currentDays, day],
    );
  }

  return (
    <Container
      size="full"
      className="min-w-0 max-w-[88rem] overflow-x-hidden py-6 sm:py-8 2xl:max-w-[112rem]"
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
          <button
            type="button"
            onClick={toggleCompareMode}
            aria-pressed={timetableWorkspace.isCompareMode}
            className="hidden shrink-0 rounded-lg border border-primary-300 bg-white px-4 py-2.5 text-sm font-bold text-primary-700 transition-colors hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 xl:inline-flex"
          >
            {timetableWorkspace.isCompareMode
              ? text.leaveCompareMode
              : text.enterCompareMode}
          </button>
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
            disabled={!hasShareableCourses || isCreatingShare}
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
        <p className="mt-3 text-xs text-neutral-500">
          {isDraftStorageAvailable
            ? text.draftAutoSaveNotice
            : text.draftStorageUnavailable}
        </p>
        {previousSemesterDraft && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <p className="font-medium">{text.previousDraftFound}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={restorePreviousSemesterDraft}
                className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-800"
              >
                {text.restorePreviousDraft}
              </button>
              <button
                type="button"
                onClick={discardPreviousSemesterDraft}
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100"
              >
                {text.discardPreviousDraft}
              </button>
            </div>
          </div>
        )}
        {draftMessage && (
          <p className="mt-3 text-sm font-medium text-emerald-700" role="status">
            {draftMessage}
          </p>
        )}
        {(shareMessage ||
          (shouldLoadShareFromUrl &&
            (isShareFetching || !shareResponse.success))) && (
          <p className="mt-3 text-sm font-medium text-neutral-600">
            {shouldLoadShareFromUrl && isShareFetching
              ? text.shareLoading
              : shareMessage ||
                (shouldLoadShareFromUrl
                  ? shareResponse.error || text.shareLoadFailed
                  : "")}
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
          <section className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
            <div className="min-w-0">
              {timetableWorkspace.isCompareMode ? (
                <>
                  <div className="hidden xl:block">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-neutral-900">
                          {text.compareTimetables}
                        </h2>
                        <p className="text-sm text-neutral-500">
                          {text.compareTimetablesDescription}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={createAlternativeTimetable}
                        disabled={
                          timetableWorkspace.timetables.length >= MAX_TIMETABLES
                        }
                        className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
                      >
                        {text.addTimetable}
                      </button>
                    </div>
                    <div className="grid min-w-0 grid-cols-2 gap-4">
                      {timetableWorkspace.timetables.map(
                        (timetable, timetableIndex) => (
                          <ComparisonTimetableCard
                            key={timetable.id}
                            timetableIndex={timetableIndex}
                            courses={getCoursesForTimetable(
                              timetable,
                              courseById,
                            )}
                            isActive={
                              timetable.id ===
                              timetableWorkspace.activeTimetableId
                            }
                            canDuplicate={
                              timetableWorkspace.timetables.length <
                              MAX_TIMETABLES
                            }
                            canRemove={
                              timetableWorkspace.timetables.length > 2
                            }
                            onActivate={() => activateTimetable(timetable.id)}
                            onDuplicate={() =>
                              copyAlternativeTimetable(timetable.id)
                            }
                            onRemove={() =>
                              deleteAlternativeTimetable(timetable.id)
                            }
                          />
                        ),
                      )}
                    </div>
                  </div>
                  <div className="space-y-4 xl:hidden">
                    <StateCard type="info" message={text.compareDesktopOnly} />
                    <TimetableOverviewCard
                      selectedCourses={selectedCourses}
                      conflictCourseIds={conflictSummary.courseIds}
                    />
                  </div>
                </>
              ) : (
                <TimetableOverviewCard
                  selectedCourses={selectedCourses}
                  conflictCourseIds={conflictSummary.courseIds}
                  matchDesktopSidebar
                />
              )}
            </div>

            <div className="hidden xl:block">
              <DesktopWorkspaceSidebar
                activeView={desktopSidebarView}
                onViewChange={setDesktopSidebarView}
              >
                {desktopSidebarView === "courses" ? (
                  <CoursePicker
                    completionTypeFilter={completionTypeFilter}
                    departments={departments}
                    departmentFilter={departmentFilter}
                    dayFilters={dayFilters}
                    endPeriodFilter={endPeriodFilter}
                    filteredCoursesCount={filteredCourses.length}
                    grades={grades}
                    gradeFilter={gradeFilter}
                    completionTypes={completionTypes}
                    onCompletionTypeFilterChange={setCompletionTypeFilter}
                    onDayFilterToggle={toggleDayFilter}
                    onDepartmentFilterChange={setDepartmentFilter}
                    onEndPeriodFilterChange={setEndPeriodFilter}
                    onGradeFilterChange={setGradeFilter}
                    onResetFilters={resetFilters}
                    onSearchQueryChange={setSearchQuery}
                    onStartPeriodFilterChange={setStartPeriodFilter}
                    onToggleCourse={toggleCourse}
                    onToggleCourseForTimetable={toggleCourseForTimetable}
                    searchQuery={searchQuery}
                    selectedIdSet={selectedIdSet}
                    startPeriodFilter={startPeriodFilter}
                    timetableMemberships={
                      timetableWorkspace.isCompareMode
                        ? timetableWorkspace.timetables
                        : undefined
                    }
                    activeTimetableId={timetableWorkspace.activeTimetableId}
                    visibleCourses={visibleCourses}
                    conflictCourseIds={conflictSummary.courseIds}
                    idPrefix="desktop-sidebar"
                    listKey={courseListKey}
                    compact
                  />
                ) : (
                  <SelectedCoursesPanel
                    selectedCourses={selectedCourses}
                    conflictCourseIds={conflictSummary.courseIds}
                    completionStats={visibleCompletionStats}
                    totalCredits={totalCredits}
                    onClear={() => replaceSelectedCourses([])}
                    onRemove={toggleCourse}
                  />
                )}
              </DesktopWorkspaceSidebar>
            </div>

            <div className="hidden lg:block xl:hidden">
              <SelectedCoursesPanel
                selectedCourses={selectedCourses}
                conflictCourseIds={conflictSummary.courseIds}
                completionStats={visibleCompletionStats}
                totalCredits={totalCredits}
                onClear={() => replaceSelectedCourses([])}
                onRemove={toggleCourse}
              />
            </div>
          </section>

          <div className="hidden lg:block xl:hidden">
            <CoursePicker
              completionTypeFilter={completionTypeFilter}
              departments={departments}
              departmentFilter={departmentFilter}
              dayFilters={dayFilters}
              endPeriodFilter={endPeriodFilter}
              filteredCoursesCount={filteredCourses.length}
              grades={grades}
              gradeFilter={gradeFilter}
              completionTypes={completionTypes}
              onCompletionTypeFilterChange={setCompletionTypeFilter}
              onDayFilterToggle={toggleDayFilter}
              onDepartmentFilterChange={setDepartmentFilter}
              onEndPeriodFilterChange={setEndPeriodFilter}
              onGradeFilterChange={setGradeFilter}
              onResetFilters={resetFilters}
              onSearchQueryChange={setSearchQuery}
              onStartPeriodFilterChange={setStartPeriodFilter}
              onToggleCourse={toggleCourse}
              searchQuery={searchQuery}
              selectedIdSet={selectedIdSet}
              startPeriodFilter={startPeriodFilter}
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
                dayFilters={dayFilters}
                endPeriodFilter={endPeriodFilter}
                filteredCoursesCount={filteredCourses.length}
                grades={grades}
                gradeFilter={gradeFilter}
                completionTypes={completionTypes}
                onCompletionTypeFilterChange={setCompletionTypeFilter}
                onDayFilterToggle={toggleDayFilter}
                onDepartmentFilterChange={setDepartmentFilter}
                onEndPeriodFilterChange={setEndPeriodFilter}
                onGradeFilterChange={setGradeFilter}
                onResetFilters={resetFilters}
                onSearchQueryChange={setSearchQuery}
                onStartPeriodFilterChange={setStartPeriodFilter}
                onToggleCourse={toggleCourse}
                searchQuery={searchQuery}
                selectedIdSet={selectedIdSet}
                startPeriodFilter={startPeriodFilter}
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

function TimetableOverviewCard({
  selectedCourses,
  conflictCourseIds,
  matchDesktopSidebar = false,
}: {
  selectedCourses: LectureTimetableCourse[];
  conflictCourseIds: Set<string>;
  matchDesktopSidebar?: boolean;
}) {
  const text = useDictionary().pages.timetable;

  return (
    <Card
      hover={false}
      className={clsx(
        "min-w-0 overflow-hidden border border-neutral-200",
        matchDesktopSidebar &&
          "xl:flex xl:h-[calc(100vh-7rem)] xl:flex-col",
      )}
    >
      <div className="mb-4">
        <h2 className="text-lg font-bold text-neutral-900">
          {text.weeklyTimetable}
        </h2>
        <p className="text-sm text-neutral-500">
          {text.weeklyTimetableDescription}
        </p>
      </div>
      <TimetableGrid
        selectedCourses={selectedCourses}
        conflictCourseIds={conflictCourseIds}
        fillAvailableHeight={matchDesktopSidebar}
      />
    </Card>
  );
}

function ComparisonTimetableCard({
  timetableIndex,
  courses,
  isActive,
  canDuplicate,
  canRemove,
  onActivate,
  onDuplicate,
  onRemove,
}: {
  timetableIndex: number;
  courses: LectureTimetableCourse[];
  isActive: boolean;
  canDuplicate: boolean;
  canRemove: boolean;
  onActivate: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const text = useDictionary().pages.timetable;
  const conflictSummary = getConflictSummary(courses);
  const totalCredits = courses.reduce(
    (total, course) => total + (course.credits ?? 0),
    0,
  );
  const timetableLabel = formatTimetableLabel(timetableIndex, text);

  return (
    <Card
      hover={false}
      className={clsx(
        "min-w-0 overflow-hidden border",
        isActive
          ? "border-primary-400 ring-2 ring-primary-100"
          : "border-neutral-200",
      )}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-neutral-900">
              {timetableLabel}
            </h3>
            {isActive && <Badge tone="blue">{text.editing}</Badge>}
          </div>
          <p className="mt-1 text-xs font-medium text-neutral-500">
            {formatCredits(totalCredits, text)} · {courses.length}
            {text.coursesUnit} · {text.conflicts} {conflictSummary.pairCount}
            {text.casesUnit}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {!isActive && (
            <button
              type="button"
              onClick={onActivate}
              className="rounded-md border border-primary-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-primary-600"
            >
              {text.editTimetable}
            </button>
          )}
          <button
            type="button"
            onClick={onDuplicate}
            disabled={!canDuplicate}
            aria-label={`${timetableLabel} ${text.duplicateTimetable}`}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-400"
          >
            {text.duplicate}
          </button>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`${timetableLabel} ${text.deleteTimetable}`}
              className="rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600"
            >
              {text.delete}
            </button>
          )}
        </div>
      </div>
      <TimetableGrid
        selectedCourses={courses}
        conflictCourseIds={conflictSummary.courseIds}
        compact
      />
    </Card>
  );
}

function DesktopWorkspaceSidebar({
  activeView,
  children,
  onViewChange,
}: {
  activeView: DesktopSidebarView;
  children: React.ReactNode;
  onViewChange: (view: DesktopSidebarView) => void;
}) {
  const text = useDictionary().pages.timetable;

  return (
    <aside className="sticky top-[96px] h-[calc(100vh-7rem)] self-start overflow-y-auto pr-1">
      <div
        className="sticky top-0 z-20 mb-3 grid grid-cols-2 rounded-lg border border-neutral-200 bg-white p-1 shadow-sm"
        aria-label={text.desktopPanelLabel}
      >
        <button
          type="button"
          aria-pressed={activeView === "courses"}
          onClick={() => onViewChange("courses")}
          className={clsx(
            "rounded-md px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
            activeView === "courses"
              ? "bg-primary-600 text-white"
              : "text-neutral-600 hover:bg-neutral-100",
          )}
        >
          {text.addCourse}
        </button>
        <button
          type="button"
          aria-pressed={activeView === "selected"}
          onClick={() => onViewChange("selected")}
          className={clsx(
            "rounded-md px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
            activeView === "selected"
              ? "bg-primary-600 text-white"
              : "text-neutral-600 hover:bg-neutral-100",
          )}
        >
          {text.selectedCourses}
        </button>
      </div>
      {children}
    </aside>
  );
}

function CoursePicker({
  activeTimetableId,
  compact = false,
  completionTypeFilter,
  completionTypes,
  dayFilters,
  departmentFilter,
  departments,
  endPeriodFilter,
  filteredCoursesCount,
  gradeFilter,
  grades,
  onCompletionTypeFilterChange,
  onDayFilterToggle,
  onDepartmentFilterChange,
  onEndPeriodFilterChange,
  onGradeFilterChange,
  onResetFilters,
  onSearchQueryChange,
  onStartPeriodFilterChange,
  onToggleCourse,
  onToggleCourseForTimetable,
  searchQuery,
  selectedIdSet,
  startPeriodFilter,
  timetableMemberships,
  visibleCourses,
  conflictCourseIds,
  idPrefix,
  listKey,
}: {
  activeTimetableId?: string;
  compact?: boolean;
  completionTypeFilter: string;
  completionTypes: string[];
  dayFilters: LectureDay[];
  departmentFilter: string;
  departments: string[];
  endPeriodFilter: string;
  filteredCoursesCount: number;
  gradeFilter: string;
  grades: string[];
  onCompletionTypeFilterChange: (value: string) => void;
  onDayFilterToggle: (day: LectureDay) => void;
  onDepartmentFilterChange: (value: string) => void;
  onEndPeriodFilterChange: (value: string) => void;
  onGradeFilterChange: (value: string) => void;
  onResetFilters: () => void;
  onSearchQueryChange: (value: string) => void;
  onStartPeriodFilterChange: (value: string) => void;
  onToggleCourse: (course: LectureTimetableCourse) => void;
  onToggleCourseForTimetable?: (
    course: LectureTimetableCourse,
    timetableId: string,
  ) => void;
  searchQuery: string;
  selectedIdSet: Set<string>;
  startPeriodFilter: string;
  timetableMemberships?: TimetableWorkspaceItem[];
  visibleCourses: LectureTimetableCourse[];
  conflictCourseIds: Set<string>;
  idPrefix: string;
  listKey: string;
}) {
  const text = useDictionary().pages.timetable;
  const locale = useLocale();
  const numberLocale = getNumberLocale(locale);
  const searchInputId = `${idPrefix}-course-search`;
  const dayFilterHelpId = `${idPrefix}-day-filter-help`;

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
            type="search"
            id={searchInputId}
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder={text.searchPlaceholder}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-500"
          />
        </div>

        <fieldset aria-describedby={dayFilterHelpId}>
          <legend className="text-sm font-semibold text-neutral-800">
            {text.classDay}
          </legend>
          <p id={dayFilterHelpId} className="mt-1 text-xs text-neutral-500">
            {text.classDayDescription}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {FILTERABLE_LECTURE_DAYS.map((day) => {
              const isChecked = dayFilters.includes(day);
              return (
                <label
                  key={day}
                  className={clsx(
                    "cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary-600",
                    isChecked
                      ? "border-primary-600 bg-primary-50 text-primary-800"
                      : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onDayFilterToggle(day)}
                    className="sr-only"
                  />
                  {getDayLabel(day, text)}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <p className="mb-1 text-sm font-semibold text-neutral-800">
            {text.classPeriod}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <FilterSelect
              id={`${idPrefix}-start-period-filter`}
              label={text.startPeriod}
              value={startPeriodFilter}
              onChange={onStartPeriodFilterChange}
              options={PERIOD_OPTIONS}
              allLabel={text.anyPeriod}
              getOptionLabel={(option) => formatPeriodLabel(Number(option), text)}
            />
            <FilterSelect
              id={`${idPrefix}-end-period-filter`}
              label={text.endPeriod}
              value={endPeriodFilter}
              onChange={onEndPeriodFilterChange}
              options={PERIOD_OPTIONS}
              allLabel={text.anyPeriod}
              getOptionLabel={(option) => formatPeriodLabel(Number(option), text)}
            />
          </div>
          {(dayFilters.length > 0 || startPeriodFilter || endPeriodFilter) && (
            <p className="mt-2 text-xs text-neutral-500" role="status">
              {text.timeFilterDescription}
            </p>
          )}
        </div>

        <div
          className={clsx(
            "grid gap-3",
            compact ? "grid-cols-1 2xl:grid-cols-3" : "sm:grid-cols-3",
          )}
        >
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
          className={clsx(
            "grid gap-3 overflow-y-auto pr-1",
            compact
              ? "max-h-[520px] grid-cols-1"
              : "max-h-[60vh] lg:max-h-[620px] lg:grid-cols-2 2xl:grid-cols-3",
          )}
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
                onToggleTimetable={
                  onToggleCourseForTimetable
                    ? (timetableId) =>
                        onToggleCourseForTimetable(course, timetableId)
                    : undefined
                }
                searchQuery={searchQuery}
                timetableMemberships={timetableMemberships?.map(
                  (timetable, timetableIndex) => ({
                    id: timetable.id,
                    label: formatTimetableLabel(timetableIndex, text),
                    shortLabel: String(timetableIndex + 1),
                    isActive: timetable.id === activeTimetableId,
                    isSelected: timetable.courseIds.includes(course.id),
                  }),
                )}
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
    <Modal
      isOpen
      title={text.addCourse}
      onClose={onClose}
      size="lg"
      overlayClassName="lg:hidden"
      className="rounded-t-2xl sm:rounded-xl"
      bodyClassName="max-h-[calc(88vh-64px)] pb-2"
    >
      {children}
    </Modal>
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
  onToggleTimetable,
  searchQuery,
  timetableMemberships,
}: {
  course: LectureTimetableCourse;
  isSelected: boolean;
  hasConflict: boolean;
  onToggle: () => void;
  onToggleTimetable?: (timetableId: string) => void;
  searchQuery: string;
  timetableMemberships?: Array<{
    id: string;
    label: string;
    shortLabel: string;
    isActive: boolean;
    isSelected: boolean;
  }>;
}) {
  const text = useDictionary().pages.timetable;
  const locale = useLocale();
  const visibleSearchMatches = getLectureCourseSearchMatches(
    course,
    searchQuery,
  ).filter((field) => VISIBLE_SEARCH_MATCH_FIELDS.includes(field));

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
          {visibleSearchMatches.length > 0 && (
            <p className="mt-2 text-xs font-semibold text-primary-700">
              {text.searchMatchedIn}: {visibleSearchMatches
                .map((field) => getSearchMatchFieldLabel(field, text))
                .join(", ")}
            </p>
          )}
        </div>
        {timetableMemberships && onToggleTimetable ? (
          <div className="shrink-0">
            <p className="mb-1 text-right text-[11px] font-semibold text-neutral-500">
              {text.addToTimetable}
            </p>
            <div
              className="flex flex-wrap justify-end gap-1"
              role="group"
              aria-label={`${course.courseName} ${text.addToTimetable}`}
            >
              {timetableMemberships.map((membership) => (
                <button
                  key={membership.id}
                  type="button"
                  aria-pressed={membership.isSelected}
                  aria-label={`${membership.label} ${
                    membership.isSelected
                      ? text.removeFromTimetable
                      : text.add
                  }`}
                  onClick={() => onToggleTimetable(membership.id)}
                  className={clsx(
                    "min-w-8 rounded-md border px-2 py-1.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-600",
                    membership.isSelected
                      ? "border-primary-600 bg-primary-600 text-white"
                      : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50",
                    membership.isActive && !membership.isSelected &&
                      "ring-2 ring-primary-100",
                  )}
                >
                  {membership.shortLabel}
                </button>
              ))}
            </div>
          </div>
        ) : (
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
        )}
      </div>

      <dl className="mt-3 grid gap-2 text-sm text-neutral-700">
        <CourseMeta label={text.time} value={course.classTime || text.timeMissing} />
        <CourseMeta label={text.place} value={course.place || text.placeMissing} />
        {course.areaType && (
          <CourseMeta label={text.areaType} value={course.areaType} />
        )}
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
  compact = false,
  fillAvailableHeight = false,
}: {
  selectedCourses: LectureTimetableCourse[];
  conflictCourseIds: Set<string>;
  compact?: boolean;
  fillAvailableHeight?: boolean;
}) {
  const text = useDictionary().pages.timetable;
  const coursesBeyondVisiblePeriods = getCoursesBeyondVisibleTimetable(
    selectedCourses,
  );

  return (
    <div
      className={clsx(
        "w-full max-w-full overflow-x-auto overflow-y-auto rounded-lg border border-neutral-200",
        fillAvailableHeight
          ? "xl:min-h-0 xl:flex-1 xl:max-h-none"
          : compact
            ? "max-h-[560px]"
            : "max-h-[72vh] lg:max-h-[760px]",
      )}
    >
      <div
        className={clsx(
          "max-w-none sm:w-full",
          compact ? "w-[520px]" : "w-[600px]",
        )}
      >
        <div className="sticky top-0 z-10 grid grid-cols-[38px_repeat(7,minmax(0,1fr))] border-b border-neutral-200 bg-neutral-50 text-center text-[11px] font-bold text-neutral-700 sm:grid-cols-[56px_repeat(7,minmax(0,1fr))] sm:text-sm">
          <div className="border-r border-neutral-200 px-1 py-2 sm:px-2 sm:py-3">
            {text.period}
          </div>
          {TIMETABLE_DAYS.map((day) => (
            <div
              key={day}
              className="border-r border-neutral-200 px-1 py-2 last:border-r-0 sm:px-2 sm:py-3"
            >
              {getDayLabel(day, text)}
            </div>
          ))}
        </div>

        {TIMETABLE_PERIODS.map((period) => (
          <div
            key={period}
            className={clsx(
              "grid grid-cols-[38px_repeat(7,minmax(0,1fr))] border-b border-neutral-200 last:border-b-0 sm:grid-cols-[56px_repeat(7,minmax(0,1fr))]",
              compact
                ? "min-h-[68px] sm:min-h-[76px]"
                : "min-h-[74px] sm:min-h-[96px] lg:min-h-[108px]",
            )}
          >
            <div className="flex flex-col items-center justify-center border-r border-neutral-200 bg-neutral-50 px-0.5 text-center font-semibold text-neutral-600">
              <span className="text-[11px] leading-4 sm:text-sm">
                {formatPeriodLabel(period, text)}
              </span>
              <span className="text-[8px] leading-3 text-neutral-500 sm:text-[10px]">
                {getPeriodTimeLabel(period)}
              </span>
            </div>
            {TIMETABLE_DAYS.map((day) => {
              const cellCourses = selectedCourses.filter((course) =>
                course.timeSlots.some((slot) =>
                  includesPeriod(slot, day, period),
                ),
              );

              return (
                <div
                  key={`${day}-${period}`}
                  className={clsx(
                    "border-r border-neutral-100 p-0.5 last:border-r-0 sm:p-1.5",
                    compact
                      ? "min-h-[68px] sm:min-h-[76px]"
                      : "min-h-[74px] sm:min-h-[96px] lg:min-h-[108px]",
                  )}
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
        {coursesBeyondVisiblePeriods.length > 0 && (
          <div className="border-t border-amber-200 bg-amber-50 p-3 text-amber-950">
            <p className="text-xs font-bold">{text.afterPeriodTitle}</p>
            <ul className="mt-1 space-y-1 text-[11px] leading-4">
              {coursesBeyondVisiblePeriods.map((course) => (
                <li key={course.id}>
                  <span className="font-semibold">{course.courseName}</span>
                  <span className="ml-1 text-amber-800">
                    {course.classTime || text.timeMissing}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
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
    [FILTERABLE_LECTURE_DAYS[5]]: text.dayLabels.sat,
    [FILTERABLE_LECTURE_DAYS[6]]: text.dayLabels.sun,
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

function parseOptionalPeriod(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getSearchMatchFieldLabel(
  field: LectureSearchMatchField,
  text: TimetableDictionary,
): string {
  const labels: Partial<Record<LectureSearchMatchField, string>> = {
    departmentName: text.department,
    collegeName: text.college,
    completionType: text.completionType,
    areaType: text.areaType,
    classTime: text.time,
    place: text.place,
    note: text.note,
    teamTeaching: text.teamTeaching,
  };

  return labels[field] ?? field;
}

function getCoursesForTimetable(
  timetable: TimetableWorkspaceItem,
  courseById: ReadonlyMap<string, LectureTimetableCourse>,
): LectureTimetableCourse[] {
  return timetable.courseIds
    .map((courseId) => courseById.get(courseId))
    .filter((course): course is LectureTimetableCourse => Boolean(course));
}

function formatTimetableLabel(index: number, text: TimetableDictionary): string {
  return `${text.timetable} ${index + 1}`;
}

function joinParts(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" · ");
}
