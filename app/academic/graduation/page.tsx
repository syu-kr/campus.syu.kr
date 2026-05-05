"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

import { Badge } from "@/app/components/Badge";
import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import {
  ADMISSION_TYPE_LABELS,
  CREDIT_CATEGORY_LABELS,
  CURRICULUM_CATEGORY_LABELS,
  MAJOR_TRACK_LABELS,
  calculateAutoTotalCredits,
  evaluateGraduation,
  getAvailableAdmissionTypes,
  getAvailableDepartments,
  getAvailableMajorTracks,
  getAvailableMajors,
  getCollegeById,
  getColleges,
  getCurriculumCourses,
  getDepartmentById,
  getGraduationMetadata,
  getInputCreditKeys,
  getRequirementSummary,
  isCompleteSelection,
  resolveRequirement,
  type AdmissionType,
  type CompletedCreditInput,
  type CreditCategoryKey,
  type CurriculumCourse,
  type CurriculumCourseCategory,
  type GraduationSelection,
  type MajorTrack,
} from "@/lib/graduation";
import {
  buildLectureMatchMap,
  getLectureMatches,
  type LectureTimetableDataset,
} from "@/lib/lecture-timetable";
import {
  ChoiceButton,
  CourseModal,
  CourseSelectCard,
  EmptyState,
  ResultBanner,
  Section,
  StepIndicator,
  SummaryRow,
} from "@/app/features/graduation/components";
import { Modal } from "@/app/components/Modal";
import {
  CURRICULUM_CATEGORIES,
  filterCurriculumCourses,
  getActiveStep,
  getCurriculumSummary,
  getEffectiveCurriculumCredits,
  getRequiredCredit,
  sumCurriculumCredits,
} from "@/app/features/graduation/utils";

const INITIAL_SELECTION: GraduationSelection = {
  collegeId: "",
  departmentId: "",
  majorId: undefined,
  admissionType: "",
  majorTrack: "",
};

interface CustomCourse {
  id: string;
  name: string;
  credits: number;
}

type CourseModalType = "curriculum" | null;
type PendingResetAction = null | (() => void);

type LectureApiResponse = {
  success: boolean;
  data?: LectureTimetableDataset;
};

