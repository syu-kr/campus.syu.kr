import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));

const requirements = readJson("public/data/graduation-requirements-2025.json");
const sourceData = readJson("public/data/graduation-sources.json");
const departmentRuleData = readJson(
  "public/data/graduation-department-rules.json",
);
const verifiedCurriculum = readJson(
  "public/data/curriculum-courses-2025-verified.json",
);

const errors = [];
const sourceIds = new Set(sourceData.sources.map((source) => source.id));
const departmentIds = new Set(
  requirements.departments.map((department) => department.id),
);
const requirementGroups = new Set(
  requirements.departments.flatMap((department) => [
    department.requirementGroup,
    ...(department.majors ?? []).map((major) => major.requirementGroup),
  ]),
);
const profileKeys = new Set();

for (const source of sourceData.sources) {
  if (!source.id || !source.title || !source.publisher || !source.verifiedAt) {
    errors.push(`출처 필수값 누락: ${source.id || "(id 없음)"}`);
  }
}

for (const profile of requirements.requirementProfiles) {
  const key = [
    profile.requirementGroup,
    profile.admissionType,
    profile.majorTrack,
  ].join(":");

  if (profileKeys.has(key)) errors.push(`중복 요건 조합: ${key}`);
  profileKeys.add(key);

  if (!requirementGroups.has(profile.requirementGroup)) {
    errors.push(`사용되지 않는 요건 그룹: ${profile.requirementGroup}`);
  }
  if (profile.totalCredits <= 0) {
    errors.push(`졸업학점 오류: ${profile.id}`);
  }
}

for (const rule of departmentRuleData.rules) {
  if (!departmentIds.has(rule.departmentId)) {
    errors.push(`학과별 규칙의 학과 ID 오류: ${rule.id}`);
  }
  for (const sourceId of rule.sourceIds) {
    if (!sourceIds.has(sourceId)) {
      errors.push(`학과별 규칙의 출처 ID 오류: ${rule.id} -> ${sourceId}`);
    }
  }
}

for (const departmentId of verifiedCurriculum.metadata.fullyVerifiedDepartmentIds) {
  if (!departmentIds.has(departmentId)) {
    errors.push(`전체 교육과정 검증 학과의 졸업요건 ID 오류: ${departmentId}`);
  }
}

const expectedProfiles = [
  {
    key: "general:freshman:single",
    totalCredits: 130,
    majorTotal: 75,
  },
  {
    key: "general:transfer3:single",
    totalCredits: 68,
    majorTotal: 51,
  },
  {
    key: "engineering_140:freshman:single",
    totalCredits: 140,
    majorTotal: 85,
  },
  {
    key: "architecture_5year:freshman:single",
    totalCredits: 158,
    majorTotal: 119,
  },
  {
    key: "pharmacy:freshman:single",
    totalCredits: 240,
    majorTotal: 201,
  },
];

for (const expected of expectedProfiles) {
  const profile = requirements.requirementProfiles.find(
    (item) =>
      [item.requirementGroup, item.admissionType, item.majorTrack].join(":") ===
      expected.key,
  );
  if (!profile) {
    errors.push(`대표 요건 조합 누락: ${expected.key}`);
    continue;
  }
  if (
    profile.totalCredits !== expected.totalCredits ||
    profile.categories.majorTotal !== expected.majorTotal
  ) {
    errors.push(`대표 요건 조합 값 변경 확인 필요: ${expected.key}`);
  }
}

