import json
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OCR_PATH = ROOT / "public/data/curriculum-courses-2025-ocr.json"
VERIFICATIONS_PATH = ROOT / "public/data/curriculum-course-verifications.json"
VERIFIED_PATH = ROOT / "public/data/curriculum-courses-2025-verified.json"
AUDIT_PATH = ROOT / "public/data/curriculum-courses-2025-audit.json"
REQUIREMENTS_PATH = ROOT / "public/data/graduation-requirements-2025.json"
SELECTION_RULES_PATH = ROOT / "public/data/curriculum-course-selection-rules.json"


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


ocr = read_json(OCR_PATH)
verifications = read_json(VERIFICATIONS_PATH)
verified = read_json(VERIFIED_PATH)
audit = read_json(AUDIT_PATH)
requirements = read_json(REQUIREMENTS_PATH)
selection_rules = read_json(SELECTION_RULES_PATH)

errors: list[str] = []
warnings: list[str] = []

ocr_ids = {course["id"] for course in ocr["courses"]}
verified_courses = verified["courses"]
verified_by_id = {course["id"]: course for course in verified_courses}
if len(verified_by_id) != len(verified_courses):
    errors.append("확정 과목 ID 중복이 있습니다.")

page_course_ids = {
    course["courseId"]
    for page in verifications.get("verifiedPages", [])
    for course in page.get("courses", [])
}
record_course_ids = {
    record["courseId"]
    for record in verifications.get("records", [])
    if record["courseId"] not in page_course_ids
}
all_record_ids = page_course_ids | record_course_ids

missing_original_ids = sorted(ocr_ids - all_record_ids)
if missing_original_ids:
    errors.append(f"원본 OCR 과목 중 검증 기록 누락: {len(missing_original_ids)}개")

if audit["summary"]["unreviewed"] != 0 or audit.get("reviewQueue"):
    errors.append("감사 큐에 검토 대기 과목이 남아 있습니다.")

requirement_department_ids = {department["id"] for department in requirements["departments"]}
fully_verified_ids = verified["metadata"].get("fullyVerifiedDepartmentIds", [])
for department_id in fully_verified_ids:
    if department_id not in requirement_department_ids:
        errors.append(f"졸업요건 학과 목록에 없는 검증 완료 학과: {department_id}")

verified_department_ids = {course["departmentId"] for course in verified_courses}
for department_id in verified_department_ids:
    if department_id not in fully_verified_ids:
        errors.append(f"확정 과목은 있으나 전체 검증 완료 목록에 없는 학과: {department_id}")

for course_id in all_record_ids:
    if course_id not in verified_by_id:
        errors.append(f"검증 기록은 있으나 확정 데이터에 없는 과목: {course_id}")

valid_categories = {"교필", "교선", "전필", "전선", "교직"}
valid_years = {1, 2, 3, 4, 5, 6}
valid_semesters = {1, 2}
major_ids_by_department = {
    department["id"]: {major["id"] for major in department.get("majors", [])}
    for department in requirements["departments"]
}

known_pass_zero_credit_names = {
    "채플",
    "채플(온라인)",
    "컴퓨터 사고력",
    "졸업시험",
    "식품영양산업연구 인턴십",
    "식품영양세미나",
}
known_zero_credit_keywords = (
    "흡연음주",
    "음주흡연",
    "교직소양교육",
    "학교현장의 이해",
    "Weekly Recital",
    "졸업연주",
    "비전드림교육",
    "종합시험",
    "논문 및 졸업시험",
)
ocr_typo_patterns = [
    r"학재",
    r"글로철",
    r"운리",
    r"고육",
    r"의로",
    r"마켓팅",
    r"기공학",
    r"캠스튼|캠스트|캠스톤",
    r"프로적|모로적트",
    r"컴유팅|네트위크",
    r"박악",
    r"생성령",
    r"렉토리",
    r"알고리좀",
    r"반도제",
    r"시반도체",
    r"작업환경촉",
    r"차플|채뜰",
    r"스레스",
    r"인W십",
    r"\\bIl\\b|\\bI1\\b",
]
ocr_typo_re = re.compile("|".join(ocr_typo_patterns), re.IGNORECASE)

