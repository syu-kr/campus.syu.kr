import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const sha256 = (relativePath) =>
  crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest("hex")
    .toUpperCase();

const ocrData = readJson("public/data/curriculum-courses-2025-ocr.json");
const verificationData = readJson(
  "public/data/curriculum-course-verifications.json",
);
const verifiedData = readJson("public/data/curriculum-courses-2025-verified.json");
const auditData = readJson("public/data/curriculum-courses-2025-audit.json");
const selectionRuleData = readJson(
  "public/data/curriculum-course-selection-rules.json",
);

const errors = [];
const coursesById = new Map(ocrData.courses.map((course) => [course.id, course]));
const recordsById = new Map();
const pageCourseIds = new Set(
  (verificationData.verifiedPages ?? []).flatMap((page) =>
    page.courses.map((course) => course.courseId),
  ),
);
const normalizedRecords = verificationData.records.filter(
  (record) => !pageCourseIds.has(record.courseId),
);
for (const page of verificationData.verifiedPages ?? []) {
  if (page.fullSourcePage !== page.sourcePage + 222) {
    errors.push(`전체 요람 페이지 매핑 오류: PAGE ${page.sourcePage}`);
  }
  for (const course of page.courses) {
    normalizedRecords.push({
      courseId: course.courseId,
      action: coursesById.has(course.courseId) ? undefined : "add",
      status: "humanVerified",
      sourcePage: page.sourcePage,
      fullSourcePage: page.fullSourcePage,
      corrections: {
        departmentId: page.departmentId,
        departmentName: page.departmentName,
        majorId: course.majorId ?? page.majorId ?? null,
        category: course.category,
        name: course.name,
        credits: course.credits,
        year: course.year,
        semester: course.semester,
      },
    });
  }
}

for (const record of normalizedRecords) {
  if (recordsById.has(record.courseId)) {
    errors.push(`중복 검증 기록: ${record.courseId}`);
  }
  recordsById.set(record.courseId, record);

  if (!coursesById.has(record.courseId) && record.action !== "add") {
    errors.push(`원본 OCR에 없는 검증 기록: ${record.courseId}`);
  }
  if (coursesById.has(record.courseId) && record.action === "add") {
    errors.push(`기존 OCR 과목을 추가 과목으로 표시함: ${record.courseId}`);
  }
  if (record.status !== "humanVerified") {
    errors.push(`허용되지 않은 검증 상태: ${record.courseId}`);
  }
  if (record.fullSourcePage !== record.sourcePage + 222) {
    errors.push(`전체 요람 페이지 매핑 오류: ${record.courseId}`);
  }
  const requiredFields =
    record.action === "add"
      ? [
          "departmentId",
          "departmentName",
          "category",
          "name",
          "credits",
          "year",
          "semester",
        ]
      : ["name", "credits", "year", "semester"];
  for (const field of requiredFields) {
    if (record.corrections[field] == null) {
      errors.push(`확정값 누락(${field}): ${record.courseId}`);
    }
  }
}

const verifiedIds = new Set(verifiedData.courses.map((course) => course.id));
if (verifiedIds.size !== verifiedData.courses.length) {
  errors.push("검증 완료 데이터에 중복 ID가 있습니다.");
}
for (const id of recordsById.keys()) {
  if (!verifiedIds.has(id)) errors.push(`검증 완료 데이터 누락: ${id}`);
}
for (const course of verifiedData.courses) {
  const record = recordsById.get(course.id);
  if (!record) {
    errors.push(`수동 검증 기록 없이 확정 데이터에 포함됨: ${course.id}`);
    continue;
  }
  if (course.verificationStatus !== "humanVerified") {
    errors.push(`확정 데이터 상태 오류: ${course.id}`);
  }
  for (const [key, value] of Object.entries(record.corrections)) {
    if (course[key] !== value) {
      errors.push(`확정값 병합 오류(${key}): ${course.id}`);
    }
  }
}

if (auditData.summary.totalCourses !== ocrData.courses.length) {
  errors.push("감사 보고서 전체 과목 수가 원본 OCR과 다릅니다.");
}
if (auditData.summary.humanVerified !== recordsById.size) {
  errors.push("감사 보고서 검증 완료 수가 검증 기록과 다릅니다.");
}
if (verifiedData.summary.totalVerifiedCourses !== recordsById.size) {
  errors.push("확정 데이터 요약 수가 검증 기록과 다릅니다.");
}

