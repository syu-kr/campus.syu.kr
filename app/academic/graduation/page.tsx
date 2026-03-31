"use client";

import { useState } from "react";
import { Container } from "@/app/components/Container";
import {
  getChapelCount,
  buildCheckItems,
  isValidAdmissionYear,
  getCollegeById,
  getDepartmentsByCollege,
  getMajors,
  getGraduationRequirementsWithAdmission,
  getAvailableAdmissionTypes,
  COLLEGES,
  DEPARTMENTS_BY_COLLEGE,
  ADMISSION_TYPES,
  GraduationProfileV2,
  CheckItem,
} from "@/lib/graduation";

const STEPS = [
  "대학 선택",
  "학과 선택",
  "전공 선택",
  "입학유형 & 입학년도",
  "졸업요건 확인",
];

export default function GraduationPage() {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<GraduationProfileV2>({
    collegeId: "",
    deptId: "",
    majorId: undefined,
    admissionType: "",
    admissionYear: "",
    hasDoubleMinor: false,
    hasTeachingCertificate: false,
  });
  const [yearError, setYearError] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState(false);

  // 현재 선택된 대학
  const selectedCollege = profile.collegeId
    ? getCollegeById(profile.collegeId)
    : null;

  // 현재 선택된 대학의 학과 목록
  const departmentsList = profile.collegeId
    ? getDepartmentsByCollege(profile.collegeId)
    : [];

  // 현재 선택된 학과
  const selectedDept = profile.deptId
    ? DEPARTMENTS_BY_COLLEGE[profile.deptId]
    : null;

  // 현재 선택된 학과의 전공 목록
  const majorsList = profile.deptId ? getMajors(profile.deptId) : undefined;

  // 선택된 학과에서 가능한 입학유형
  const availableAdmissionTypes = profile.deptId
    ? getAvailableAdmissionTypes(profile.deptId)
    : ADMISSION_TYPES;

  // 졸업요건 정보 (admission type 반영)
  const graduationReq =
    done && profile.deptId && profile.admissionType
      ? getGraduationRequirementsWithAdmission(
          profile.deptId,
          profile.admissionType,
          profile.majorId,
        )
      : null;

  // 기존 호환성을 위한 임시 데이터 생성 (buildCheckItems 사용)
  const checkItems: CheckItem[] =
    done && profile.deptId
      ? [
          // buildCheckItems 기본 항목
          ...buildCheckItems(
            {
              admissionType: profile.admissionType,
              admissionYear: profile.admissionYear,
              dept: selectedDept?.name || "",
              majorType: "단일전공", // 기본값
              transferStudentTiming: profile.admissionType?.startsWith("전과")
                ? profile.admissionYear
                : undefined,
            },
            {
              totalCredits: graduationReq?.totalCredits || 130,
              majorCredits: graduationReq?.majorCredits || 30,
              chapelCount: getChapelCount(profile.admissionType),
            },
          ),
        ]
      : [];

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

  // Step validation
  const canNext0 = !!profile.collegeId;
  const canNext1 = !!profile.deptId;
  const canNext2 = majorsList ? !!profile.majorId : true; // 전공이 없으면 자동 통과
  const canNext3 =
    !!profile.admissionType &&
    !!profile.admissionYear &&
    !yearError &&
    isValidAdmissionYear(profile.admissionYear);
  const canNext4 = true; // 마지막 단계

  const stepCanNext = [canNext0, canNext1, canNext2, canNext3, canNext4];

  function handleNext() {
    // 모든 스텝을 순차적으로 진행
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      // 마지막 스텝에 도달하면 완료 화면으로
      if (step + 1 === STEPS.length - 1) {
        setDone(true);
      }
    } else {
      setDone(true);
    }
  }

  function handlePrev() {
    // 완료 화면에서 돌아올 때는 done을 false로 설정
    if (step === 4 && done) {
      setDone(false);
    }
    if (step > 0) {
      setStep((s) => s - 1);
    }
  }

  function handleReset() {
    setDone(false);
    setStep(0);
    setYearError("");
    setChecks({});
    setProfile({
      collegeId: "",
      deptId: "",
      majorId: undefined,
      admissionType: "",
      admissionYear: "",
      hasDoubleMinor: false,
      hasTeachingCertificate: false,
    });
  }

  return (
    <Container className="pb-safe pt-6 md:pt-8 max-w-3xl">
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

      {/* Step Indicator - Always shown */}
      <div className="mb-10 flex items-center gap-1">
        {STEPS.map((stepName, i) => (
          <div key={i} className="flex flex-1 items-center gap-1 md:gap-2">
            {/* Step Circle */}
            <div
              className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-bold text-sm transition-all ${
                i < step || (done && i < STEPS.length)
                  ? "bg-primary-500 text-white shadow-md shadow-primary-500/30"
                  : i === step && !done
                    ? "border-2 border-primary-500 text-primary-600 bg-primary-50 shadow-md shadow-primary-500/20"
                    : "border-2 border-neutral-200 text-neutral-400 bg-white"
              }`}
            >
              {i < step || (done && i < STEPS.length) ? (
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
              className={`text-xs font-medium hidden sm:inline truncate ${
                i <= step || done ? "text-neutral-900" : "text-neutral-400"
              }`}
            >
              {stepName}
            </span>

            {/* Connector Line */}
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-1 ml-1 ${
                  i < step || done ? "bg-primary-500" : "bg-neutral-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {!done ? (
        <>
          {/* Content */}
          <div className="rounded-2xl bg-white border border-neutral-200 p-6 md:p-8 mb-8">
            {/* Step 0: College Selection */}
            {step === 0 && (
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 mb-6">
                  1단계: 대학 선택
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.values(COLLEGES).map((college) => (
                    <button
                      key={college.id}
                      onClick={() =>
                        setProfile((p) => ({
                          ...p,
                          collegeId: college.id,
                          deptId: "",
                          majorId: undefined,
                        }))
                      }
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        profile.collegeId === college.id
                          ? "border-primary-500 bg-primary-50"
                          : "border-neutral-200 bg-white hover:border-primary-300"
                      }`}
                    >
                      <p className="font-semibold text-neutral-900">
                        {college.name}
                      </p>
                      <p className="mt-1 text-sm text-neutral-500">
                        {college.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 1: Department Selection */}
            {step === 1 && (
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 mb-6">
                  2단계: 학과 선택
                  {selectedCollege && (
                    <span className="text-primary-600 font-normal ml-2">
                      ({selectedCollege.name})
                    </span>
                  )}
                </h2>
                <div className="grid grid-cols-1 gap-3">
                  {departmentsList.map((dept) => (
                    <button
                      key={dept.id}
                      onClick={() =>
                        setProfile((p) => ({
                          ...p,
                          deptId: dept.id,
                          majorId: undefined,
                          admissionType: "", // 학과 변경 시 입학유형도 리셋
                        }))
                      }
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        profile.deptId === dept.id
                          ? "border-primary-500 bg-primary-50"
                          : "border-neutral-200 bg-white hover:border-primary-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-neutral-900">
                          {dept.name}
                        </p>
                        {dept.majors && (
                          <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                            전공 선택
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Major Selection (Conditional) */}
            {step === 2 && majorsList && (
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 mb-6">
                  3단계: 전공 선택
                  {selectedDept && (
                    <span className="text-primary-600 font-normal ml-2">
                      ({selectedDept.name})
                    </span>
                  )}
                </h2>
                <div className="grid grid-cols-1 gap-3">
                  {majorsList.map((major) => (
                    <button
                      key={major.id}
                      onClick={() =>
                        setProfile((p) => ({
                          ...p,
                          majorId: major.id,
                        }))
                      }
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        profile.majorId === major.id
                          ? "border-primary-500 bg-primary-50"
                          : "border-neutral-200 bg-white hover:border-primary-300"
                      }`}
                    >
                      <p className="font-semibold text-neutral-900">
                        {major.name}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: No Major Selection Needed */}
            {step === 2 && !majorsList && (
              <div className="text-center py-12">
                <div className="inline-block p-4 bg-blue-50 rounded-lg mb-4">
                  <svg
                    className="h-12 w-12 text-primary-600 mx-auto"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                  전공 선택이 필요 없는 학과입니다
                </h3>
                <p className="text-neutral-600 mb-6">
                  {selectedDept?.name}은(는) 전공이 없는 학과이므로,
                  <br />
                  다음 단계에서 입학유형을 선택해주세요.
                </p>
              </div>
            )}

            {/* Step 3: Admission Type & Year */}
            {step === 3 && (
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 mb-6">
                  4단계: 입학유형 및 입학년도 선택
                </h2>
                <div className="space-y-6">
                  {/* Admission Type */}
                  <div>
                    <label className="block text-sm font-semibold text-neutral-900 mb-3">
                      입학유형
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {availableAdmissionTypes.map((type) => (
                        <button
                          key={type}
                          onClick={() =>
                            setProfile((p) => ({
                              ...p,
                              admissionType: type,
                            }))
                          }
                          className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                            profile.admissionType === type
                              ? "border-primary-500 bg-primary-50 text-primary-700"
                              : "border-neutral-200 bg-white text-neutral-700 hover:border-primary-300"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Admission Year */}
                  <div>
                    <label className="block text-sm font-semibold text-neutral-900 mb-3">
                      입학년도
                    </label>
                    <input
                      type="text"
                      placeholder="예: 2022"
                      maxLength={4}
                      value={profile.admissionYear}
                      onChange={(e) => {
                        const value = e.target.value;
                        setProfile((p) => ({
                          ...p,
                          admissionYear: value,
                        }));
                        if (value && !isValidAdmissionYear(value)) {
                          setYearError(
                            "2000~현재년도 범위의 4자리 숫자를 입력하세요",
                          );
                        } else {
                          setYearError("");
                        }
                      }}
                      className={`w-full px-4 py-3 rounded-lg border-2 outline-none transition-all ${
                        yearError
                          ? "border-red-500 bg-red-50 text-red-900"
                          : profile.admissionYear
                            ? "border-primary-500 bg-primary-50"
                            : "border-neutral-200 bg-white"
                      }`}
                    />
                    {yearError && (
                      <p className="mt-2 text-sm text-red-600">{yearError}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Selection Information Display */}
            {step === 4 && (
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 mb-6">
                  5단계: 졸업요건 확인
                </h2>

                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="p-4 bg-neutral-50 rounded-lg">
                    <p className="text-xs text-neutral-500 mb-1">대학</p>
                    <p className="font-semibold text-neutral-900 text-sm">
                      {selectedCollege?.name || "-"}
                    </p>
                  </div>
                  <div className="p-4 bg-neutral-50 rounded-lg">
                    <p className="text-xs text-neutral-500 mb-1">학과</p>
                    <p className="font-semibold text-neutral-900 text-sm">
                      {selectedDept?.name || "-"}
                    </p>
                  </div>
                  <div className="p-4 bg-neutral-50 rounded-lg">
                    <p className="text-xs text-neutral-500 mb-1">전공</p>
                    <p className="font-semibold text-neutral-900 text-sm">
                      {profile.majorId
                        ? majorsList?.find((m) => m.id === profile.majorId)
                            ?.name || "-"
                        : "-"}
                    </p>
                  </div>
                  <div className="p-4 bg-neutral-50 rounded-lg">
                    <p className="text-xs text-neutral-500 mb-1">입학년도</p>
                    <p className="font-semibold text-neutral-900 text-sm">
                      {profile.admissionYear}
                    </p>
                  </div>
                </div>

                {/* Graduation Requirements */}
                {graduationReq && (
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-6 rounded-lg mb-8">
                    <h3 className="text-lg font-bold text-neutral-900 mb-2">
                      졸업 필수 학점
                      <span className="text-sm font-normal text-primary-600 ml-2">
                        ({profile.admissionType})
                      </span>
                    </h3>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div>
                        <p className="text-sm text-neutral-600 mb-1">
                          총 졸업학점
                        </p>
                        <p className="text-3xl font-bold text-primary-600">
                          {graduationReq.totalCredits}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">학점</p>
                      </div>
                      <div>
                        <p className="text-sm text-neutral-600 mb-1">
                          전공 필수학점
                        </p>
                        <p className="text-3xl font-bold text-primary-600">
                          {graduationReq.majorCredits}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">학점</p>
                      </div>
                      <div>
                        <p className="text-sm text-neutral-600 mb-1">
                          일반선택
                        </p>
                        <p className="text-3xl font-bold text-primary-600">
                          {graduationReq.totalCredits -
                            (graduationReq.majorCredits || 0)}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">학점</p>
                      </div>
                    </div>
                    {typeof graduationReq.notes === "string" && (
                      <div className="pt-4 border-t border-blue-200">
                        <p className="text-sm text-neutral-700">
                          {graduationReq.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex gap-3 justify-between">
            <button
              onClick={handlePrev}
              disabled={step === 0}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                step === 0
                  ? "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                  : "bg-neutral-200 text-neutral-900 hover:bg-neutral-300"
              }`}
            >
              이전
            </button>
            <button
              onClick={handleNext}
              disabled={!stepCanNext[step]}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                stepCanNext[step]
                  ? "bg-primary-500 text-white hover:bg-primary-600 shadow-md shadow-primary-500/30"
                  : "bg-primary-200 text-primary-400 cursor-not-allowed"
              }`}
            >
              {step === STEPS.length - 1 ? "확인" : "다음"}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Completion View */}
          <div className="rounded-2xl bg-white border border-neutral-200 p-6 md:p-8 mb-8">
            <h2 className="text-2xl font-bold text-neutral-900 mb-6">
              졸업요건 체크리스트
            </h2>

            {/* Selection Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
              <div className="p-3 bg-neutral-50 rounded-lg">
                <p className="text-xs text-neutral-500 mb-1">대학</p>
                <p className="font-semibold text-neutral-900 text-sm">
                  {selectedCollege?.name || "-"}
                </p>
              </div>
              <div className="p-3 bg-neutral-50 rounded-lg">
                <p className="text-xs text-neutral-500 mb-1">학과</p>
                <p className="font-semibold text-neutral-900 text-sm">
                  {selectedDept?.name || "-"}
                </p>
              </div>
              <div className="p-3 bg-neutral-50 rounded-lg">
                <p className="text-xs text-neutral-500 mb-1">전공</p>
                <p className="font-semibold text-neutral-900 text-sm">
                  {profile.majorId
                    ? majorsList?.find((m) => m.id === profile.majorId)?.name ||
                      "-"
                    : "-"}
                </p>
              </div>
              <div className="p-3 bg-neutral-50 rounded-lg">
                <p className="text-xs text-neutral-500 mb-1">입학유형</p>
                <p className="font-semibold text-neutral-900 text-sm">
                  {profile.admissionType || "-"}
                </p>
              </div>
              <div className="p-3 bg-neutral-50 rounded-lg">
                <p className="text-xs text-neutral-500 mb-1">입학년도</p>
                <p className="font-semibold text-neutral-900 text-sm">
                  {profile.admissionYear}년
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-neutral-900">
                  진행률
                </span>
                <span className="text-sm font-bold text-primary-600">
                  {progress}%
                </span>
              </div>
              <div className="w-full h-3 bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                {checkedCount} / {totalCount}개 항목 완료
              </p>
            </div>

            {/* Checklist by Group */}
            <div className="space-y-6">
              {groups.map((group) => {
                const groupItems = checkItems.filter((i) => i.group === group);
                const groupChecked = groupItems.every((i) => checks[i.id]);
                const groupProgress = Math.round(
                  (groupItems.filter((i) => checks[i.id]).length /
                    groupItems.length) *
                    100,
                );

                return (
                  <div
                    key={group}
                    className="border border-neutral-200 rounded-lg p-4"
                  >
                    {/* Group Header */}
                    <button
                      onClick={() => toggleGroup(group)}
                      className="flex items-center justify-between w-full mb-3"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-all ${
                            groupChecked
                              ? "border-primary-500 bg-primary-500"
                              : "border-neutral-300 bg-white"
                          }`}
                        >
                          {groupChecked && (
                            <svg
                              className="h-3 w-3 text-white"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                            </svg>
                          )}
                        </div>
                        <span className="font-semibold text-neutral-900">
                          {group}
                        </span>
                        <span className="text-xs text-neutral-500">
                          ({groupProgress}%)
                        </span>
                      </div>
                      <svg
                        className="h-5 w-5 text-neutral-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 14l-7 7m0 0l-7-7m7 7V3"
                        />
                      </svg>
                    </button>

                    {/* Group Items */}
                    <div className="space-y-2 ml-8">
                      {groupItems.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-3 cursor-pointer group"
                        >
                          <input
                            type="checkbox"
                            checked={checks[item.id] || false}
                            onChange={() => toggleCheck(item.id)}
                            className="h-4 w-4 rounded border-neutral-300 text-primary-500 cursor-pointer"
                          />
                          <span className="text-sm text-neutral-700 group-hover:text-neutral-900">
                            {item.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 px-6 py-3 rounded-lg font-semibold bg-neutral-100 text-neutral-900 hover:bg-neutral-200 transition-all"
            >
              다시 선택
            </button>
            <button
              onClick={() => window.print()}
              className="flex-1 px-6 py-3 rounded-lg font-semibold bg-primary-500 text-white hover:bg-primary-600 transition-all"
            >
              출력하기
            </button>
          </div>
        </>
      )}
    </Container>
  );
}
