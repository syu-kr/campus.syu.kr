"use client";
import { AcademicTimetablePresentation, AcademicTimetableCell, publicCourseFields } from "@/app/features/academic/AcademicTimetablePresentation";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { flushSync, preload } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";

import { Card } from "@/app/components/Card";
import { buttonStyles } from "@/app/components/Button";
import { Container } from "@/app/components/Container";
import { Icon } from "@/app/components/Icon";
import { Modal } from "@/app/components/Modal";
import { M3Select } from "@/app/components/M3Select";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import { PublicContentTranslation, useContentTranslation } from "@/app/components/ContentTranslation";
import { fetchJson } from "@/lib/fetch-json";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/routing";
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
  getVisibleTimetableDays,
  getVisibleTimetablePeriods,
  TIMETABLE_FILTER_PERIODS,
} from "@/lib/timetable-display";
import { getTimetableImageFilename } from "@/lib/timetable-image";
import { synchronizeTimetableScrollTop } from "@/lib/timetable-scroll";
import {
  getTimetableShareOwnerTokenKey,
  isTimetableShareForSemester,
} from "@/lib/timetable-share";

type TimetableDictionary = Dictionary["pages"]["timetable"];

interface TimetableApiResponse {
  success: boolean;
  data: LectureTimetableDataset;
  timestamp?: string;
  stale?: boolean;
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
  ownerToken?: string;
  error?: string;
}

const PERIOD_OPTIONS = TIMETABLE_FILTER_PERIODS.map(String);
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
type PickerLayout = "mobile" | "desktop" | "sidebar";

function getPickerLayout(): PickerLayout {
  if (window.matchMedia("(min-width: 1280px)").matches) return "sidebar";
  return window.matchMedia("(min-width: 1024px)").matches ? "desktop" : "mobile";
}

function subscribeToPickerLayout(onChange: () => void) {
  const queries = [1024, 1280].map((width) =>
    window.matchMedia(`(min-width: ${width}px)`),
  );
  queries.forEach((query) => query.addEventListener("change", onChange));
  return () => {
    queries.forEach((query) => query.removeEventListener("change", onChange));
  };
}

function getServerPickerLayout(): PickerLayout {
  return "mobile";
}

const emptyTimetableResponse: TimetableApiResponse = {
  success: false,
  data: { courses: [] },
};

const emptyShareResponse: TimetableShareResponse = {
  success: false,
};