const metadata = verificationData.metadata;
if (verifiedData.metadata.sourceYear !== "2025") {
  errors.push("확정 교육과정 기준 학년도가 2025가 아닙니다.");
}
const fullyVerifiedDepartmentIds =
  verifiedData.metadata.fullyVerifiedDepartmentIds ?? [];
const expectedFullyVerifiedDepartments = new Map([
  ["nursing_nursing", 81],
  ["ff_computer", 94],
  ["theology_dept", 89],
  ["cf_socialwelfare", 85],
  ["cf_counseling", 90],
  ["cf_artdesign", 58],
  ["cf_english", 42],
  ["cf_earlychildhood", 77],
  ["cf_music", 109],
  ["cf_physical", 67],
  ["cf_aviation", 58],
  ["cf_business", 123],
  ["cf_korean", 63],
  ["ff_ai", 98],
  ["ff_architecture", 130],
  ["ff_animal", 76],
  ["ff_bioconvergence", 73],
  ["ff_chemistry", 110],
  ["ff_datacloud", 74],
  ["ff_foodnutrition", 84],
  ["ff_healthadmin", 70],
  ["pharmacy_pharm", 117],
  ["ff_envdesign", 196],
  ["ff_physicaltherapy", 70],
]);
if (new Set(fullyVerifiedDepartmentIds).size !== fullyVerifiedDepartmentIds.length) {
  errors.push("전체 검증 완료 학과 목록에 중복 ID가 있습니다.");
}
for (const departmentId of fullyVerifiedDepartmentIds) {
  const departmentCourses = verifiedData.courses.filter(
    (course) => course.departmentId === departmentId,
  );
  if (departmentCourses.length === 0) {
    errors.push(`전체 검증 완료 학과의 확정 과목이 없습니다: ${departmentId}`);
  }
  const expectedCount = expectedFullyVerifiedDepartments.get(departmentId);
  if (expectedCount == null) {
    errors.push(`예상하지 않은 전체 검증 완료 학과: ${departmentId}`);
  } else if (departmentCourses.length !== expectedCount) {
    errors.push(
      `전체 검증 완료 학과 과목 수 오류: ${departmentId} (${departmentCourses.length}/${expectedCount})`,
    );
  }
}
for (const departmentId of expectedFullyVerifiedDepartments.keys()) {
  if (!fullyVerifiedDepartmentIds.includes(departmentId)) {
    errors.push(`전체 검증 완료 학과 목록 누락: ${departmentId}`);
  }
}
const selectionGroupIds = new Set();
const groupedCourseIds = new Set();
for (const group of selectionRuleData.exclusiveGroups) {
  if (selectionGroupIds.has(group.id)) {
    errors.push(`중복 과목 선택 규칙 ID: ${group.id}`);
  }
  selectionGroupIds.add(group.id);
  if (!fullyVerifiedDepartmentIds.includes(group.departmentId)) {
    errors.push(`전체 검증 미완료 학과의 과목 선택 규칙: ${group.id}`);
  }
  if (group.courseIds.length < 2) {
    errors.push(`과목 선택 규칙의 과목 수 부족: ${group.id}`);
  }
  for (const courseId of group.courseIds) {
    if (!verifiedIds.has(courseId)) {
      errors.push(`과목 선택 규칙의 확정 과목 ID 오류: ${group.id} -> ${courseId}`);
    } else {
      const course = verifiedData.courses.find((item) => item.id === courseId);
      if (course.departmentId !== group.departmentId) {
        errors.push(`과목 선택 규칙의 학과 ID 불일치: ${group.id} -> ${courseId}`);
      }
    }
    if (groupedCourseIds.has(courseId)) {
      errors.push(`여러 과목 선택 규칙에 포함된 과목: ${courseId}`);
    }
    groupedCourseIds.add(courseId);
  }
}
if (selectionRuleData.exclusiveGroups.length !== 45) {
  errors.push("검증된 상호배타 과목 선택 규칙 수가 45개가 아닙니다.");
}
if (sha256(metadata.sourceFile) !== metadata.sourceSha256) {
  errors.push("졸업요건 발췌 PDF 해시가 검증 당시와 다릅니다.");
}
if (sha256(metadata.fullSourceFile) !== metadata.fullSourceSha256) {
  errors.push("전체 국문 요람 PDF 해시가 검증 당시와 다릅니다.");
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  `교육과정 검증 데이터 확인 완료: 원본 ${ocrData.courses.length}개, 수동 검증 ${recordsById.size}개, 검토 대기 ${auditData.summary.unreviewed}개`,
);