export default function GraduationPage() {
  const metadata = getGraduationMetadata();
  const colleges = getColleges();

  const [selection, setSelection] =
    useState<GraduationSelection>(INITIAL_SELECTION);
  const [completedCredits, setCompletedCredits] =
    useState<CompletedCreditInput>({});
  const [selectedCurriculumCourseIds, setSelectedCurriculumCourseIds] = useState<
    string[]
  >([]);
  const [customMajorRequiredCourses, setCustomMajorRequiredCourses] = useState<
    CustomCourse[]
  >([]);
  const [courseModal, setCourseModal] = useState<CourseModalType>(null);
  const [activeCourseCategory, setActiveCourseCategory] =
    useState<CurriculumCourseCategory>("전필");
  const [courseSearch, setCourseSearch] = useState("");
  const [customCourseName, setCustomCourseName] = useState("");
  const [customCourseCredits, setCustomCourseCredits] = useState("");
  const [customCourseOpen, setCustomCourseOpen] = useState(false);
  const [pendingResetAction, setPendingResetAction] =
    useState<PendingResetAction>(null);
  const [lectureTimetable, setLectureTimetable] =
    useState<LectureTimetableDataset | null>(null);
  const [lectureLoading, setLectureLoading] = useState(false);

  const selectedCollege = selection.collegeId
    ? getCollegeById(selection.collegeId)
    : undefined;
  const departments = selection.collegeId
    ? getAvailableDepartments(selection.collegeId)
    : [];
  const selectedDepartment = selection.departmentId
    ? getDepartmentById(selection.departmentId)
    : undefined;
  const majors = selection.departmentId
    ? getAvailableMajors(selection.departmentId)
    : [];
  const selectedMajor = selection.majorId
    ? majors.find((major) => major.id === selection.majorId)
    : undefined;
  const admissionTypes = selection.departmentId
    ? getAvailableAdmissionTypes(selection.departmentId, selection.majorId)
    : [];
  const majorTracks =
    selection.departmentId && selection.admissionType
      ? getAvailableMajorTracks(
          selection.departmentId,
          selection.majorId,
          selection.admissionType,
        )
      : [];

  const requirement = useMemo(
    () => resolveRequirement(selection),
    [selection],
  );
  const curriculumCourses = selection.departmentId
    ? getCurriculumCourses(selection.departmentId, selection.majorId)
    : [];
  const lectureMatchMap = useMemo(
    () => buildLectureMatchMap(lectureTimetable?.courses ?? []),
    [lectureTimetable],
  );
  const getCourseCredits = (course: CurriculumCourse) =>
    getEffectiveCurriculumCredits(
      course,
      lectureMatchMap,
      selectedDepartment?.name,
    );
  const selectedCurriculumCourses = curriculumCourses.filter((course) =>
    selectedCurriculumCourseIds.includes(course.id),
  );
  const selectedRequiredLiberalCredits = sumCurriculumCredits(
    selectedCurriculumCourses,
    ["교필"],
    getCourseCredits,
  );
  const selectedAreaLiberalCredits = sumCurriculumCredits(
    selectedCurriculumCourses,
    ["교선"],
    getCourseCredits,
  );
  const selectedMajorRequiredCredits = sumCurriculumCredits(
    selectedCurriculumCourses,
    ["전필"],
    getCourseCredits,
  );
  const selectedMajorElectiveCredits = sumCurriculumCredits(
    selectedCurriculumCourses,
    ["전선"],
    getCourseCredits,
  );
  const selectedMajorCredits =
    selectedMajorRequiredCredits +
    selectedMajorElectiveCredits +
    customMajorRequiredCourses.reduce((sum, course) => sum + course.credits, 0);
  const calculatedCredits = useMemo(
    () => ({
      ...completedCredits,
      requiredLiberal: selectedRequiredLiberalCredits,
      areaLiberal: selectedAreaLiberalCredits,
      majorTotal:
        (completedCredits.majorTotal ?? 0) + selectedMajorCredits,
    }),
    [
      completedCredits,
      selectedAreaLiberalCredits,
      selectedMajorCredits,
      selectedRequiredLiberalCredits,
    ],
  );
  const evaluation = useMemo(
    () => evaluateGraduation(requirement, calculatedCredits, selection),
    [calculatedCredits, requirement, selection],
  );
  const requirementSummary = getRequirementSummary(requirement);
  const inputCreditKeys = requirement ? getInputCreditKeys(requirement) : [];
  const autoTotalCredits = calculateAutoTotalCredits(calculatedCredits);
  const activeStep = getActiveStep(selection, autoTotalCredits);
  const selectionComplete = isCompleteSelection(selection);
  const visibleInputCreditKeys = inputCreditKeys.filter(
    (key) => key !== "requiredLiberal" && key !== "areaLiberal",
  );
  const curriculumSummary = getCurriculumSummary(
    curriculumCourses,
    selectedCurriculumCourseIds,
    getCourseCredits,
  );
  const visibleCurriculumCourses = filterCurriculumCourses(
    curriculumCourses,
    activeCourseCategory,
    courseSearch,
    lectureMatchMap,
    selectedDepartment?.name,
  );
  const hasEnteredData =
    Object.values(completedCredits).some((value) => value != null && value > 0) ||
    selectedCurriculumCourseIds.length > 0 ||
    customMajorRequiredCourses.length > 0;

  const runWithResetConfirmation = (action: () => void) => {
    if (hasEnteredData) {
      setPendingResetAction(() => action);
      return;
    }

    action();
  };

  useEffect(() => {
    let ignore = false;

    async function loadLectureTimetable() {
      setLectureLoading(true);
      try {
        const response = await fetch("/api/lecture/timetable");
        const payload = (await response.json()) as LectureApiResponse;
        if (!ignore && payload.success && payload.data) {
          setLectureTimetable(payload.data);
        }
      } catch {
        if (!ignore) setLectureTimetable({ courses: [] });
      } finally {
        if (!ignore) setLectureLoading(false);
      }
    }

    loadLectureTimetable();

    return () => {
      ignore = true;
    };
  }, []);

  const handleCollegeSelect = (collegeId: string) => {
    runWithResetConfirmation(() => {
      setSelection({
        ...INITIAL_SELECTION,
        collegeId,
      });
      setCompletedCredits({});
      resetCourseSelections();
    });
  };

  const handleDepartmentSelect = (departmentId: string) => {
    runWithResetConfirmation(() => {
      setSelection((prev) => ({
        ...prev,
        departmentId,
        majorId: undefined,
        admissionType: "",
        majorTrack: "",
      }));
      setCompletedCredits({});
      resetCourseSelections();
    });
  };

  const handleMajorSelect = (majorId: string | undefined) => {
    runWithResetConfirmation(() => {
      setSelection((prev) => ({
        ...prev,
        majorId,
        admissionType: "",
        majorTrack: "",
      }));
      setCompletedCredits({});
      resetCourseSelections();
    });
  };

  const handleAdmissionTypeSelect = (admissionType: AdmissionType) => {
    runWithResetConfirmation(() => {
      setSelection((prev) => ({
        ...prev,
        admissionType,
        majorTrack: "",
      }));
      setCompletedCredits({});
      resetCourseSelections();
    });
  };

  const handleMajorTrackSelect = (majorTrack: MajorTrack) => {
    setSelection((prev) => ({
      ...prev,
      majorTrack,
    }));
    setCompletedCredits({});
    resetCourseSelections();
  };

  const handleCreditChange = (
    key: CreditCategoryKey | "totalCredits",
    rawValue: string,
  ) => {
    const value = rawValue === "" ? undefined : Number(rawValue);
    setCompletedCredits((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleReset = () => {
    runWithResetConfirmation(() => {
      setSelection(INITIAL_SELECTION);
      setCompletedCredits({});
      resetCourseSelections();
    });
  };

  const resetCourseSelections = () => {
    setSelectedCurriculumCourseIds([]);
    setCustomMajorRequiredCourses([]);
    setCourseModal(null);
    setActiveCourseCategory("전필");
    setCourseSearch("");
    setCustomCourseName("");
    setCustomCourseCredits("");
    setCustomCourseOpen(false);
  };

  const toggleCurriculumCourse = (courseId: string) => {
    setSelectedCurriculumCourseIds((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId],
    );
  };

  const openCurriculumModal = (category: CurriculumCourseCategory) => {
    setActiveCourseCategory(category);
    setCourseSearch("");
    setCourseModal("curriculum");
  };

  const handleAddCustomMajorCourse = () => {
    const name = customCourseName.trim();
    const credits = Number(customCourseCredits);
    if (!name || Number.isNaN(credits) || credits <= 0) return;

    setCustomMajorRequiredCourses((prev) => [
      ...prev,
      {
        id: `major-required-${Date.now()}`,
        name,
        credits,
      },
    ]);
    setCustomCourseName("");
    setCustomCourseCredits("");
  };

  const handleRemoveCustomMajorCourse = (courseId: string) => {
    setCustomMajorRequiredCourses((prev) =>
      prev.filter((course) => course.id !== courseId),
    );
  };
  const handleConfirmReset = () => {
    pendingResetAction?.();
    setPendingResetAction(null);
  };

  return (
    <Container className="pb-safe pt-6 md:pt-8 max-w-6xl">
      <div className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge color="blue">2025 요람 기준</Badge>
          <Badge color="gray">상세 계산기</Badge>
        </div>
        <h1 className="text-3xl font-bold text-neutral-900 md:text-4xl">
          졸업요건 확인
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600 sm:text-base">
          {metadata.sourceTitle}을 기준으로 조건별 요구학점과 입력한
          이수학점을 비교합니다. 최종 졸업 판정은 SU-WINGs와 학과사무실에서
          확인하세요.
        </p>
      </div>

      <StepIndicator activeStep={activeStep} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Section title="1. 대학 선택" description="소속 대학을 선택하세요.">
            <div className="grid gap-3 sm:grid-cols-2">
              {colleges.map((college) => (
                <ChoiceButton
                  key={college.id}
                  selected={selection.collegeId === college.id}
                  title={college.name}
                  onClick={() => handleCollegeSelect(college.id)}
                />
              ))}
            </div>
          </Section>

          <Section
            title="2. 학과/전공 선택"
            description={
              selectedCollege
                ? `${selectedCollege.name} 내 학과를 선택하세요.`
                : "대학을 먼저 선택하면 학과 목록이 표시됩니다."
            }
          >
            {departments.length === 0 ? (
              <EmptyState message="대학을 선택하면 학과 목록이 나타납니다." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {departments.map((department) => (
                  <ChoiceButton
                    key={department.id}
                    selected={selection.departmentId === department.id}
                    title={department.name}
                    description={
                      department.majors?.length
                        ? "세부전공 선택 필요"
                        : "세부전공 없음"
                    }
                    onClick={() => handleDepartmentSelect(department.id)}
                  />
                ))}
              </div>
            )}

            {selection.departmentId && majors.length > 0 && (
              <div className="mt-5 border-t border-neutral-200 pt-5">
                <p className="mb-3 text-sm font-semibold text-neutral-900">
                  세부전공
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {majors.map((major) => (
                    <ChoiceButton
                      key={major.id}
                      selected={selection.majorId === major.id}
                      title={major.name}
                      onClick={() => handleMajorSelect(major.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </Section>

          <Section
            title="3. 입학유형과 전공형태"
            description="선택 가능한 조합만 표시합니다. 근거가 불명확한 조합은 자동 계산에서 제외했습니다."
          >
            {!selection.departmentId ||
            (majors.length > 0 && !selection.majorId) ? (
              <EmptyState message="학과와 필요한 경우 세부전공을 먼저 선택하세요." />
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="mb-3 text-sm font-semibold text-neutral-900">
                    입학유형
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {admissionTypes.map((admissionType) => (
                      <ChoiceButton
                        key={admissionType}
                        selected={selection.admissionType === admissionType}
                        title={ADMISSION_TYPE_LABELS[admissionType]}
                        onClick={() =>
                          handleAdmissionTypeSelect(admissionType)
                        }
                      />
                    ))}
                  </div>
                  {admissionTypes.length === 0 && (
                    <EmptyState message="선택한 학과/전공에 연결된 입학유형 데이터가 없습니다." />
                  )}
                </div>

                <div>
                  <p className="mb-3 text-sm font-semibold text-neutral-900">
                    전공형태
                  </p>
                  {selection.admissionType ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {majorTracks.map((majorTrack) => (
                        <ChoiceButton
                          key={majorTrack}
                          selected={selection.majorTrack === majorTrack}
                          title={MAJOR_TRACK_LABELS[majorTrack]}
                          onClick={() => handleMajorTrackSelect(majorTrack)}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState message="입학유형을 먼저 선택하세요." />
                  )}
                </div>
              </div>
            )}
          </Section>

          <Section
            title="4. 이수학점 입력"
            description="선택한 학과의 과목을 검색해 선택하고, 부족한 학점은 SU-WINGs 기준으로 추가 입력하세요."
          >
            {!requirement ? (
              <EmptyState message="조건을 모두 선택하면 입력 항목이 표시됩니다." />
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2">
                  {CURRICULUM_CATEGORIES.map((category) => {
                    const summary = curriculumSummary[category];
                    const required =
                      category === "교필"
                        ? getRequiredCredit(requirementSummary, "requiredLiberal")
                        : category === "교선"
                          ? getRequiredCredit(requirementSummary, "areaLiberal")
                          : 0;
                    return (
                      <CourseSelectCard
                        key={category}
                        title={CURRICULUM_CATEGORY_LABELS[category]}
                        description={`${selectedDepartment?.name ?? "선택 학과"}의 ${CURRICULUM_CATEGORY_LABELS[category]} 과목을 선택하세요.`}
                        credits={summary.selectedCredits}
                        required={required}
                        count={summary.selectedCount}
                        onClick={() => openCurriculumModal(category)}
                        optional={required === 0}
                      />
                    );
                  })}
                </div>

                {curriculumCourses.length === 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                    선택한 학과의 과목 데이터가 아직 연결되지 않았습니다. 아래
                    입력란으로 이수학점을 직접 입력하세요.
                  </div>
                )}

                <div className="rounded-lg border border-primary-100 bg-primary-50 p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-primary-900">
                        총 취득학점 자동 계산
                      </p>
                      <p className="text-xs text-primary-700">
                        교양, 전공, 자유선택 등 아래 입력값을 합산합니다.
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-primary-700">
                      {autoTotalCredits}학점
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {visibleInputCreditKeys.map((key) => (
                    <label key={key} className="block">
                      <span className="mb-1.5 block text-sm font-medium text-neutral-800">
                        {key === "majorTotal"
                          ? "주전공 추가 이수학점"
                          : CREDIT_CATEGORY_LABELS[key]}
                      </span>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          inputMode="decimal"
                          value={completedCredits[key] ?? ""}
                          onChange={(event) =>
                            handleCreditChange(key, event.target.value)
                          }
                          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 pr-12 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                          placeholder="0"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500">
                          학점
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">
                        {key === "majorTotal"
                          ? `선택한 전공 과목(${selectedMajorCredits}학점)을 포함해 요구 ${getRequiredCredit(
                              requirementSummary,
                              key,
                            )}학점`
                          : `요구 ${getRequiredCredit(requirementSummary, key)}학점`}
                      </p>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </Section>

          <Section
            title="5. 판정 결과"
            description="학점은 자동 계산하고, 시험·실습·인증은 확인 필요로 분리합니다."
          >
            {!selectionComplete || !requirement ? (
              <EmptyState message="조건 선택과 이수학점 입력을 완료하면 결과가 표시됩니다." />
            ) : (
              <div className="space-y-5">
                <ResultBanner status={evaluation.overallStatus} />
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-600">
                  이 결과는 입력값과 제공 데이터 기준의 참고용 계산입니다. 공식
                  졸업 판정은 SU-WINGs와 학과사무실에서 반드시 확인하세요.
                </div>

                <div className="hidden overflow-hidden rounded-lg border border-neutral-200 sm:block">
                  <div className="grid grid-cols-[1fr_100px_100px_100px] bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-600">
                    <span>항목</span>
                    <span className="text-right">요구</span>
                    <span className="text-right">이수</span>
                    <span className="text-right">부족</span>
                  </div>
                  {evaluation.creditItems.map((item) => (
                    <div
                      key={item.key}
                      className="grid grid-cols-[1fr_100px_100px_100px] items-center border-t border-neutral-100 px-3 py-3 text-sm"
                    >
                      <span className="font-medium text-neutral-900">
                        {item.label}
                      </span>
                      <span className="text-right text-neutral-600">
                        {item.required}
                      </span>
                      <span className="text-right text-neutral-600">
                        {item.completed}
                      </span>
                      <span
                        className={clsx(
                          "text-right font-semibold",
                          item.shortage > 0
                            ? "text-red-600"
                            : "text-green-700",
                        )}
                      >
                        {item.shortage}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 sm:hidden">
                  {evaluation.creditItems.map((item) => (
                    <div
                      key={item.key}
                      className="rounded-lg border border-neutral-200 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-neutral-900">
                          {item.label}
                        </p>
                        <Badge
                          color={item.shortage > 0 ? "red" : "green"}
                          className="shrink-0"
                        >
                          {item.shortage > 0 ? "부족" : "충족"}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                        <div className="rounded bg-neutral-50 p-2">
                          <p className="text-xs text-neutral-500">요구</p>
                          <p className="font-bold text-neutral-900">
                            {item.required}
                          </p>
                        </div>
                        <div className="rounded bg-neutral-50 p-2">
                          <p className="text-xs text-neutral-500">이수</p>
                          <p className="font-bold text-neutral-900">
                            {item.completed}
                          </p>
                        </div>
                        <div className="rounded bg-neutral-50 p-2">
                          <p className="text-xs text-neutral-500">부족</p>
                          <p
                            className={clsx(
                              "font-bold",
                              item.shortage > 0
                                ? "text-red-600"
                                : "text-green-700",
                            )}
                          >
                            {item.shortage}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {evaluation.conditionItems.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="mb-2 text-sm font-semibold text-amber-900">
                      확인 필요 조건
                    </p>
                    <ul className="space-y-1.5 text-sm text-amber-800">
                      {evaluation.conditionItems.map((condition) => (
                        <li key={condition.id}>- {condition.label}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {evaluation.warnings.length > 0 && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <p className="mb-2 text-sm font-semibold text-blue-900">
                      학과 확인 안내
                    </p>
                    <ul className="space-y-1.5 text-sm text-blue-800">
                      {evaluation.warnings.map((warning) => (
                        <li key={warning}>- {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card hover={false} className="border border-neutral-200">
            <h2 className="text-lg font-bold text-neutral-900">선택 요약</h2>
            <div className="mt-4 space-y-3 text-sm">
              <SummaryRow label="대학" value={selectedCollege?.name} />
              <SummaryRow label="학과" value={selectedDepartment?.name} />
              <SummaryRow label="전공" value={selectedMajor?.name || "-"} />
              <SummaryRow
                label="입학유형"
                value={
                  selection.admissionType
                    ? ADMISSION_TYPE_LABELS[selection.admissionType]
                    : undefined
                }
              />
              <SummaryRow
                label="전공형태"
                value={
                  selection.majorTrack
                    ? MAJOR_TRACK_LABELS[selection.majorTrack]
                    : undefined
                }
              />
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                초기화
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                disabled={!requirement}
                className="flex-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-200"
              >
                참고용 출력
              </button>
            </div>
          </Card>

          <Card hover={false} className="border border-neutral-200">
            <h2 className="text-lg font-bold text-neutral-900">요건 요약</h2>
            {requirementSummary.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-500">
                조건을 선택하면 요구학점이 표시됩니다.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {requirementSummary.map((item) => (
                  <div
                    key={item.key}
                    className="rounded-lg bg-neutral-50 p-3 text-center"
                  >
                    <p className="text-xs text-neutral-500">{item.label}</p>
                    <p className="mt-1 text-xl font-bold text-primary-700">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card hover={false} className="border border-neutral-200">
            <h2 className="text-lg font-bold text-neutral-900">확인 안내</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              이 화면은 {metadata.sourceYear}학년도 요람 기준의 참고용
              계산기입니다. 최종 졸업 가능 여부는 SU-WINGs와 학과사무실에서
              확인하세요.
            </p>
          </Card>
        </aside>
      </div>

      {courseModal === "curriculum" && (
        <CourseModal
          title={`${selectedDepartment?.name ?? "학과"} 과목 선택`}
          onClose={() => setCourseModal(null)}
        >
          <div className="sticky -top-4 z-10 mb-4 rounded-lg border border-primary-100 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-semibold text-neutral-900">
                선택 합계 {curriculumSummary[activeCourseCategory].selectedCredits}
                학점
              </span>
              <span className="text-xs text-neutral-500">
                {curriculumSummary[activeCourseCategory].selectedCount}개 선택
              </span>
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs leading-5 text-neutral-600">
            시간표 API 기준 개설 정보를 함께 표시합니다.
            {lectureTimetable?.year || lectureTimetable?.semester ? (
              <span className="ml-1 font-semibold text-neutral-800">
                {[
                  lectureTimetable.year ? `${lectureTimetable.year}년` : "",
                  lectureTimetable.semester,
                ]
                  .filter(Boolean)
                  .join(" ")}
              </span>
            ) : null}
            {lectureLoading ? " 불러오는 중..." : ""}
          </div>

          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {CURRICULUM_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCourseCategory(category)}
                className={clsx(
                  "shrink-0 rounded-lg border px-3 py-2 text-sm font-semibold transition",
                  activeCourseCategory === category
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-neutral-200 text-neutral-600 hover:bg-neutral-50",
                )}
              >
                {CURRICULUM_CATEGORY_LABELS[category]}
                <span className="ml-1 text-xs">
                  {curriculumSummary[category].selectedCount}/
                  {curriculumSummary[category].totalCount}
                </span>
              </button>
            ))}
          </div>

          <input
            type="search"
            value={courseSearch}
            onChange={(event) => setCourseSearch(event.target.value)}
            placeholder="과목명, 학점, 상태 검색"
            className="mb-4 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          />

          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {visibleCurriculumCourses.length > 0 ? (
              visibleCurriculumCourses.map((course) => {
                const checked = selectedCurriculumCourseIds.includes(course.id);
                const matches = getLectureMatches(
                  course.name,
                  lectureMatchMap,
                  selectedDepartment?.name,
                );
                const apiCredit = matches.find(
                  (match) => match.credits != null,
                )?.credits;
                const creditLabel =
                  course.credits == null
                    ? apiCredit == null
                      ? "학점 확인 필요"
                      : `API ${apiCredit}학점`
                    : `${course.credits}학점`;
                const firstMatch = matches[0];

                return (
                  <label
                    key={course.id}
                    className={clsx(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition",
                      checked
                        ? "border-primary-400 bg-primary-50"
                        : "border-neutral-200 hover:border-neutral-300",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCurriculumCourse(course.id)}
                      className="mt-1 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-neutral-900">
                        {course.name}
                      </span>
                      <span className="block text-xs leading-5 text-neutral-500">
                        {CURRICULUM_CATEGORY_LABELS[course.category]} ·{" "}
                        {creditLabel}
                        {course.year && course.semester
                          ? ` · ${course.year}학년 ${course.semester}학기`
                          : ""}
                        {course.reviewStatus === "needsReview"
                          ? " · 확인 필요"
                          : ""}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                        <span
                          className={clsx(
                            "rounded px-1.5 py-0.5 font-medium",
                            matches.length > 0
                              ? "bg-green-50 text-green-700"
                              : "bg-neutral-100 text-neutral-500",
                          )}
                        >
                          {matches.length > 0
                            ? `올해 개설 ${matches.length}개`
                            : "개설 정보 없음"}
                        </span>
                        {firstMatch?.completionType && (
                          <span className="text-neutral-500">
                            {firstMatch.completionType}
                          </span>
                        )}
                        {firstMatch?.grade && (
                          <span className="text-neutral-500">
                            {firstMatch.grade}학년
                          </span>
                        )}
                        {firstMatch?.professor && (
                          <span className="text-neutral-500">
                            {firstMatch.professor}
                          </span>
                        )}
                      </span>
                    </span>
                  </label>
                );
              })
            ) : (
              <EmptyState message="검색 조건에 맞는 과목이 없습니다." />
            )}
          </div>

          <button
            type="button"
            onClick={() => setCustomCourseOpen((open) => !open)}
            className="mt-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-left text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            직접 입력 {customCourseOpen ? "접기" : "열기"}
          </button>

          {customCourseOpen && (
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px_auto]">
              <input
                type="text"
                value={customCourseName}
                onChange={(event) => setCustomCourseName(event.target.value)}
                placeholder="과목명"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              />
              <input
                type="number"
                min="0"
                value={customCourseCredits}
                onChange={(event) => setCustomCourseCredits(event.target.value)}
                placeholder="학점"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              />
              <button
                type="button"
                onClick={handleAddCustomMajorCourse}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
              >
                추가
              </button>
            </div>
          )}

          {customCourseOpen && (
            <div className="mt-4 space-y-2">
              {customMajorRequiredCourses.length === 0 ? (
                <EmptyState message="추가한 전공필수 과목이 없습니다." />
              ) : (
                customMajorRequiredCourses.map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-neutral-900">
                        {course.name}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {course.credits}학점
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomMajorCourse(course.id)}
                      className="shrink-0 rounded border border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
                    >
                      삭제
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setCourseModal(null)}
              className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
            >
              선택 완료
            </button>
            <button
              type="button"
              onClick={() => setCourseModal(null)}
              className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
            >
              닫기
            </button>
          </div>
        </CourseModal>
      )}

      <Modal
        isOpen={Boolean(pendingResetAction)}
        title="기존 입력을 초기화할까요?"
        description="이 선택을 바꾸면 입력한 학점과 선택한 과목을 유지할 수 없습니다."
        onClose={() => setPendingResetAction(null)}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-neutral-600">
            계속하면 현재 입력값과 과목 선택이 초기화됩니다. 취소하면 지금
            입력한 내용을 그대로 유지합니다.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setPendingResetAction(null)}
              className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleConfirmReset}
              className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
            >
              초기화하고 계속
            </button>
          </div>
        </div>
      </Modal>
    </Container>
  );
}