export function TimetableBuilderClient() {
  preload("/api/lecture/timetable", {
    as: "fetch",
    crossOrigin: "anonymous",
    fetchPriority: "low",
  });
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dictionary = useDictionary();
  const locale = useLocale();
  const text = dictionary.pages.timetable;
  const shareId = searchParams.get("share")?.trim() ?? "";
  const pickerLayout = useSyncExternalStore(
    subscribeToPickerLayout,
    getPickerLayout,
    getServerPickerLayout,
  );

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
  const [isDeletingShare, setIsDeletingShare] = useState(false);
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [imageDownloadMessage, setImageDownloadMessage] = useState("");
  const [shareFallbackUrl, setShareFallbackUrl] = useState("");
  const [shareOwnerToken, setShareOwnerToken] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [previousSemesterDraft, setPreviousSemesterDraft] =
    useState<TimetableDraft | null>(null);
  const [draftPersistenceMode, setDraftPersistenceMode] =
    useState<DraftPersistenceMode>("pending");
  const [isDraftStorageAvailable, setIsDraftStorageAvailable] = useState(true);
  const comparisonScrollContainersRef = useRef(
    new Map<string, HTMLDivElement>(),
  );
  const isSynchronizingComparisonScrollRef = useRef(false);
  const timetableExportRef = useRef<HTMLDivElement>(null);

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
        noStore: false,
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

  useEffect(() => {
    try {
      setShareOwnerToken(
        shareId
          ? localStorage.getItem(getTimetableShareOwnerTokenKey(shareId)) || ""
          : "",
      );
    } catch {
      setShareOwnerToken("");
    }
  }, [shareId]);
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
      if (!isTimetableShareForSemester(shareResponse.data, response.data)) {
        setShareMessage(text.shareSemesterMismatch);
        return;
      }
      const sharedCourseIds = new Set(
        shareResponse.data.workspace
          ? shareResponse.data.workspace.timetables.flatMap((item) => item.courseIds)
          : shareResponse.data.courseIds,
      );
      const missingCount = [...sharedCourseIds].filter((id) => !courseById.has(id)).length;
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
      setShareMessage(
        missingCount > 0
          ? text.shareCoursesMissing.replace("{count}", String(missingCount))
          : text.shareLoaded,
      );
    }
  }, [
    appliedShareId,
    courseById,
    createdShareId,
    shareId,
    shareResponse,
    response.data,
    text.shareSemesterMismatch,
    text.shareCoursesMissing,
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
    setImageDownloadMessage("");
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

  function registerComparisonScrollContainer(
    timetableId: string,
    container: HTMLDivElement | null,
  ) {
    const containers = comparisonScrollContainersRef.current;
    if (!container) {
      containers.delete(timetableId);
      return;
    }

    const existingContainer = containers.values().next().value;
    if (existingContainer) {
      container.scrollTop = existingContainer.scrollTop;
    }
    containers.set(timetableId, container);
  }

  function synchronizeComparisonScroll(
    sourceTimetableId: string,
    scrollTop: number,
  ) {
    if (isSynchronizingComparisonScrollRef.current) return;

    isSynchronizingComparisonScrollRef.current = true;
    synchronizeTimetableScrollTop(
      sourceTimetableId,
      scrollTop,
      comparisonScrollContainersRef.current,
    );
    window.requestAnimationFrame(() => {
      isSynchronizingComparisonScrollRef.current = false;
    });
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

      if (!share.success || !share.shareId || !share.ownerToken) {
        setShareMessage(text.shareCreateFailed);
        setShareFallbackUrl("");
        return;
      }

      const nextUrl = `${pathname}?share=${encodeURIComponent(share.shareId)}`;
      setCreatedShareId(share.shareId);
      setAppliedShareId(share.shareId);
      try {
        localStorage.setItem(
          getTimetableShareOwnerTokenKey(share.shareId),
          share.ownerToken,
        );
      } catch {
        // Sharing remains available when browser storage is unavailable.
      }
      setShareOwnerToken(share.ownerToken);
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

  async function deleteShareLink() {
    if (
      !shareId ||
      !shareOwnerToken ||
      isDeletingShare ||
      !window.confirm(text.shareDeleteConfirm)
    ) {
      return;
    }

    setIsDeletingShare(true);
    try {
      const response = await fetch(
        `/api/lecture/timetable/shares/${encodeURIComponent(shareId)}`,
        {
          method: "DELETE",
          headers: { "x-owner-token": shareOwnerToken },
        },
      );
      if (!response.ok) throw new Error();

      try {
        localStorage.removeItem(getTimetableShareOwnerTokenKey(shareId));
      } catch {
        // The server-side deletion already succeeded.
      }
      setShareOwnerToken("");
      setCreatedShareId("");
      setAppliedShareId("");
      setShareFallbackUrl("");
      setShareMessage(text.shareDeleted);
      router.replace(pathname, { scroll: false });
    } catch {
      setShareMessage(text.shareDeleteFailed);
    } finally {
      setIsDeletingShare(false);
    }
  }

  async function downloadTimetableImage() {
    if (!hasShareableCourses || isDownloadingImage) return;

    // Mount the export-only grid for this action instead of retaining a second offscreen timetable.
    flushSync(() => setIsDownloadingImage(true));
    setImageDownloadMessage("");

    try {
      const exportSurface = timetableExportRef.current;
      if (!exportSurface) throw new Error("Timetable export surface unavailable");
      await document.fonts?.ready;
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(exportSurface, {
        backgroundColor: "#ffffff",
        cacheBust: true,
        height: exportSurface.scrollHeight,
        pixelRatio: 2,
        style: {
          left: "0",
          position: "static",
          top: "0",
        },
        width: exportSurface.scrollWidth,
      });
      const link = document.createElement("a");
      link.download = getTimetableImageFilename(
        response.data.year,
        response.data.semester,
      );
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setImageDownloadMessage(text.imageDownloaded);
    } catch {
      setImageDownloadMessage(text.imageDownloadFailed);
    } finally {
      setIsDownloadingImage(false);
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
      className="timetable-page min-w-0 max-w-[88rem] overflow-x-clip py-6 sm:py-8 2xl:max-w-[112rem]"
    >
      <div className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="m3-timetable-desktop-hint mb-2 inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
              {text.desktopHint}
            </span>
            <h1 className="mb-2 text-2xl font-bold text-neutral-900 sm:text-3xl">
              {text.title}
            </h1>
            <p className="text-sm text-neutral-600 sm:text-base">
              {semesterBaseLabel}
            </p>
            {response.data.updatedAt && (
              <p className="mt-1 text-xs text-neutral-500">
                {text.sourceUpdatedAt}: {formatSourceUpdatedAt(response.data.updatedAt, locale)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={toggleCompareMode}
            aria-pressed={timetableWorkspace.isCompareMode}
            className={buttonStyles("secondary", "m3-timetable-compare-toggle shrink-0")}
          >
            {timetableWorkspace.isCompareMode
              ? text.leaveCompareMode
              : text.enterCompareMode}
          </button>
        </div>
      </div>

      {response.stale && (
        <div className="mb-4" role="status">
          <StateCard
            type="warning"
            message={text.staleDataNotice}
            action={
              <>
                {response.timestamp && (
                  <p className="mb-2 text-xs text-amber-900">
                    {text.lastSuccessfulFetch}: {new Date(response.timestamp).toLocaleString(
                      locale === "ko" ? "ko-KR" : "en-US",
                      { timeZone: "Asia/Seoul" },
                    )}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className={buttonStyles("secondary")}
                >
                  {text.retry}
                </button>
              </>
            }
          />
        </div>
      )}

      <section data-empty={selectedCourses.length === 0} className="m3-timetable-summary mb-5 rounded-card border border-neutral-200 bg-white p-3 shadow-card sm:p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
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
            className={buttonStyles("primary")}
          >
            {isCreatingShare ? text.creatingShare : text.share}
          </button>
          <button
            type="button"
            onClick={downloadTimetableImage}
            disabled={!hasShareableCourses || isDownloadingImage}
            className={buttonStyles("secondary")}
          >
            {isDownloadingImage
              ? text.downloadingImage
              : text.downloadImage}
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
                className={buttonStyles("primary")}
              >
                {text.restorePreviousDraft}
              </button>
              <button
                type="button"
                onClick={discardPreviousSemesterDraft}
                className={buttonStyles("secondary")}
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
        {imageDownloadMessage && (
          <p className="mt-3 text-sm font-medium text-neutral-600" role="status">
            {imageDownloadMessage}
          </p>
        )}
        {(shareMessage ||
          (shouldLoadShareFromUrl &&
            (isShareFetching || !shareResponse.success))) && (
          <p
            className="mt-3 text-sm font-medium text-neutral-600"
            role="status"
          >
            {shouldLoadShareFromUrl && isShareFetching
              ? text.shareLoading
              : shareMessage ||
                (shouldLoadShareFromUrl
                  ? text.shareLoadFailed
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
        {shareOwnerToken && (
          <button
            type="button"
            onClick={deleteShareLink}
            disabled={isDeletingShare}
            className={buttonStyles("danger", "mt-2")}
          >
            {isDeletingShare ? text.deletingShare : text.deleteShare}
          </button>
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
        <div className="m3-timetable-loading space-y-6" role="status" aria-live="polite" aria-busy="true">
          <p>{dictionary.errorBoundary.loading}</p>
          <Skeleton height="360px" />
          <Skeleton count={3} height="120px" />
        </div>
      ) : !hasCourses ? (
        <StateCard
          type={isError || !response.success ? "error" : "info"}
          title={isError || !response.success ? text.loadFailedTitle : text.emptyCoursesTitle}
          message={isError || !response.success ? text.loadFailedMessage : text.emptyCoursesMessage}
          action={
            <button
              type="button"
              onClick={() => refetch()}
              className={buttonStyles("primary")}
            >
              {text.retry}
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          <section className="m3-timetable-workspace grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
            <div className="min-w-0">
              {timetableWorkspace.isCompareMode ? (
                <>
                  <div className="m3-timetable-comparison">
                    <div className="m3-timetable-comparison-header mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-neutral-900">
                          {text.compareTimetables}
                        </h2>
                        <p className="text-sm text-neutral-500">
                          {text.presentation.compareDescription}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={createAlternativeTimetable}
                        disabled={
                          timetableWorkspace.timetables.length >= MAX_TIMETABLES
                        }
                        className={buttonStyles("primary")}
                      >
                        {text.addTimetable}
                      </button>
                    </div>
                    <div className="m3-timetable-comparison-grid">
                      {timetableWorkspace.timetables.map(
                        (timetable, timetableIndex) => (
                          <ComparisonTimetableCard
                            key={timetable.id}
                            timetableIndex={timetableIndex}
                            referenceCourses={timetableWorkspace.timetables.flatMap((item) => getCoursesForTimetable(item, courseById))}
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
                            scrollContainerRef={(container) =>
                              registerComparisonScrollContainer(
                                timetable.id,
                                container,
                              )
                            }
                            onScroll={(scrollTop) =>
                              synchronizeComparisonScroll(
                                timetable.id,
                                scrollTop,
                              )
                            }
                          />
                        ),
                      )}
                    </div>
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

            {pickerLayout === "sidebar" && (
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
            )}

            {pickerLayout !== "sidebar" && (
              <div className="xl:hidden">
                <SelectedCoursesPanel
                  selectedCourses={selectedCourses}
                  conflictCourseIds={conflictSummary.courseIds}
                  completionStats={visibleCompletionStats}
                  totalCredits={totalCredits}
                  onClear={() => replaceSelectedCourses([])}
                  onRemove={toggleCourse}
                />
              </div>
            )}
          </section>

          {pickerLayout === "desktop" && (
            <div className="m3-timetable-inline-picker hidden lg:block xl:hidden">
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
          )}

          <button
            type="button"
            onClick={() => setIsPickerOpen(true)}
            className={buttonStyles("primary", "fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-4 right-4 z-30 max-w-[calc(100vw-2rem)] py-3 shadow-lg lg:hidden")}
          >
            {text.addCourse}
          </button>

          {pickerLayout === "mobile" && isPickerOpen && (
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
                collapseFilters
              />
            </MobileCoursePickerSheet>
          )}
        </div>
      )}
      {isDownloadingImage && <TimetableExportSurface
        containerRef={timetableExportRef}
        courseById={courseById}
        semesterBaseLabel={semesterBaseLabel}
        workspace={timetableWorkspace}
      />}
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
      <AcademicTimetablePresentation
        selectedCourses={selectedCourses}
        conflictCourseIds={conflictCourseIds}
        dayLabel={(day) => getDayLabel(day, text)}
        periodLabel={(period) => formatPeriodLabel(period, text)}
        periodTimeLabel={getPeriodTimeLabel}
        completionLabel={(value) => formatCompletionType(value, text)}
        renderWeek={(onOpenCourse) => (
          <TimetableGrid
            ariaLabel={text.weeklyTimetable}
            selectedCourses={selectedCourses}
            conflictCourseIds={conflictCourseIds}
            fillAvailableHeight={matchDesktopSidebar}
            onOpenCourse={onOpenCourse}
          />
        )}
      />
    </Card>
  );
}

function ComparisonTimetableCard({
  timetableIndex,
  referenceCourses,
  courses,
  isActive,
  canDuplicate,
  canRemove,
  onActivate,
  onDuplicate,
  onRemove,
  scrollContainerRef,
  onScroll,
}: {
  timetableIndex: number;
  referenceCourses: LectureTimetableCourse[];
  courses: LectureTimetableCourse[];
  isActive: boolean;
  canDuplicate: boolean;
  canRemove: boolean;
  onActivate: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  scrollContainerRef: (container: HTMLDivElement | null) => void;
  onScroll: (scrollTop: number) => void;
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
      as="section"
      aria-label={timetableLabel}
      data-timetable-index={timetableIndex}
      data-timetable-active={isActive}
      className={clsx(
        "m3-timetable-comparison-card min-w-0 overflow-hidden border",
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
              className={buttonStyles("secondary")}
            >
              {text.editTimetable}
            </button>
          )}
          <button
            type="button"
            onClick={onDuplicate}
            disabled={!canDuplicate}
            aria-label={`${timetableLabel} ${text.duplicateTimetable}`}
            className={buttonStyles("secondary")}
          >
            {text.duplicate}
          </button>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`${timetableLabel} ${text.deleteTimetable}`}
              className={buttonStyles("danger")}
            >
              {text.delete}
            </button>
          )}
        </div>
      </div>
      <AcademicTimetablePresentation
        contextLabel={timetableLabel}
        referenceCourses={referenceCourses}
        selectedCourses={courses}
        conflictCourseIds={conflictSummary.courseIds}
        dayLabel={(day) => getDayLabel(day, text)}
        periodLabel={(period) => formatPeriodLabel(period, text)}
        periodTimeLabel={getPeriodTimeLabel}
        completionLabel={(value) => formatCompletionType(value, text)}
        renderWeek={(onOpenCourse) => (
          <TimetableGrid
            ariaLabel={timetableLabel}
            selectedCourses={courses}
            conflictCourseIds={conflictSummary.courseIds}
            compact
            referenceCourses={referenceCourses}
            onOpenCourse={onOpenCourse}
            scrollContainerRef={scrollContainerRef}
            onScroll={onScroll}
          />
        )}
      />
    </Card>
  );
}

function TimetableExportSurface({
  containerRef,
  courseById,
  semesterBaseLabel,
  workspace,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  courseById: ReadonlyMap<string, LectureTimetableCourse>;
  semesterBaseLabel: string;
  workspace: TimetableWorkspace;
}) {
  const text = useDictionary().pages.timetable;
  const timetables = workspace.isCompareMode
    ? workspace.timetables
    : [getActiveTimetable(workspace)];

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 bg-white p-8 text-neutral-900"
      style={{
        left: "-10000px",
        width: workspace.isCompareMode ? "1320px" : "920px",
      }}
    >
      <div className="mb-6 flex items-end justify-between gap-6 border-b border-neutral-200 pb-4">
        <div>
          <p className="text-sm font-bold text-primary-700">SYU Campus</p>
          <h1 className="mt-1 text-2xl font-bold">{text.weeklyTimetable}</h1>
        </div>
        <p className="text-sm font-medium text-neutral-500">
          {semesterBaseLabel}
        </p>
      </div>
      <div
        className={clsx(
          "grid gap-6",
          timetables.length > 1 && "grid-cols-2",
        )}
      >
        {timetables.map((timetable, timetableIndex) => {
          const courses = getCoursesForTimetable(timetable, courseById);
          const conflictSummary = getConflictSummary(courses);
          const totalCredits = courses.reduce(
            (total, course) => total + (course.credits ?? 0),
            0,
          );

          return (
            <section
              key={timetable.id}
              className="min-w-0 rounded-lg border border-neutral-200 p-4"
            >
              <div className="mb-3 flex items-end justify-between gap-3">
                <h2 className="text-base font-bold">
                  {formatTimetableLabel(timetableIndex, text)}
                </h2>
                <p className="text-xs font-medium text-neutral-500">
                  {formatCredits(totalCredits, text)} · {courses.length}
                  {text.coursesUnit} · {text.conflicts}{" "}
                  {conflictSummary.pairCount}
                  {text.casesUnit}
                </p>
              </div>
              <TimetableGrid
                selectedCourses={courses}
                conflictCourseIds={conflictSummary.courseIds}
                compact
                exportMode
              />
            </section>
          );
        })}
      </div>
    </div>
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
        className="m3-timetable-view-switch sticky top-0 z-20 mb-3 grid grid-cols-2 rounded-lg border border-neutral-200 bg-white p-1 shadow-sm" role="group"
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
  collapseFilters = false,
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
  collapseFilters?: boolean;
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

        <FilterSelect
          id={`${idPrefix}-department-filter`}
          label={text.department}
          value={departmentFilter}
          onChange={onDepartmentFilterChange}
          options={departments}
          allLabel={text.allDepartments}
        />

        <details open={!collapseFilters || undefined} className="group/filters">
          <summary className={clsx(
            "flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-neutral-800 [&::-webkit-details-marker]:hidden",
            !collapseFilters && "hidden",
          )}>
            {text.advancedFilters}
            <Icon
              name="chevron-down"
              size={16}
              className="transition-transform group-open/filters:rotate-180"
            />
          </summary>
          <div className="space-y-4">
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
          </div>
        </details>

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
            className={buttonStyles("secondary")}
          >
            {text.reset}
          </button>
        </div>

        <div
          key={listKey}
          className={clsx(
            "m3-academic-course-results grid gap-3 overflow-y-auto pr-1",
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
      bodyClassName="m3-academic-picker-body max-h-[calc(88vh-64px)] pb-2"
    >
      <div className="m3-academic-picker-contents">{children}</div>
      <div className="m3-academic-picker-done">
        <button type="button" onClick={onClose} className={buttonStyles("primary", "w-full")}>
          {text.presentation.viewTimetable}
        </button>
      </div>
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
  const departmentOptions = id.endsWith("-department-filter") ? [...options].sort((first, second) => first.localeCompare(second, "en-US")) : [];
  const translation = useContentTranslation({ kind: "course", id: "__departments__" }, Object.fromEntries(departmentOptions.map((option, index) => [`departments.${index}`, option])));
  const optionLabel = (option: string) => departmentOptions.length ? translation.text(`departments.${departmentOptions.indexOf(option)}`, getOptionLabel ? getOptionLabel(option) : option) : getOptionLabel ? getOptionLabel(option) : option;
  return (
    <div>
      <label
        id={`${id}-label`}
        htmlFor={id}
        className="mb-1 block text-sm font-semibold text-neutral-800"
      >
        {label}
      </label>
      {id.endsWith("-department-filter") ? (
        <M3Select
          id={id}
          value={value}
          onValueChange={onChange}
          options={[
            { value: "", label: allLabel },
            ...options.map((option) => ({
              value: option,
              label: optionLabel(option),
            })),
          ]}
        />
      ) : <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-primary-500"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabel(option)}
          </option>
        ))}
      </select>}
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
  const translation = useContentTranslation({ kind: "course", id: course.id }, publicCourseFields(course));
  const visibleSearchMatches = getLectureCourseSearchMatches(
    course,
    searchQuery,
  ).filter((field) => VISIBLE_SEARCH_MATCH_FIELDS.includes(field));

  return (
    <article
      className={clsx(
        "rounded-card border bg-white p-4 shadow-card [content-visibility:auto] [contain-intrinsic-size:auto_240px]",
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
          <h3 lang={translation.lang} className="break-keep text-base font-bold text-neutral-900">
            {translation.text("courseName", course.courseName)}
          </h3>
          <p className="mt-1 text-sm text-neutral-600">
            <span lang={course.professor ? "ko" : locale} translate="no">{course.professor || text.professorMissing}</span>
            {course.departmentName && <> · <span lang={translation.lang}>{translation.text("departmentName", course.departmentName)}</span></>}
            {course.grade ? <> · {formatGrade(course.grade.toString(), text, locale)}</> : null}
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
              aria-label={`${translation.text("courseName", course.courseName)} ${text.addToTimetable}`}
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
            className={buttonStyles(isSelected ? "secondary" : "primary", "shrink-0")}
          >
            {isSelected ? text.delete : text.add}
          </button>
        )}
      </div>

      <dl className="mt-3 grid gap-2 text-sm text-neutral-700">
        <CourseMeta label={text.time} value={course.classTime || text.timeMissing} translate="no" />
        <CourseMeta label={text.place} value={translation.text("place", course.place || text.placeMissing)} />
        {course.areaType && (
          <CourseMeta label={text.areaType} value={translation.text("areaType", course.areaType)} />
        )}
        {course.note && <CourseMeta label={text.note} value={translation.text("note", course.note)} />}
      </dl>
    </article>
  );
}

function CourseMeta({ label, value, translate }: { label: string; value: string; translate?: "no" }) {
  return (
    <div className="grid grid-cols-[3rem_1fr] gap-2">
      <dt className="font-semibold text-neutral-500">{label}</dt>
      <dd translate={translate} className="break-keep text-neutral-800">{value}</dd>
    </div>
  );
}

function TimetableGrid({
  ariaLabel,
  selectedCourses,
  conflictCourseIds,
  compact = false,
  exportMode = false,
  fillAvailableHeight = false,
  referenceCourses,
  onOpenCourse,
  onScroll,
  scrollContainerRef,
}: {
  ariaLabel?: string;
  selectedCourses: LectureTimetableCourse[];
  conflictCourseIds: Set<string>;
  compact?: boolean;
  exportMode?: boolean;
  fillAvailableHeight?: boolean;
  referenceCourses?: LectureTimetableCourse[];
  onOpenCourse?: (course: LectureTimetableCourse) => void;
  onScroll?: (scrollTop: number) => void;
  scrollContainerRef?: (container: HTMLDivElement | null) => void;
}) {
  const text = useDictionary().pages.timetable;
  const visibleDays = getVisibleTimetableDays(referenceCourses ?? selectedCourses);
  const visiblePeriods = getVisibleTimetablePeriods(referenceCourses ?? selectedCourses);
  const gridTemplateColumns = `56px repeat(${visibleDays.length}, minmax(0, 1fr))`;
  const minimumGridWidth = 56 + visibleDays.length * 68;

  return (
    <div
      ref={scrollContainerRef}
      onScroll={(event) => onScroll?.(event.currentTarget.scrollTop)}
      role={exportMode ? undefined : "region"}
      aria-label={exportMode ? undefined : ariaLabel}
      tabIndex={exportMode ? undefined : 0}
      className={clsx(
        "w-full max-w-full rounded-lg border border-neutral-200",
        referenceCourses && "m3-timetable-compare-week",
        exportMode
          ? "overflow-visible"
          : "overflow-x-auto overflow-y-auto",
        !exportMode &&
          (fillAvailableHeight
            ? "xl:min-h-0 xl:flex-1 xl:max-h-none"
            : compact
              ? "max-h-[560px]"
              : "max-h-[72vh] lg:max-h-[760px]"),
      )}
    >
      <div
        className={clsx(
          "max-w-none",
          exportMode
            ? "w-full"
            : "w-full",
        )}
        style={exportMode ? undefined : { minWidth: `${minimumGridWidth}px` }}
      >
        <div
          className={clsx(
            "top-0 z-10 grid border-b border-neutral-200 bg-neutral-50 text-center text-[11px] font-bold text-neutral-700 sm:text-sm",
            !exportMode && "sticky",
          )}
          style={{ gridTemplateColumns }}
        >
          <div className="border-r border-neutral-200 px-1 py-2 sm:px-2 sm:py-3">
            {text.period}
          </div>
          {visibleDays.map((day) => (
            <div
              key={day}
              className="border-r border-neutral-200 px-1 py-2 last:border-r-0 sm:px-2 sm:py-3"
            >
              {getDayLabel(day, text)}
            </div>
          ))}
        </div>

        {visiblePeriods.map((period) => (
          <div
            key={period}
            data-timetable-period={period}
            className={clsx(
              "m3-timetable-period-row grid border-b border-neutral-200 last:border-b-0",
              compact
                ? exportMode
                  ? "min-h-[52px]"
                  : "min-h-[52px] sm:min-h-[56px]"
                : "min-h-[64px] sm:min-h-[68px] lg:min-h-[72px]",
            )}
            style={{ gridTemplateColumns }}
          >
            <div className="flex flex-col items-center justify-center border-r border-neutral-200 bg-neutral-50 px-0.5 text-center font-semibold text-neutral-600">
              <span className="text-[11px] leading-4 sm:text-sm">
                {formatPeriodLabel(period, text)}
              </span>
              <span className="text-[10px] leading-4 text-neutral-600">
                {getPeriodTimeLabel(period)}
              </span>
            </div>
            {visibleDays.map((day) => {
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
                      ? exportMode
                        ? "min-h-[52px]"
                        : "min-h-[52px] sm:min-h-[56px]"
                      : "min-h-[64px] sm:min-h-[68px] lg:min-h-[72px]",
                  )}
                >
                  <div className="space-y-1">
                    {cellCourses.map((course) => (
                      <PublicContentTranslation key={course.id} source={{ kind: "course", id: course.id }} content={publicCourseFields(course)}>{translation => <AcademicTimetableCell
                        course={course}
                        onOpenCourse={onOpenCourse}
                        className={clsx(
                          "min-w-0 rounded border px-1 py-1 text-[11px] leading-4 sm:px-2 sm:py-1.5",
                          conflictCourseIds.has(course.id)
                            ? "border-red-300 bg-red-50 text-red-900"
                            : "border-primary-200 bg-primary-50 text-primary-900",
                        )}
                      >
                        <p className="line-clamp-2 break-words font-bold sm:text-xs">
                          {translation.text("courseName", course.courseName)}
                        </p>
                        <p translate="no" className="mt-0.5 break-words text-[10px] text-neutral-700 sm:text-[11px]">
                          {course.classTime || text.timeMissing}
                        </p>
                        <p className="mt-0.5 hidden text-[10px] text-neutral-600 sm:line-clamp-2 sm:block">
                          <span lang="ko" translate="no">{course.professor}</span>{course.professor && course.place ? " · " : ""}{translation.text("place", course.place ?? "")}
                        </p>
                      </AcademicTimetableCell>}</PublicContentTranslation>
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
            className={buttonStyles("secondary")}
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
  const translation = useContentTranslation({ kind: "course", id: course.id }, publicCourseFields(course));

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
          <p lang={translation.lang} className="break-keep font-bold text-neutral-900">
            {translation.text("courseName", course.courseName)}
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            <span translate="no">{course.classTime || text.timeMissing}</span> · <span lang={course.professor ? "ko" : undefined} translate="no">{course.professor || text.professorMissing}</span> · {translation.text("place", course.place || text.placeMissing)}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className={buttonStyles("secondary", "shrink-0")}
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

  const term = normalizedSemester.match(/^(\d+)\s*(?:학기)?(?:\s*(정규|계절))?$/);
  const semesterLabel = term ? `Semester ${term[1]}${term[2] === "정규" ? " (regular)" : term[2] === "계절" ? " (seasonal)" : ""}`
    : normalizedSemester.replace(/하계(?:계절)?학기/g, "Summer session").replace(/동계(?:계절)?학기/g, "Winter session");
  const sourceLabel = [normalizedYear, semesterLabel]
    .filter(Boolean)
    .join(" ");

  return sourceLabel
    ? `Based on ${sourceLabel} ${text.semesterBase}.`
    : text.semesterBase;
}

function formatSourceUpdatedAt(value: string, locale: Locale) {
  if (locale === "ko") return value;
  const match = value.trim().match(/^['’]?(\d{2}|\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:\.?\s*\([^)]*\))?\.?$/);
  if (!match) return value;
  const year = Number(match[1]) + (match[1].length === 2 ? 2000 : 0), month = Number(match[2]), day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return value;
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(date);
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
