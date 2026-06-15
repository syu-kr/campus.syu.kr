"""Audit OCR curriculum data against the available source PDF and manual reviews."""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
OCR_PATH = ROOT / "public/data/curriculum-courses-2025-ocr.json"
VERIFICATION_PATH = ROOT / "public/data/curriculum-course-verifications.json"
SOURCE_PATH = ROOT / "졸업요건/2025학년도-삼육대학교요람_졸업요건.pdf"
FULL_SOURCE_PATH = ROOT / "졸업요건/★2025학년도-삼육대학교요람_국문수정.pdf"
OUTPUT_PATH = ROOT / "public/data/curriculum-courses-2025-audit.json"

PAGE_RE = re.compile(r"^OCR PAGE (\d+)$")
SUSPICIOUS_NAME_PARTS = (
    "시물레이선",
    "선고",
    "글로걸",
    "채m",
    "채뜰",
    "그런교육",
    "조설",
    "이론 |",
    "_",
)
NON_CREDIT_NAMES = ("채플", "흡연음주예방교육")


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def issue_codes(course: dict[str, Any], duplicate_count: int) -> list[str]:
    issues: list[str] = []
    name = str(course.get("name") or "").strip()
    credits = course.get("credits")
    source_page = str(course.get("sourcePage") or "")
    page_match = PAGE_RE.match(source_page)

    if not page_match:
        issues.append("invalidSourcePage")
    elif not 1 <= int(page_match.group(1)) <= 404:
        issues.append("sourcePageOutOfRange")
    if credits is None:
        issues.append("missingCredits")
    elif not isinstance(credits, (int, float)):
        issues.append("invalidCredits")
    else:
        if credits < 0:
            issues.append("negativeCredits")
        if credits > 6:
            issues.append("highCreditsNeedsReview")
        if credits == 0 and not any(part in name for part in NON_CREDIT_NAMES):
            issues.append("zeroCreditsNeedsReview")
    if course.get("year") is None:
        issues.append("missingYear")
    if course.get("semester") is None:
        issues.append("missingSemester")
    if not name:
        issues.append("missingName")
    if any(part in name for part in SUSPICIOUS_NAME_PARTS):
        issues.append("suspiciousName")
    if name.count("(") != name.count(")"):
        issues.append("unbalancedParentheses")
    if duplicate_count > 1:
        issues.append("duplicateDepartmentCourseName")
    if course.get("reviewStatus") == "ocrCleaned":
        issues.append("legacyOcrCleanedNotVerified")

    return issues


def main() -> None:
    ocr_data = read_json(OCR_PATH)
    verification_data = read_json(VERIFICATION_PATH)
    courses = ocr_data["courses"]
    verifications = {
        record["courseId"]: record for record in verification_data["records"]
    }
    for page in verification_data.get("verifiedPages", []):
        for course in page["courses"]:
            verifications[course["courseId"]] = course
    original_course_ids = {course["id"] for course in courses}
    verified_originals = {
        course_id for course_id in verifications if course_id in original_course_ids
    }
    verified_additions = {
        course_id for course_id in verifications if course_id not in original_course_ids
    }

    source_pages = len(PdfReader(str(SOURCE_PATH)).pages)
    full_source_pages = len(PdfReader(str(FULL_SOURCE_PATH)).pages)
    if source_pages != 404 or full_source_pages != 626:
        raise RuntimeError(
            f"Unexpected source page count: excerpt={source_pages}, full={full_source_pages}"
        )

    duplicate_counts = Counter(
        (course.get("departmentId"), course.get("name")) for course in courses
    )
    issue_totals: Counter[str] = Counter()
    department_totals: dict[str, Counter[str]] = defaultdict(Counter)
    queue: list[dict[str, Any]] = []

    for course in courses:
        issues = issue_codes(
            course,
            duplicate_counts[(course.get("departmentId"), course.get("name"))],
        )
        verification = verifications.get(course["id"])
        status = "humanVerified" if verification else "unreviewed"
        priority = (
            0
            if status == "humanVerified"
            else 1
            if course.get("category") in {"교필", "전필"}
            else 2
        )
        issue_totals.update(issues)
        department_totals[course.get("departmentName") or "unknown"].update(issues)

        if status != "humanVerified":
            queue.append(
                {
                    "courseId": course["id"],
                    "departmentName": course.get("departmentName"),
                    "category": course.get("category"),
                    "name": course.get("name"),
                    "sourcePage": course.get("sourcePage"),
                    "fullSourcePage": (
                        int(PAGE_RE.match(course["sourcePage"]).group(1)) + 222
                        if PAGE_RE.match(str(course.get("sourcePage") or ""))
                        else None
                    ),
                    "legacyReviewStatus": course.get("reviewStatus"),
                    "issues": issues,
                    "priority": priority,
                }
            )

    queue.sort(
        key=lambda item: (
            item["priority"],
            -len(item["issues"]),
            item["departmentName"] or "",
            item["courseId"],
        )
    )
    output = {
        "metadata": {
            "generatedAt": verification_data["metadata"]["verifiedAt"],
            "sourceFile": str(SOURCE_PATH.relative_to(ROOT)).replace("\\", "/"),
            "sourceSha256": verification_data["metadata"]["sourceSha256"],
            "sourcePages": source_pages,
            "fullSourceFile": str(FULL_SOURCE_PATH.relative_to(ROOT)).replace("\\", "/"),
            "fullSourceSha256": verification_data["metadata"]["fullSourceSha256"],
            "fullSourcePages": full_source_pages,
            "pageMapping": "fullSourcePage = sourcePage + 222",
            "policy": "legacy ocrCleaned is not treated as verified; only manual verification records are verified",
        },
        "summary": {
            "totalCourses": len(courses),
            "humanVerified": len(verifications),
            "humanVerifiedOriginalCourses": len(verified_originals),
            "humanVerifiedAddedCourses": len(verified_additions),
            "unreviewed": len(courses) - len(verified_originals),
            "legacyNeedsReview": sum(
                course.get("reviewStatus") == "needsReview" for course in courses
            ),
            "legacyOcrCleaned": sum(
                course.get("reviewStatus") == "ocrCleaned" for course in courses
            ),
            "issueTotals": dict(issue_totals.most_common()),
        },
        "departmentIssueTotals": {
            department: dict(counter.most_common())
            for department, counter in sorted(department_totals.items())
        },
        "reviewQueue": queue,
    }
    OUTPUT_PATH.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Audited {len(courses)} courses: "
        f"{len(verifications)} human verified, {len(queue)} queued"
    )


if __name__ == "__main__":
    main()
