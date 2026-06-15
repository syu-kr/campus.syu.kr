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

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  `졸업요건 데이터 확인 완료: 출처 ${sourceIds.size}개, 요건 조합 ${profileKeys.size}개, 학과별 규칙 ${departmentRuleData.rules.length}개`,
);
