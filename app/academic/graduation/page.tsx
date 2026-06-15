"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

import { Badge } from "@/app/components/Badge";
import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { ContactModal } from "@/app/components/ContactModal";
import {
  ADMISSION_TYPE_LABELS,
  CREDIT_CATEGORY_LABELS,
  MAJOR_TRACK_LABELS,
  evaluateGraduation,
  getAvailableAdmissionTypes,
  getAvailableDepartments,
  getAvailableMajorTracks,
  getAvailableMajors,
  getChecklistItems,
  getCollegeById,
  getColleges,
  getDepartmentById,
  getGraduationMetadata,
  getInputCreditKeys,
  getMutuallyExclusiveCourseIds,
  getSourcesForSelection,
  getVerifiedCurriculumAvailability,
  getVerifiedCurriculumCourses,
  isCompleteSelection,
  resolveRequirement,
  summarizeSelectedCourses,
  type ChecklistAnswer,
  type CompletedCreditInput,
  type CreditCategoryKey,
  type EvaluationStatus,
  type GraduationSelection,
  type VerifiedCurriculumCourse,
} from "@/lib/graduation";

const STORAGE_KEY = "syu-campus-graduation-self-check-v2";
const MOBILE_DESKTOP_NOTICE_KEY =
  "syu-campus-graduation-mobile-desktop-notice-v1";

const INITIAL_SELECTION: GraduationSelection = {
  admissionYear: "",
  collegeId: "",
  departmentId: "",
  majorId: undefined,
  admissionType: "",
  majorTrack: "",
};

interface SavedState {
  selection: GraduationSelection;
  completedCredits: CompletedCreditInput;
  selectedCourseIds?: string[];
  checklistAnswers: Record<string, ChecklistAnswer>;
  plans: Record<string, string>;
}