for course in verified_courses:
    label = f"{course['id']} {course['departmentName']} {course['name']}"
    if course["category"] not in valid_categories:
        errors.append(f"허용되지 않은 이수구분: {label} -> {course['category']}")
    if course["year"] not in valid_years:
        errors.append(f"학년 범위 오류: {label} -> {course['year']}")
    if course["semester"] not in valid_semesters:
        errors.append(f"학기 범위 오류: {label} -> {course['semester']}")
    if not isinstance(course["credits"], int) or course["credits"] < 0 or course["credits"] > 12:
        errors.append(f"학점 범위 오류: {label} -> {course['credits']}")
    if (
        course["credits"] == 0
        and course["name"] not in known_pass_zero_credit_names
        and not any(keyword in course["name"] for keyword in known_zero_credit_keywords)
    ):
        warnings.append(f"0학점 과목 확인 필요: {label}")
    if (
        course["credits"] == 12
        and "인턴십" not in course["name"]
        and "학점연계프로젝트" not in course["name"]
        and course["name"] != "현장실습 IV"
    ):
        warnings.append(f"12학점 과목 확인 필요: {label}")
    if course["name"].count("(") != course["name"].count(")"):
        errors.append(f"괄호 불균형: {label}")
    if ocr_typo_re.search(course["name"]):
        warnings.append(f"OCR 오탈자 의심 패턴: {label}")
    major_id = course.get("majorId")
    known_major_ids = major_ids_by_department.get(course["departmentId"], set())
    if major_id and known_major_ids and major_id not in known_major_ids:
        errors.append(f"학과에 없는 majorId: {label} -> {major_id}")

department_counts = Counter(course["departmentId"] for course in verified_courses)
empty_departments = [department_id for department_id in fully_verified_ids if department_counts[department_id] == 0]
if empty_departments:
    errors.append(f"검증 완료 목록에 있으나 확정 과목이 없는 학과: {', '.join(empty_departments)}")

selection_group_ids = set()
for group in selection_rules["exclusiveGroups"]:
    if group["id"] in selection_group_ids:
        errors.append(f"중복 선택 규칙 ID: {group['id']}")
    selection_group_ids.add(group["id"])
    for course_id in group["courseIds"]:
        course = verified_by_id.get(course_id)
        if not course:
            errors.append(f"선택 규칙 과목 ID 누락: {group['id']} -> {course_id}")
        elif course["departmentId"] != group["departmentId"]:
            errors.append(f"선택 규칙 학과 불일치: {group['id']} -> {course_id}")

department_summary = defaultdict(lambda: {"courses": 0, "original": 0, "added": 0})
for course in verified_courses:
    summary = department_summary[course["departmentId"]]
    summary["courses"] += 1
    if course["id"] in ocr_ids:
        summary["original"] += 1
    else:
        summary["added"] += 1

print("Verified departments:", len(department_summary))
print("Verified courses:", len(verified_courses))
print("Original OCR courses covered:", len(ocr_ids - set(missing_original_ids)), "/", len(ocr_ids))
print("Review queue:", audit["summary"]["unreviewed"])
print("Selection rules:", len(selection_rules["exclusiveGroups"]))
print("Department counts:")
for department_id in sorted(department_summary):
    summary = department_summary[department_id]
    print(
        f"- {department_id}: {summary['courses']} "
        f"(ocr {summary['original']}, added {summary['added']})"
    )

if warnings:
    print("Warnings:")
    for warning in warnings:
        print(f"- {warning}")

if errors:
    print("Errors:")
    for error in errors:
        print(f"- {error}")
    raise SystemExit(1)

print("품질 감사 완료: 치명적 오류 없음")
