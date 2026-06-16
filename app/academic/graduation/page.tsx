"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

import { Badge } from "@/app/components/Badge";
import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { ContactModal } from "@/app/components/ContactModal";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import {
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
import { localizePath, type Dictionary, type Locale } from "@/lib/i18n";

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

type GraduationText = Dictionary["pages"]["graduation"];

function getCourseCategoryLabel(text: GraduationText, category: string) {
  return (
    text.courseCategories[category as keyof typeof text.courseCategories] ??
    category
  );
}

export default function GraduationPage() {
  const dictionary = useDictionary();
  const locale = useLocale();
  const text = dictionary.pages.graduation;
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
    locale,
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
    locale,
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

    window.location.href = localizePath("/academic", locale);
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
            <Badge color="yellow">{text.mobileBadge}</Badge>
            <h2
              id="graduation-mobile-notice-title"
              className="mt-3 text-lg font-bold text-neutral-900"
            >
              {text.mobileTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              {text.mobileDescription}
            </p>
            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={handleMobileContinue}
                className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
              >
                {text.mobileContinue}
              </button>
              <button
                type="button"
                onClick={handleMobileBack}
                className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                {text.mobileBack}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="mb-8">
        <div className="mb-3 flex flex-wrap gap-2">
          <Badge color="blue">{text.badges.selfCheck}</Badge>
          <Badge color="yellow">{text.badges.referenceOnly}</Badge>
          <Badge color="gray">
            {text.badges.lastVerifiedPrefix} {metadata.lastVerifiedAt}
          </Badge>
        </div>
        <h1 className="text-3xl font-bold text-neutral-900 md:text-4xl">
          {text.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-neutral-600 sm:text-base">
          {text.description}
        </p>
      </header>

      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-5xl">
            {text.sourceNoticePrefix}
            {metadata.sourceTitle}
            {text.sourceNoticeSuffix}
          </p>
          <button
            type="button"
            onClick={() => setIsContactOpen(true)}
            className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            {text.contactWrongInfo}
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-8">
        <main className="space-y-6">
          <Section
            title={text.sections.selectionTitle}
            description={text.sections.selectionDescription}
          >
            <FieldLabel label={text.labels.admissionYear}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={selection.admissionYear}
                onChange={(event) =>
                  handleAdmissionYearChange(event.target.value)
                }
                placeholder={text.placeholders.admissionYear}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              />
              <p className="mt-2 text-xs leading-5 text-neutral-500">
                {text.helps.admissionYear}
                <span className="font-semibold text-neutral-700"> 2024</span>
              </p>
            </FieldLabel>

            <ChoiceGroup
              label={text.labels.college}
              emptyMessage={text.empty.admissionYearFirst}
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
              label={text.labels.department}
              emptyMessage={text.empty.collegeFirst}
              disabled={departments.length === 0}
            >
              {departments.map((department) => (
                <ChoiceButton
                  key={department.id}
                  selected={selection.departmentId === department.id}
                  title={department.name}
                  description={
                    department.majors?.length
                      ? text.helps.majorRequired
                      : undefined
                  }
                  onClick={() => handleDepartmentSelect(department.id)}
                />
              ))}
            </ChoiceGroup>

            {majors.length > 0 && (
              <ChoiceGroup label={text.labels.detailMajor}>
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
              label={text.labels.admissionType}
              emptyMessage={text.empty.departmentAndMajorFirst}
              disabled={
                !selection.departmentId ||
                (majors.length > 0 && !selection.majorId)
              }
            >
              {admissionTypes.map((type) => (
                <ChoiceButton
                  key={type}
                  selected={selection.admissionType === type}
                  title={text.admissionTypes[type]}
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
              label={text.labels.majorTrack}
              emptyMessage={text.empty.admissionTypeFirst}
              disabled={!selection.admissionType}
            >
              {majorTracks.map((track) => (
                <ChoiceButton
                  key={track}
                  selected={selection.majorTrack === track}
                  title={text.majorTracks[track]}
                  onClick={() => updateSelection({ majorTrack: track })}
                />
              ))}
            </ChoiceGroup>
          </Section>

          <Section
            title={text.sections.coursesTitle}
            description={text.sections.coursesDescription}
          >
            {!selection.departmentId || !selection.admissionYear ? (
              <EmptyState message={text.empty.courseAvailability} />
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
                  text={text}
                  locale={locale}
                  onToggle={handleCourseToggle}
                  onReset={handleCourseSelectionReset}
                />
              </div>
            )}
          </Section>

          <Section
            title={text.sections.creditsTitle}
            description={text.sections.creditsDescription}
          >
            {!requirement ? (
              <EmptyState message={text.empty.credits} />
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
                    text={text}
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
            title={text.sections.checklistTitle}
            description={text.sections.checklistDescription}
          >
            {checklistItems.length === 0 ? (
              <EmptyState message={text.empty.checklist} />
            ) : (
              <div className="space-y-4">
                {checklistItems.map((item) => (
                  <ChecklistCard
                    key={item.id}
                    label={item.label}
                    description={item.description}
                    answer={checklistAnswers[item.id]}
                    plan={plans[item.id] ?? ""}
                    text={text}
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
            title={text.sections.resultsTitle}
            description={text.sections.resultsDescription}
          >
            {!selectionComplete || !requirement ? (
              <EmptyState message={text.empty.results} />
            ) : (
              <div className="space-y-5">
                <ResultBanner status={evaluation.overallStatus} text={text} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <SummaryMetric
                    label={text.metrics.totalChecks}
                    value={evaluation.totalCheckCount}
                  />
                  <SummaryMetric
                    label={text.metrics.satisfied}
                    value={evaluation.satisfiedCount}
                    color="green"
                  />
                  <SummaryMetric
                    label={text.metrics.remaining}
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
                          {text.result.requiredInput
                            .replace("{required}", String(item.required))
                            .replace("{completed}", String(item.completed))}
                        </p>
                      </div>
                      <Badge color={item.shortage > 0 ? "red" : "green"}>
                        {item.shortage > 0
                          ? text.result.creditShortage.replace(
                              "{shortage}",
                              String(item.shortage),
                            )
                          : text.result.satisfied}
                      </Badge>
                    </div>
                  ))}
                </div>

                {evaluation.warnings.length > 0 && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm font-semibold text-blue-900">
                      {text.result.additionalCheckTitle}
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
            title={text.sections.sourcesTitle}
            description={text.sections.sourcesDescription}
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
                    <Badge color="gray">
                      {source.verifiedAt} {text.sources.verifiedSuffix}
                    </Badge>
                  </div>
                  {source.url && (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block text-sm font-semibold text-primary-700 hover:underline"
                    >
                      {text.sources.openOfficialPage}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </Section>
        </main>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card hover={false} className="border border-neutral-200">
            <h2 className="text-lg font-bold text-neutral-900">
              {text.sidebar.myConditions}
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              <SummaryRow
                label={text.labels.admissionYear}
                value={
                  selection.admissionYear
                    ? `${selection.admissionYear}${text.units.year}`
                    : undefined
                }
              />
              <SummaryRow label={text.labels.college} value={selectedCollege?.name} />
              <SummaryRow
                label={text.labels.department}
                value={selectedDepartment?.name}
              />
              <SummaryRow label={text.labels.major} value={selectedMajor?.name} />
              <SummaryRow
                label={text.labels.admissionType}
                value={
                  selection.admissionType
                    ? text.admissionTypes[selection.admissionType]
                    : undefined
                }
              />
              <SummaryRow
                label={text.labels.majorTrack}
                value={
                  selection.majorTrack
                    ? text.majorTracks[selection.majorTrack]
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
                {text.sidebar.reset}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                disabled={!requirement}
                className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-200"
              >
                {text.sidebar.print}
              </button>
            </div>
          </Card>

          <Card hover={false} className="border border-neutral-200">
            <h2 className="text-lg font-bold text-neutral-900">
              {text.sidebar.principlesTitle}
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-neutral-600">
              {text.sidebar.principles.map((principle) => (
                <li key={principle}>- {principle}</li>
              ))}
            </ul>
          </Card>

          <Card
            hover={false}
            className="border border-primary-100 bg-primary-50"
          >
            <h2 className="text-lg font-bold text-neutral-900">
              {text.sidebar.contactTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              {text.sidebar.contactDescription}
            </p>
            <button
              type="button"
              onClick={() => setIsContactOpen(true)}
              className="mt-4 w-full rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              {text.contactWrongInfo}
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
        <EmptyState message={emptyMessage ?? ""} />
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
  text,
  locale,
  onToggle,
  onReset,
}: {
  courses: VerifiedCurriculumCourse[];
  selectedCourseIds: string[];
  summary: ReturnType<typeof summarizeSelectedCourses>;
  text: GraduationText;
  locale: Locale;
  onToggle: (courseId: string) => void;
  onReset: () => void;
}) {
  const [query, setQuery] = useState("");
  const searchLocale = locale === "ko" ? "ko" : "en-US";
  const normalizedQuery = query.trim().toLocaleLowerCase(searchLocale);
  const filteredCourses = courses.filter(
    (course) =>
      !normalizedQuery ||
      course.name.toLocaleLowerCase(searchLocale).includes(normalizedQuery) ||
      course.category.toLocaleLowerCase(searchLocale).includes(normalizedQuery),
  );
  const groupedCourses = new Map<string, VerifiedCurriculumCourse[]>();
  for (const course of filteredCourses) {
    const label = text.courses.groupLabel
      .replace("{year}", String(course.year))
      .replace("{semester}", String(course.semester));
    groupedCourses.set(label, [...(groupedCourses.get(label) ?? []), course]);
  }
  const groups = Array.from(groupedCourses);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-green-900">
              {text.courses.verifiedPrefix} {courses.length}
              {text.courses.countSuffix}
            </p>
            <p className="mt-1 text-xs leading-5 text-green-800">
              {text.courses.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onReset}
            disabled={selectedCourseIds.length === 0}
            className="rounded-lg border border-green-300 bg-white px-3 py-2 text-xs font-semibold text-green-800 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {text.courses.reset}
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <CourseSummaryMetric
            label={text.courses.selectedCourses}
            value={summary.courseCount}
            unit={text.units.item}
          />
          <CourseSummaryMetric
            label={text.courses.selectedCredits}
            value={summary.totalCredits}
            unit={text.units.credit}
          />
          <CourseSummaryMetric
            label={text.creditCategories.requiredLiberal}
            value={summary.categoryCredits["교필"] ?? 0}
            unit={text.units.credit}
          />
          <CourseSummaryMetric
            label={text.creditCategories.majorTotal}
            value={
              (summary.categoryCredits["전필"] ?? 0) +
              (summary.categoryCredits["전선"] ?? 0)
            }
            unit={text.units.credit}
          />
        </div>
      </div>

      {summary.conflicts.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold">{text.courses.duplicateTitle}</p>
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
        {text.courses.autoApply}
      </div>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={text.placeholders.courseSearch}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
      />

      {groups.length === 0 ? (
        <EmptyState message={text.empty.courseSearch} />
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
                          {getCourseCategoryLabel(text, course.category)}
                        </span>
                      </span>
                      <Badge color={selected ? "blue" : "gray"}>
                        {course.credits}
                        {text.units.credit}
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
  unit,
}: {
  label: string;
  value: number;
  unit: string;
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
  text,
  onChange,
}: {
  creditKey: CreditCategoryKey | "totalCredits";
  required: number;
  value?: number;
  text: GraduationText;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <label className="rounded-lg border border-neutral-200 p-4">
      <span className="block text-sm font-semibold text-neutral-900">
        {text.creditCategories[creditKey]}
      </span>
      <span className="mt-1 block text-xs text-neutral-500">
        {text.result.requiredCredits.replace("{required}", String(required))}
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
          {text.units.credit}
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
  text,
  onAnswer,
  onPlan,
}: {
  label: string;
  description?: string;
  answer?: ChecklistAnswer;
  plan: string;
  text: GraduationText;
  onAnswer: (answer: ChecklistAnswer) => void;
  onPlan: (plan: string) => void;
}) {
  const choices: Array<{ value: ChecklistAnswer; label: string }> = [
    { value: "satisfied", label: text.checklist.satisfied },
    { value: "incomplete", label: text.checklist.incomplete },
    { value: "notApplicable", label: text.checklist.notApplicable },
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
        placeholder={text.placeholders.checklistPlan}
        className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
      />
    </div>
  );
}

function ResultBanner({
  status,
  text,
}: {
  status: EvaluationStatus;
  text: GraduationText;
}) {
  const config =
    status === "short"
      ? {
          title: text.banners.shortTitle,
          description: text.banners.shortDescription,
          className: "border-red-200 bg-red-50 text-red-900",
        }
      : status === "checkRequired"
        ? {
            title: text.banners.checkRequiredTitle,
            description: text.banners.checkRequiredDescription,
            className: "border-amber-200 bg-amber-50 text-amber-900",
          }
        : {
            title: text.banners.satisfiedTitle,
            description: text.banners.satisfiedDescription,
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