export default function GraduationPage() {
  const metadata = getGraduationMetadata();
  const colleges = getColleges();
  const [selection, setSelection] =
    useState<GraduationSelection>(INITIAL_SELECTION);
  const [completedCredits, setCompletedCredits] =
    useState<CompletedCreditInput>({});
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [checklistAnswers, setChecklistAnswers] = useState<
    Record<string, ChecklistAnswer>
  >({});
  const [plans, setPlans] = useState<Record<string, string>>({});
  const [restored, setRestored] = useState(false);
  const [showMobileNotice, setShowMobileNotice] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);

  const departments = selection.collegeId
    ? getAvailableDepartments(selection.collegeId)
    : [];
  const majors = selection.departmentId
    ? getAvailableMajors(selection.departmentId)
    : [];
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
  const selectedCollege = getCollegeById(selection.collegeId);
  const selectedDepartment = getDepartmentById(selection.departmentId);
  const selectedMajor = majors.find((major) => major.id === selection.majorId);
  const requirement = useMemo(() => resolveRequirement(selection), [selection]);
  const creditKeys = requirement ? getInputCreditKeys(requirement) : [];
  const checklistItems = getChecklistItems(requirement, selection.departmentId);
  const sources = getSourcesForSelection(selection.departmentId);
  const curriculumAvailability = getVerifiedCurriculumAvailability(
    selection.departmentId,
    selection.admissionYear,
  );
  const verifiedCourses = getVerifiedCurriculumCourses(
    selection.departmentId,
    selection.admissionYear,
  );
  const selectedCourseSummary = summarizeSelectedCourses(
    verifiedCourses,
    selectedCourseIds,
  );
  const evaluation = evaluateGraduation(
    requirement,
    completedCredits,
    checklistAnswers,
    selection,
  );
  const selectionComplete = isCompleteSelection(selection);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as SavedState;
        setSelection(saved.selection);
        setCompletedCredits(saved.completedCredits);
        setSelectedCourseIds(saved.selectedCourseIds ?? []);
        setChecklistAnswers(saved.checklistAnswers);
        setPlans(saved.plans);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!restored) return;
    const saved: SavedState = {
      selection,
      completedCredits,
      selectedCourseIds,
      checklistAnswers,
      plans,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [
    checklistAnswers,
    completedCredits,
    plans,
    restored,
    selectedCourseIds,
    selection,
  ]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const dismissed =
      window.sessionStorage.getItem(MOBILE_DESKTOP_NOTICE_KEY) === "dismissed";

    if (mediaQuery.matches && !dismissed) {
      setShowMobileNotice(true);
    }
  }, []);

  const resetProgress = () => {
    setCompletedCredits({});
    setSelectedCourseIds([]);
    setChecklistAnswers({});
    setPlans({});
  };

  const updateSelection = (next: Partial<GraduationSelection>) => {
    setSelection((current) => ({ ...current, ...next }));
    resetProgress();
  };

  const handleCollegeSelect = (collegeId: string) => {
    setSelection({
      ...INITIAL_SELECTION,
      admissionYear: selection.admissionYear,
      collegeId,
    });
    resetProgress();
  };

  const handleDepartmentSelect = (departmentId: string) => {
    updateSelection({
      departmentId,
      majorId: undefined,
      admissionType: "",
      majorTrack: "",
    });
  };

  const handleAdmissionYearChange = (value: string) => {
    updateSelection({ admissionYear: value.replace(/\D/g, "").slice(0, 4) });
  };

  const handleMobileContinue = () => {
    window.sessionStorage.setItem(MOBILE_DESKTOP_NOTICE_KEY, "dismissed");
    setShowMobileNotice(false);
  };

  const handleMobileBack = () => {
    window.sessionStorage.setItem(MOBILE_DESKTOP_NOTICE_KEY, "dismissed");
    setShowMobileNotice(false);

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.href = "/academic";
  };

  const handleReset = () => {
    setSelection(INITIAL_SELECTION);
    resetProgress();
    window.localStorage.removeItem(STORAGE_KEY);
  };

  const handleCourseToggle = (courseId: string) => {
    const alreadySelected = selectedCourseIds.includes(courseId);
    const mutuallyExclusiveIds = getMutuallyExclusiveCourseIds(
      verifiedCourses,
      courseId,
    );
    const nextIds = alreadySelected
      ? selectedCourseIds.filter((id) => id !== courseId)
      : [
          ...selectedCourseIds.filter(
            (id) => !mutuallyExclusiveIds.includes(id),
          ),
          courseId,
        ];
    const summary = summarizeSelectedCourses(verifiedCourses, nextIds);

    setSelectedCourseIds(nextIds);
    setCompletedCredits((current) => ({
      ...current,
      ...summary.suggestedCredits,
    }));
  };

  const handleCourseSelectionReset = () => {
    setSelectedCourseIds([]);
    setCompletedCredits((current) => ({
      ...current,
      totalCredits: 0,
      requiredLiberal: 0,
      majorRequired: 0,
      majorElective: 0,
      majorTotal: 0,
    }));
  };

  return (
    <Container size="full" className="max-w-[88rem] pb-safe pt-6 md:pt-8">
      {showMobileNotice && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="graduation-mobile-notice-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/45 px-4 py-6"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <Badge color="yellow">데스크톱 권장</Badge>
            <h2
              id="graduation-mobile-notice-title"
              className="mt-3 text-lg font-bold text-neutral-900"
            >
              졸업요건 자가진단은 큰 화면이 더 편합니다
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              과목 선택과 학점 입력이 많아 데스크톱 사용을 권장합니다. 그래도
              모바일에서 계속 사용할 수 있습니다.
            </p>
            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={handleMobileContinue}
                className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
              >
                모바일로 계속 사용하기
              </button>
              <button
                type="button"
                onClick={handleMobileBack}
                className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                이전 페이지로 돌아가기
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="mb-8">
        <div className="mb-3 flex flex-wrap gap-2">
          <Badge color="blue">자가진단</Badge>
          <Badge color="yellow">참고용</Badge>
          <Badge color="gray">마지막 검증 {metadata.lastVerifiedAt}</Badge>
        </div>
        <h1 className="text-3xl font-bold text-neutral-900 md:text-4xl">
          졸업요건 자가진단
        </h1>
        <p className="mt-3 text-sm leading-6 text-neutral-600 sm:text-base">
          입학년도와 소속 조건에 맞는 참고 요건을 확인하고, SU-WINGs의
          이수학점과 비학점 조건을 직접 점검하세요. 이 결과는 공식 졸업 판정이
          아닙니다.
        </p>
      </header>

      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-5xl">
            현재 학점 기준은 {metadata.sourceTitle}을 구조화한 참고값입니다.
            자료별 갱신 시점이 달라 값이 다를 수 있으며, 편입·전과·다전공·교직
            과정은 결과와 함께 표시되는 공식 출처와 학과사무실을 반드시
            확인하세요.
          </p>
          <button
            type="button"
            onClick={() => setIsContactOpen(true)}
            className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            잘못된 정보 문의하기
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-8">
        <main className="space-y-6">
          <Section
            title="1. 내 조건 선택"
            description="입학년도부터 순서대로 선택하세요. 조건을 바꾸면 입력한 진단 내용은 초기화됩니다."
          >
            <FieldLabel label="입학년도">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={selection.admissionYear}
                onChange={(event) =>
                  handleAdmissionYearChange(event.target.value)
                }
                placeholder="예: 2024"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              />
              <p className="mt-2 text-xs leading-5 text-neutral-500">
                학번 대신 입학 연도를 입력하세요. 예: 2024년 입학이면
                <span className="font-semibold text-neutral-700"> 2024</span>
              </p>
            </FieldLabel>

            <ChoiceGroup
              label="대학"
              emptyMessage="입학년도를 먼저 선택하세요."
              disabled={!selection.admissionYear}
            >
              {colleges.map((college) => (
                <ChoiceButton
                  key={college.id}
                  selected={selection.collegeId === college.id}
                  title={college.name}
                  onClick={() => handleCollegeSelect(college.id)}
                />
              ))}
            </ChoiceGroup>

            <ChoiceGroup
              label="학과"
              emptyMessage="대학을 먼저 선택하세요."
              disabled={departments.length === 0}
            >
              {departments.map((department) => (
                <ChoiceButton
                  key={department.id}
                  selected={selection.departmentId === department.id}
                  title={department.name}
                  description={
                    department.majors?.length ? "세부전공 선택 필요" : undefined
                  }
                  onClick={() => handleDepartmentSelect(department.id)}
                />
              ))}
            </ChoiceGroup>

            {majors.length > 0 && (
              <ChoiceGroup label="세부전공">
                {majors.map((major) => (
                  <ChoiceButton
                    key={major.id}
                    selected={selection.majorId === major.id}
                    title={major.name}
                    onClick={() =>
                      updateSelection({
                        majorId: major.id,
                        admissionType: "",
                        majorTrack: "",
                      })
                    }
                  />
                ))}
              </ChoiceGroup>
            )}

            <ChoiceGroup
              label="입학유형"
              emptyMessage="학과와 세부전공을 먼저 선택하세요."
              disabled={
                !selection.departmentId ||
                (majors.length > 0 && !selection.majorId)
              }
            >
              {admissionTypes.map((type) => (
                <ChoiceButton
                  key={type}
                  selected={selection.admissionType === type}
                  title={ADMISSION_TYPE_LABELS[type]}
                  onClick={() =>
                    updateSelection({
                      admissionType: type,
                      majorTrack: "",
                    })
                  }
                />
              ))}
            </ChoiceGroup>

            <ChoiceGroup
              label="전공형태"
              emptyMessage="입학유형을 먼저 선택하세요."
              disabled={!selection.admissionType}
            >
              {majorTracks.map((track) => (
                <ChoiceButton
                  key={track}
                  selected={selection.majorTrack === track}
                  title={MAJOR_TRACK_LABELS[track]}
                  onClick={() => updateSelection({ majorTrack: track })}
                />
              ))}
            </ChoiceGroup>
          </Section>

          <Section
            title="2. 검증 과목 선택"
            description="원문 PDF 전체 페이지 검증이 완료된 학과는 입학년도와 관계없이 현재 검증된 2025년 교육과정을 참고 기준으로 과목 선택 합계를 지원합니다."
          >
            {!selection.departmentId || !selection.admissionYear ? (
              <EmptyState message="입학년도와 학과를 선택하면 검증 과목 지원 여부가 표시됩니다." />
            ) : !curriculumAvailability.available ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                {curriculumAvailability.reason}
              </div>
            ) : (
              <div className="space-y-4">
                <CurriculumCourseSelector
                  courses={verifiedCourses}
                  selectedCourseIds={selectedCourseIds}
                  summary={selectedCourseSummary}
                  onToggle={handleCourseToggle}
                  onReset={handleCourseSelectionReset}
                />
              </div>
            )}
          </Section>

          <Section
            title="3. 학점 입력"
            description="과목 선택으로 계산된 값은 참고용입니다. SU-WINGs의 인정학점, 교양 영역, 자유선택 학점을 확인해 직접 보정하세요."
          >
            {!requirement ? (
              <EmptyState message="내 조건을 모두 선택하면 입력할 학점 항목이 표시됩니다." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {creditKeys.map((key) => (
                  <CreditInput
                    key={key}
                    creditKey={key}
                    required={
                      key === "totalCredits"
                        ? requirement.totalCredits
                        : Number(requirement.categories[key] ?? 0)
                    }
                    value={completedCredits[key]}
                    onChange={(value) =>
                      setCompletedCredits((current) => ({
                        ...current,
                        [key]: value,
                      }))
                    }
                  />
                ))}
              </div>
            )}
          </Section>

          <Section
            title="4. 비학점 조건 체크"
            description="시험, 채플, 실습, 인증 등은 시스템이 자동 확인할 수 없습니다. 직접 확인한 상태를 기록하세요."
          >
            {checklistItems.length === 0 ? (
              <EmptyState message="내 조건을 모두 선택하면 확인할 체크리스트가 표시됩니다." />
            ) : (
              <div className="space-y-4">
                {checklistItems.map((item) => (
                  <ChecklistCard
                    key={item.id}
                    label={item.label}
                    description={item.description}
                    answer={checklistAnswers[item.id]}
                    plan={plans[item.id] ?? ""}
                    onAnswer={(answer) =>
                      setChecklistAnswers((current) => ({
                        ...current,
                        [item.id]: answer,
                      }))
                    }
                    onPlan={(plan) =>
                      setPlans((current) => ({ ...current, [item.id]: plan }))
                    }
                  />
                ))}
              </div>
            )}
          </Section>

          <Section
            title="5. 진단 결과"
            description="학점과 체크리스트를 분리해서 보여줍니다."
          >
            {!selectionComplete || !requirement ? (
              <EmptyState message="내 조건을 모두 선택하면 진단 결과가 표시됩니다." />
            ) : (
              <div className="space-y-5">
                <ResultBanner status={evaluation.overallStatus} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <SummaryMetric
                    label="전체 확인 항목"
                    value={evaluation.totalCheckCount}
                  />
                  <SummaryMetric
                    label="충족·해당없음"
                    value={evaluation.satisfiedCount}
                    color="green"
                  />
                  <SummaryMetric
                    label="남은 확인"
                    value={
                      evaluation.totalCheckCount - evaluation.satisfiedCount
                    }
                    color="yellow"
                  />
                </div>

                <div className="space-y-2">
                  {evaluation.creditItems.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 p-3 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-neutral-900">
                          {item.label}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          요구 {item.required} / 입력 {item.completed}
                        </p>
                      </div>
                      <Badge color={item.shortage > 0 ? "red" : "green"}>
                        {item.shortage > 0
                          ? `${item.shortage}학점 부족`
                          : "충족"}
                      </Badge>
                    </div>
                  ))}
                </div>

                {evaluation.warnings.length > 0 && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm font-semibold text-blue-900">
                      추가 확인 안내
                    </p>
                    <ul className="mt-2 space-y-1.5 text-sm leading-6 text-blue-800">
                      {evaluation.warnings.map((warning) => (
                        <li key={warning}>- {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section
            title="공식 근거"
            description="진단에 사용한 자료의 범위와 마지막 확인일입니다."
          >
            <div className="space-y-3">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="rounded-lg border border-neutral-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-neutral-900">
                        {source.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-neutral-500">
                        {source.scope}
                      </p>
                    </div>
                    <Badge color="gray">{source.verifiedAt} 확인</Badge>
                  </div>
                  {source.url && (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block text-sm font-semibold text-primary-700 hover:underline"
                    >
                      공식 페이지 열기
                    </a>
                  )}
                </div>
              ))}
            </div>
          </Section>
        </main>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card hover={false} className="border border-neutral-200">
            <h2 className="text-lg font-bold text-neutral-900">내 조건</h2>
            <div className="mt-4 space-y-3 text-sm">
              <SummaryRow
                label="입학년도"
                value={
                  selection.admissionYear
                    ? `${selection.admissionYear}년`
                    : undefined
                }
              />
              <SummaryRow label="대학" value={selectedCollege?.name} />
              <SummaryRow label="학과" value={selectedDepartment?.name} />
              <SummaryRow label="전공" value={selectedMajor?.name} />
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
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                초기화
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                disabled={!requirement}
                className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-200"
              >
                출력
              </button>
            </div>
          </Card>

          <Card hover={false} className="border border-neutral-200">
            <h2 className="text-lg font-bold text-neutral-900">진단 원칙</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-neutral-600">
              <li>- 입력하지 않은 항목은 충족으로 보지 않습니다.</li>
              <li>- 원문 대조가 끝난 확정 과목만 합계에 사용합니다.</li>
              <li>- 과목 합계는 SU-WINGs 인정학점으로 직접 보정합니다.</li>
              <li>- 학과별 시험·실습·인증은 직접 확인합니다.</li>
              <li>- 입력 내용은 현재 브라우저에만 저장됩니다.</li>
            </ul>
          </Card>

          <Card
            hover={false}
            className="border border-primary-100 bg-primary-50"
          >
            <h2 className="text-lg font-bold text-neutral-900">
              정보 수정 문의
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              오탈자, 학과별 기준 차이, 잘못된 과목 정보가 보이면 바로
              알려주세요. 확인 후 데이터에 반영하겠습니다.
            </p>
            <button
              type="button"
              onClick={() => setIsContactOpen(true)}
              className="mt-4 w-full rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              잘못된 정보 문의하기
            </button>
          </Card>
        </aside>
      </div>

      <ContactModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
      />
    </Container>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card hover={false} className="border border-neutral-200">
      <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-neutral-500">{description}</p>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-neutral-900">
        {label}
      </span>
      {children}
    </label>
  );
}

function ChoiceGroup({
  label,
  emptyMessage,
  disabled = false,
  children,
}: {
  label: string;
  emptyMessage?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 border-t border-neutral-100 pt-5">
      <p className="mb-3 text-sm font-semibold text-neutral-900">{label}</p>
      {disabled ? (
        <EmptyState message={emptyMessage ?? "이전 조건을 먼저 선택하세요."} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {children}
        </div>
      )}
    </div>
  );
}

function ChoiceButton({
  selected,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  title: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "rounded-lg border p-3 text-left transition",
        selected
          ? "border-primary-500 bg-primary-50 ring-2 ring-primary-100"
          : "border-neutral-200 hover:border-primary-300 hover:bg-primary-50/40",
      )}
    >
      <span className="block font-semibold text-neutral-900">{title}</span>
      {description && (
        <span className="mt-1 block text-xs text-neutral-500">
          {description}
        </span>
      )}
    </button>
  );
}

