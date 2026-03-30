"use client";

import { useState } from "react";
import { Container } from "@/app/components/Container";
import {
  getRequiredCredits,
  getMajorCredits,
  getChapelCount,
  buildCheckItems,
  hasMajorType,
  isValidAdmissionYear,
  getTransferStudentRequiredCredits,
  ADMISSION_TYPES,
  DEPARTMENTS,
  MAJOR_TYPES,
  GraduationProfile,
  RequiredCredits,
} from "@/lib/graduation";

const STEPS = ["입학 유형", "학번 & 학과", "전공 유형"];

export default function GraduationPage() {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<GraduationProfile>({
    admissionType: "",
    admissionYear: "",
    dept: "",
    majorType: "",
    transferStudentTiming: "",
  });
  const [yearError, setYearError] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState(false);

  // 전과 시점 정보를 timing 값으로 변환
  const getTransferStudentTimingValue = (admissionType: string): string => {
    if (admissionType === "전과-1학년") return "1학년2학기";
    if (admissionType === "전과-2학년") return "2학년";
    if (admissionType === "전과-3학년") return "3학년";
    if (admissionType === "전과-4학년") return "4학년";
    return "";
  };

  const req: RequiredCredits | null = done
    ? {
        totalCredits: profile.admissionType.startsWith("전과")
          ? getTransferStudentRequiredCredits(
              profile.majorType,
              profile.dept,
              getTransferStudentTimingValue(profile.admissionType),
            )?.졸업 || 130
          : getRequiredCredits(
              profile.admissionType,
              Number(profile.admissionYear),
              profile.dept,
            ),
        majorCredits: profile.admissionType.startsWith("전과")
          ? getTransferStudentRequiredCredits(
              profile.majorType,
              profile.dept,
              getTransferStudentTimingValue(profile.admissionType),
            )?.졸업 || 130
          : getMajorCredits(
              profile.majorType,
              profile.admissionType,
              profile.dept,
            ),
        chapelCount: getChapelCount(profile.admissionType),
      }
    : null;

  const checkItems = buildCheckItems(profile, req);
  const groups = [...new Set(checkItems.map((i) => i.group))];

  function toggleCheck(id: string) {
    setChecks((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleGroup(group: string) {
    const ids = checkItems.filter((i) => i.group === group).map((i) => i.id);
    const allChecked = ids.every((id) => checks[id]);
    const next = { ...checks };
    ids.forEach((id) => {
      next[id] = !allChecked;
    });
    setChecks(next);
  }

  const checkedCount = checkItems.filter((i) => checks[i.id]).length;
  const totalCount = checkItems.length;
  const progress =
    totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  const canNext0 = !!profile.admissionType;
  const canNext1 =
    !!profile.dept &&
    !!profile.admissionYear &&
    !yearError &&
    isValidAdmissionYear(profile.admissionYear);
  const canNext2 = !!profile.majorType;

  const stepCanNext = [canNext0, canNext1, canNext2];

  function handleNext() {
    if (step < 2) setStep((s) => s + 1);
    else {
      setDone(true);
    }
  }

  function handleReset() {
    setDone(false);
    setStep(0);
    setYearError("");
    setChecks({});
    setProfile({
      admissionType: "",
      admissionYear: "",
      dept: "",
      majorType: "",
    });
  }

  return (
    <Container className="pb-safe pt-6 md:pt-8 max-w-2xl">
      {/* Header */}
      <div className="mb-10 md:mb-12">
        <h1 className="text-3xl font-bold text-neutral-900 md:text-4xl">
          졸업요건 확인
        </h1>
        <p className="mt-3 text-base text-neutral-500">
          자신의 상황에 맞는 항목을 선택하여 졸업요건을 확인하세요
        </p>
        {/* Reference Note */}
        <div className="mt-6 rounded-lg border-l-4 border-blue-400 bg-blue-50 p-4">
          <p className="text-sm text-blue-900 font-medium">
            <strong>참고사항</strong>
          </p>
          <ul className="mt-2 text-xs text-blue-800 space-y-1.5">
            <li>
              • 본 정보는 <strong>참고용</strong>이며, 공식 졸업요건을 활용한
              기준입니다.
            </li>
            <li>
              • 입학전형 및 학과별로 <strong>별도의 시험이나 추가 요건</strong>
              이 존재할 수 있습니다.
            </li>
            <li>
              • <strong>정확한 정보는 각 학과사무실로 문의</strong>하시기
              바랍니다.
            </li>
          </ul>
        </div>
      </div>

      {!done ? (
        <>
          {/* Step Indicator */}
          <div className="mb-10 flex items-center justify-between gap-1">
            {STEPS.map((stepName, i) => (
              <div key={i} className="flex flex-1 items-center gap-2">
                {/* Step Circle */}
                <div
                  className={`relative flex h-10 w-10 items-center justify-center rounded-full font-bold text-sm transition-all ${
                    i < step
                      ? "bg-primary-500 text-white shadow-md shadow-primary-500/30"
                      : i === step
                        ? "border-2 border-primary-500 text-primary-600 bg-primary-50 shadow-md shadow-primary-500/20"
                        : "border-2 border-neutral-200 text-neutral-400 bg-white"
                  }`}
                >
                  {i < step ? (
                    <svg
                      className="h-5 w-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>

                {/* Step Label */}
                <span
                  className={`text-xs font-medium hidden md:inline ${
                    i <= step ? "text-neutral-900" : "text-neutral-400"
                  }`}
                >
                  {stepName}
                </span>

                {/* Connector Line */}
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-1 ml-1 ${
                      i < step ? "bg-primary-500" : "bg-neutral-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step Content */}
          <div className="mb-8 rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
            {step === 0 && (
              <div>
                <div className="mb-2">
                  <label className="block text-sm font-bold text-neutral-900 uppercase tracking-wider">
                    {STEPS[0]}
                  </label>
                  <p className="text-xs text-neutral-500 mt-1">
                    귀하의 입학 유형을 선택하세요
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-6">
                  {ADMISSION_TYPES.map((type) => {
                    let displayLabel = type;
                    if (type === "전과-1학년")
                      displayLabel = "전과 (1학년 2학기)";
                    else if (type === "전과-2학년")
                      displayLabel = "전과 (2학년)";
                    else if (type === "전과-3학년")
                      displayLabel = "전과 (3학년)";
                    else if (type === "전과-4학년")
                      displayLabel = "전과 (4학년)";

                    return (
                      <button
                        key={type}
                        onClick={() =>
                          setProfile((p) => ({ ...p, admissionType: type }))
                        }
                        className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                          profile.admissionType === type
                            ? "bg-primary-500 border-2 border-primary-500 text-white shadow-md shadow-primary-500/30"
                            : "border-2 border-neutral-200 bg-white text-neutral-700 hover:border-primary-300 hover:bg-primary-50"
                        }`}
                      >
                        {displayLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                {/* Year Input */}
                <div className="mb-7">
                  <div className="mb-2">
                    <label className="block text-sm font-bold text-neutral-900 uppercase tracking-wider">
                      학번 (입학연도)
                    </label>
                    <p className="text-xs text-neutral-500 mt-1">
                      4자리 숫자로 입력하세요 (예: 2022)
                    </p>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="2022"
                    maxLength={4}
                    value={profile.admissionYear}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (
                        value === "" ||
                        (value.length <= 4 && /^\d*$/.test(value))
                      ) {
                        setProfile((p) => ({
                          ...p,
                          admissionYear: value,
                        }));

                        if (value.length === 4) {
                          if (!isValidAdmissionYear(value)) {
                            setYearError(
                              "입학연도는 2000~2026 사이여야 합니다",
                            );
                          } else {
                            setYearError("");
                          }
                        } else if (value.length > 0 && value.length < 4) {
                          setYearError("");
                        }
                      }
                    }}
                    className={`w-full rounded-lg border-2 px-4 py-3 text-lg font-semibold text-neutral-900 placeholder-neutral-400 transition-all focus:outline-none ${
                      yearError
                        ? "border-red-500 bg-red-50 focus:border-red-600 focus:ring-2 focus:ring-red-200"
                        : "border-neutral-200 bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                    }`}
                  />
                  {yearError && (
                    <div className="mt-2 flex items-center gap-2 text-sm font-medium text-red-600">
                      <svg
                        className="h-4 w-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                      </svg>
                      {yearError}
                    </div>
                  )}
                </div>

                {/* Department Selection */}
                <div>
                  <div className="mb-2">
                    <label className="block text-sm font-bold text-neutral-900 uppercase tracking-wider">
                      학과
                    </label>
                    <p className="text-xs text-neutral-500 mt-1">
                      해당하는 학과를 선택하세요
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 mt-4">
                    {DEPARTMENTS.map((dept) => (
                      <button
                        key={dept}
                        onClick={() => setProfile((p) => ({ ...p, dept }))}
                        className={`px-4 py-3 rounded-lg text-left text-sm font-semibold transition-all ${
                          profile.dept === dept
                            ? "bg-primary-500 border-2 border-primary-500 text-white shadow-md shadow-primary-500/30"
                            : "border-2 border-neutral-200 bg-white text-neutral-700 hover:border-primary-300"
                        }`}
                      >
                        {dept}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <div className="mb-2">
                  <label className="block text-sm font-bold text-neutral-900 uppercase tracking-wider">
                    {STEPS[2]}
                  </label>
                  <p className="text-xs text-neutral-500 mt-1">
                    해당 학과에서 가능한 전공 유형을 선택하세요
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-6">
                  {MAJOR_TYPES.filter((major) =>
                    hasMajorType(major, profile.dept, profile.admissionType),
                  ).map((major) => (
                    <button
                      key={major}
                      onClick={() =>
                        setProfile((p) => ({ ...p, majorType: major }))
                      }
                      className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                        profile.majorType === major
                          ? "bg-primary-500 border-2 border-primary-500 text-white shadow-md shadow-primary-500/30"
                          : "border-2 border-neutral-200 bg-white text-neutral-700 hover:border-primary-300 hover:bg-primary-50"
                      }`}
                    >
                      {major}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex-1 rounded-lg border-2 border-neutral-300 bg-white px-4 py-3 font-bold text-neutral-700 hover:bg-neutral-50 transition-all active:scale-95"
              >
                이전
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!stepCanNext[step]}
              className={`flex-1 md:flex-grow rounded-lg px-4 py-3 font-bold transition-all active:scale-95 ${
                stepCanNext[step]
                  ? "bg-primary-500 text-white hover:bg-primary-600 shadow-md shadow-primary-500/30"
                  : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
              }`}
            >
              {step < 2 ? `다음 (${step + 1}/3)` : "졸업요건 확인 →"}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Completion Banner */}
          {progress === 100 && (
            <div className="mb-8 rounded-xl border-2 border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 p-8 text-center shadow-sm">
              <div className="mb-2 text-4xl">🎓</div>
              <p className="text-xl font-bold text-green-700">축하합니다!</p>
              <p className="mt-2 text-base text-green-600">
                모든 졸업요건을 충족했습니다
              </p>
            </div>
          )}

          {/* Progress Bar */}
          <div className="mb-8 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-baseline justify-between">
              <span className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                진행률
              </span>
              <span className="text-3xl font-bold bg-gradient-to-r from-primary-500 to-primary-600 bg-clip-text text-transparent">
                {progress}%
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-neutral-200">
              <div
                className={`h-full transition-all duration-500 ${
                  progress === 100
                    ? "bg-gradient-to-r from-green-500 to-emerald-500"
                    : "bg-gradient-to-r from-primary-500 to-primary-600"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-3 text-right text-xs font-medium text-neutral-600">
              {checkedCount} / {totalCount} 항목 완료
            </p>
          </div>

          {/* Profile Summary */}
          <div className="mb-8 rounded-xl border border-primary-200 bg-primary-50 p-6">
            <p className="text-xs font-bold text-primary-600 uppercase tracking-wider">
              선택 정보
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-neutral-600">입학 유형</p>
                <p className="font-bold text-neutral-900">
                  {profile.admissionType}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-600">학번</p>
                <p className="font-bold text-neutral-900">
                  {profile.admissionYear}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-600">학과</p>
                <p className="font-bold text-neutral-900">{profile.dept}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-600">전공 유형</p>
                <p className="font-bold text-neutral-900">
                  {profile.majorType}
                </p>
              </div>
            </div>
          </div>

          {/* Checklist Groups */}
          <div className="space-y-4 mb-8">
            {groups.map((group) => {
              const items = checkItems.filter((i) => i.group === group);
              const allChecked = items.every((i) => checks[i.id]);
              const checkedItemsInGroup = items.filter(
                (i) => checks[i.id],
              ).length;

              return (
                <div
                  key={group}
                  className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
                >
                  {/* Group Header */}
                  <div className="flex items-center justify-between border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white px-6 py-4">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-neutral-900">{group}</h3>
                      <span className="text-xs font-semibold text-neutral-500 bg-neutral-200 px-2 py-1 rounded-full">
                        {checkedItemsInGroup}/{items.length}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleGroup(group)}
                      className="text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors"
                    >
                      {allChecked ? "해제" : "전부 체크"}
                    </button>
                  </div>

                  {/* Items */}
                  <div>
                    {items.map((item, idx) => (
                      <div
                        key={item.id}
                        onClick={() => toggleCheck(item.id)}
                        className={`flex cursor-pointer items-center gap-4 px-6 py-4 transition-colors ${
                          idx < items.length - 1
                            ? "border-b border-neutral-100"
                            : ""
                        } ${
                          checks[item.id]
                            ? "bg-primary-50"
                            : "hover:bg-neutral-50"
                        }`}
                      >
                        {/* Checkbox */}
                        <div
                          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                            checks[item.id]
                              ? "border-primary-500 bg-primary-500 shadow-md shadow-primary-500/30"
                              : "border-neutral-300 bg-white"
                          }`}
                        >
                          {checks[item.id] && (
                            <svg
                              className="h-4 w-4 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>

                        {/* Label */}
                        <span
                          className={`flex-1 text-sm font-medium transition-all ${
                            checks[item.id]
                              ? "text-neutral-400 line-through"
                              : "text-neutral-700"
                          }`}
                        >
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reset Button */}
          <button
            onClick={handleReset}
            className="w-full rounded-lg border-2 border-neutral-300 bg-white px-4 py-3 font-bold text-neutral-700 hover:bg-neutral-50 transition-all active:scale-95"
          >
            처음부터 다시 시작
          </button>
        </>
      )}
    </Container>
  );
}