const requirements2026 = readJson("public/data/graduation-requirements-2026.json");
const curriculum2026 = readJson("public/data/curriculum-courses-2026-verified.json");
const departmentIds2026 = new Set(
  requirements2026.departments.map((department) => department.id),
);
const requirementGroups2026 = new Set(
  requirements2026.departments.flatMap((department) => [
    department.requirementGroup,
    ...(department.majors ?? []).map((major) => major.requirementGroup),
  ]),
);
const profileKeys2026 = new Set();
const profileIds2026 = new Set();
const collegeIds2026 = new Set(requirements2026.colleges.map((college) => college.id));
const categoryKeys = new Set([
  "requiredLiberal", "coreLiberal", "areaLiberal", "majorRequired",
  "majorElective", "majorTotal", "doubleMajor", "minor", "teaching",
  "lifelongEducator", "freeElective",
]);
if (
  requirements2026.metadata.sourceYear !== "2026" ||
  !requirements2026.metadata.sourceTitle ||
  !requirements2026.metadata.lastVerifiedAt ||
  requirements2026.metadata.sourceSha256 !==
    "83901EA188FD6F9F99F971873D3411BF65EEF0060DE9AD0A6D5EF2F3A9DEDA85"
) {
  errors.push("2026 졸업요건 출처 메타데이터 오류");
}
if (!sourceIds.has("syu-2026-handbook")) {
  errors.push("2026 요람 출처 ID가 없습니다: syu-2026-handbook");
}
if (departmentIds2026.size !== requirements2026.departments.length) {
  errors.push("2026 학과 ID 중복");
}
for (const department of requirements2026.departments) {
  if (!department.id || !department.name || !collegeIds2026.has(department.collegeId)) {
    errors.push(`2026 학과 필수값 또는 대학 ID 오류: ${department.id}`);
  }
  const majorIds = (department.majors ?? []).map((major) => major.id);
  if (majorIds.some((id) => !id) || new Set(majorIds).size !== majorIds.length) {
    errors.push(`2026 학과 세부전공 ID 오류: ${department.id}`);
  }
}
for (const profile of requirements2026.requirementProfiles) {
  const key = [
    profile.requirementGroup,
    profile.admissionType,
    profile.majorTrack,
    profile.transferYear ?? "",
  ].join(":");
  if (profileKeys2026.has(key)) errors.push(`2026 중복 요건 조합: ${key}`);
  profileKeys2026.add(key);
  if (!profile.id || profileIds2026.has(profile.id)) {
    errors.push(`2026 요건 ID 누락 또는 중복: ${profile.id}`);
  }
  profileIds2026.add(profile.id);
  if (!requirementGroups2026.has(profile.requirementGroup)) {
    errors.push(`2026 사용되지 않는 요건 그룹: ${profile.requirementGroup}`);
  }
  if (!["verified", "needsReview"].includes(profile.verificationStatus)) {
    errors.push(`2026 요건 검증 상태 오류: ${profile.id}`);
  }
  if (
    !["freshman", "transfer2", "transfer3", "transfer4", "departmentTransfer"].includes(profile.admissionType) ||
    !["single", "doubleMajor", "minor", "teaching", "lifelongEducator"].includes(profile.majorTrack)
  ) {
    errors.push(`2026 입학유형 또는 전공형태 오류: ${profile.id}`);
  }
  if (
    !Number.isFinite(profile.totalCredits) ||
    profile.totalCredits < 0 ||
    (profile.totalCredits === 0 && profile.verificationStatus !== "needsReview")
  ) {
    errors.push(`2026 졸업학점 오류: ${profile.id}`);
  }
  for (const [category, credits] of Object.entries(profile.categories)) {
    if (!categoryKeys.has(category) || !Number.isFinite(credits) || credits < 0) {
      errors.push(`2026 이수구분 학점 오류: ${profile.id} -> ${category}`);
    }
  }
  if (
    profile.reviewCreditKeys != null &&
    (!Array.isArray(profile.reviewCreditKeys) ||
      profile.reviewCreditKeys.some((key) => key !== "totalCredits" && !categoryKeys.has(key)))
  ) {
    errors.push(`2026 확인 필요 학점 항목 오류: ${profile.id}`);
  }
  if (
    !Array.isArray(profile.sourcePages) ||
    profile.sourcePages.length === 0 ||
    profile.sourcePages.some((page) => !Number.isInteger(page) || page < 1 || page > 428)
  ) {
    errors.push(`2026 요건 근거 페이지 오류: ${profile.id}`);
  }
  if (
    profile.transferYear != null &&
    (profile.admissionType !== "departmentTransfer" ||
      !Number.isInteger(profile.transferYear) ||
      profile.transferYear < 1 ||
      profile.transferYear > 4)
  ) {
    errors.push(`2026 전과 학년 오류: ${profile.id}`);
  }
  if (
    profile.requiredCourses != null &&
    (!Array.isArray(profile.requiredCourses) ||
      profile.requiredCourses.some((name) => typeof name !== "string" || !name.trim()) ||
      new Set(profile.requiredCourses).size !== profile.requiredCourses.length)
  ) {
    errors.push(`2026 필수 과목명 오류: ${profile.id}`);
  }
}
for (const departmentId of curriculum2026.metadata.fullyVerifiedDepartmentIds) {
  if (!departmentIds2026.has(departmentId)) {
    errors.push(`2026 전체 교육과정 검증 학과 ID 오류: ${departmentId}`);
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  `졸업요건 데이터 확인 완료: 출처 ${sourceIds.size}개, 요건 조합 ${profileKeys.size}개, 학과별 규칙 ${departmentRuleData.rules.length}개`,
);
console.log(
  `2026 졸업요건 데이터 확인 완료: 학과 ${departmentIds2026.size}개, 요건 조합 ${profileKeys2026.size}개`,
);