function CurriculumCourseSelector({
  courses,
  selectedCourseIds,
  summary,
  onToggle,
  onReset,
}: {
  courses: VerifiedCurriculumCourse[];
  selectedCourseIds: string[];
  summary: ReturnType<typeof summarizeSelectedCourses>;
  onToggle: (courseId: string) => void;
  onReset: () => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("ko");
  const filteredCourses = courses.filter(
    (course) =>
      !normalizedQuery ||
      course.name.toLocaleLowerCase("ko").includes(normalizedQuery) ||
      course.category.toLocaleLowerCase("ko").includes(normalizedQuery),
  );
  const groupedCourses = new Map<string, VerifiedCurriculumCourse[]>();
  for (const course of filteredCourses) {
    const label = `${course.year}학년 ${course.semester}학기`;
    groupedCourses.set(label, [...(groupedCourses.get(label) ?? []), course]);
  }
  const groups = Array.from(groupedCourses);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-green-900">
              원문 대조 완료 과목 {courses.length}개
            </p>
            <p className="mt-1 text-xs leading-5 text-green-800">
              선택한 과목의 합계를 학점 입력란에 반영합니다.
              재수강·대체과목·편입 인정학점은 SU-WINGs 기준으로 직접 수정하세요.
              택1 및 동일 과목의 양 학기 개설분은 하나만 선택됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onReset}
            disabled={selectedCourseIds.length === 0}
            className="rounded-lg border border-green-300 bg-white px-3 py-2 text-xs font-semibold text-green-800 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            과목 선택 초기화
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <CourseSummaryMetric
            label="선택 과목"
            value={summary.courseCount}
            unit="개"
          />
          <CourseSummaryMetric label="선택 학점" value={summary.totalCredits} />
          <CourseSummaryMetric
            label="교양필수"
            value={summary.categoryCredits["교필"] ?? 0}
          />
          <CourseSummaryMetric
            label="주전공"
            value={
              (summary.categoryCredits["전필"] ?? 0) +
              (summary.categoryCredits["전선"] ?? 0)
            }
          />
        </div>
      </div>

      {summary.conflicts.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold">중복 선택은 한 과목만 합산했습니다</p>
          <ul className="mt-2 space-y-1 text-xs leading-5">
            {summary.conflicts.map((conflict) => (
              <li key={conflict.groupLabel}>
                - {conflict.groupLabel}: {conflict.courseNames.join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
        자동 반영: 총 취득학점, 교양필수, 전공필수, 전공선택, 주전공. 교양선택의
        세부 영역과 자유선택 학점은 과목표만으로 확정할 수 없어 직접 입력해야
        합니다.
      </div>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="과목명 또는 이수구분 검색"
        className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
      />

      {groups.length === 0 ? (
        <EmptyState message="검색 조건에 맞는 과목이 없습니다." />
      ) : (
        <div className="space-y-5">
          {groups.map(([label, groupCourses]) => (
            <div key={label}>
              <p className="mb-2 text-sm font-semibold text-neutral-900">
                {label}
              </p>
              <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                {groupCourses.map((course) => {
                  const selected = selectedCourseIds.includes(course.id);
                  return (
                    <button
                      key={course.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onToggle(course.id)}
                      className={clsx(
                        "flex items-start justify-between gap-3 rounded-lg border p-3 text-left transition",
                        selected
                          ? "border-primary-500 bg-primary-50 ring-2 ring-primary-100"
                          : "border-neutral-200 hover:border-primary-300 hover:bg-primary-50/40",
                      )}
                    >
                      <span>
                        <span className="block text-sm font-semibold text-neutral-900">
                          {course.name}
                        </span>
                        <span className="mt-1 block text-xs text-neutral-500">
                          {course.category}
                        </span>
                      </span>
                      <Badge color={selected ? "blue" : "gray"}>
                        {course.credits}학점
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CourseSummaryMetric({
  label,
  value,
  unit = "학점",
}: {
  label: string;
  value: number;
  unit?: string;
}) {
  return (
    <div className="rounded-lg bg-white p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 font-bold text-neutral-900">
        {value}
        <span className="ml-1 text-xs font-medium text-neutral-500">
          {unit}
        </span>
      </p>
    </div>
  );
}

function CreditInput({
  creditKey,
  required,
  value,
  onChange,
}: {
  creditKey: CreditCategoryKey | "totalCredits";
  required: number;
  value?: number;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <label className="rounded-lg border border-neutral-200 p-4">
      <span className="block text-sm font-semibold text-neutral-900">
        {CREDIT_CATEGORY_LABELS[creditKey]}
      </span>
      <span className="mt-1 block text-xs text-neutral-500">
        참고 요구학점 {required}
      </span>
      <div className="relative mt-3">
        <input
          type="number"
          min="0"
          inputMode="decimal"
          value={value ?? ""}
          onChange={(event) =>
            onChange(
              event.target.value === ""
                ? undefined
                : Number(event.target.value),
            )
          }
          placeholder="0"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 pr-12 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500">
          학점
        </span>
      </div>
    </label>
  );
}

function ChecklistCard({
  label,
  description,
  answer,
  plan,
  onAnswer,
  onPlan,
}: {
  label: string;
  description?: string;
  answer?: ChecklistAnswer;
  plan: string;
  onAnswer: (answer: ChecklistAnswer) => void;
  onPlan: (plan: string) => void;
}) {
  const choices: Array<{ value: ChecklistAnswer; label: string }> = [
    { value: "satisfied", label: "이수" },
    { value: "incomplete", label: "미이수" },
    { value: "notApplicable", label: "해당 없음" },
  ];

  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <p className="font-semibold text-neutral-900">{label}</p>
      {description && (
        <p className="mt-1 text-xs leading-5 text-neutral-500">{description}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {choices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            onClick={() => onAnswer(choice.value)}
            className={clsx(
              "rounded-lg border px-3 py-2 text-xs font-semibold transition",
              answer === choice.value
                ? "border-primary-500 bg-primary-50 text-primary-700"
                : "border-neutral-200 text-neutral-600 hover:bg-neutral-50",
            )}
          >
            {choice.label}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={plan}
        onChange={(event) => onPlan(event.target.value)}
        placeholder="확인 방법이나 이수 계획을 메모하세요"
        className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
      />
    </div>
  );
}

function ResultBanner({ status }: { status: EvaluationStatus }) {
  const config =
    status === "short"
      ? {
          title: "부족하거나 미이수인 항목이 있습니다",
          description: "부족 학점과 미이수 조건을 확인해 계획을 세우세요.",
          className: "border-red-200 bg-red-50 text-red-900",
        }
      : status === "checkRequired"
        ? {
            title: "직접 확인할 항목이 남아 있습니다",
            description:
              "입력하지 않은 조건과 공식 확인이 필요한 내용을 확인하세요.",
            className: "border-amber-200 bg-amber-50 text-amber-900",
          }
        : {
            title: "입력값 기준으로 모든 항목을 확인했습니다",
            description:
              "최종 졸업 판정은 SU-WINGs와 학과사무실에서 확인하세요.",
            className: "border-green-200 bg-green-50 text-green-900",
          };

  return (
    <div className={clsx("rounded-lg border p-4", config.className)}>
      <p className="font-bold">{config.title}</p>
      <p className="mt-1 text-sm leading-6">{config.description}</p>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  color = "blue",
}: {
  label: string;
  value: number;
  color?: "blue" | "green" | "yellow";
}) {
  const colors = {
    blue: "bg-primary-50 text-primary-700",
    green: "bg-green-50 text-green-700",
    yellow: "bg-amber-50 text-amber-700",
  };
  return (
    <div className={clsx("rounded-lg p-3 text-center", colors[color])}>
      <p className="text-xs">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-semibold text-neutral-900">
        {value || "-"}
      </span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
      {message}
    </div>
  );
}
