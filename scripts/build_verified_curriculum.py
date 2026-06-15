"""Build the curriculum dataset containing only manually verified courses."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
OCR_PATH = ROOT / "public/data/curriculum-courses-2025-ocr.json"
VERIFICATION_PATH = ROOT / "public/data/curriculum-course-verifications.json"
OUTPUT_PATH = ROOT / "public/data/curriculum-courses-2025-verified.json"


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    ocr_data = read_json(OCR_PATH)
    verification_data = read_json(VERIFICATION_PATH)
    courses_by_id = {course["id"]: course for course in ocr_data["courses"]}
    verified_courses = []

    records = list(verification_data["records"])
    for page in verification_data.get("verifiedPages", []):
        for course in page["courses"]:
            records.append(
                {
                    "courseId": course["courseId"],
                    "action": (
                        None if course["courseId"] in courses_by_id else "add"
                    ),
                    "status": "humanVerified",
                    "sourcePage": page["sourcePage"],
                    "fullSourcePage": page["fullSourcePage"],
                    "corrections": {
                        "departmentId": page["departmentId"],
                        "departmentName": page["departmentName"],
                        "majorId": course.get(
                            "majorId", page.get("majorId")
                        ),
                        "category": course["category"],
                        "name": course["name"],
                        "credits": course["credits"],
                        "year": course["year"],
                        "semester": course["semester"],
                    },
                    "note": page.get("note"),
                }
            )

    records_by_id = {}
    for record in records:
        records_by_id[record["courseId"]] = record

    for record in records_by_id.values():
        if record["status"] != "humanVerified":
            continue
        original = courses_by_id.get(record["courseId"])
        if not original and record.get("action") != "add":
            raise RuntimeError(f"Unknown verified course: {record['courseId']}")
        original = original or {
            "id": record["courseId"],
            "sourcePage": f"OCR PAGE {record['sourcePage']}",
            "reviewStatus": "missingFromOcr",
            "rawBlock": [],
        }
        verified_courses.append(
            {
                **original,
                **record["corrections"],
                "verificationStatus": "humanVerified",
                "verification": {
                    "sourcePage": record["sourcePage"],
                    "fullSourcePage": record["fullSourcePage"],
                    "verifiedAt": verification_data["metadata"]["verifiedAt"],
                    "note": record.get("note"),
                },
            }
        )

    output = {
        "metadata": {
            "sourceFile": verification_data["metadata"]["sourceFile"],
            "sourceSha256": verification_data["metadata"]["sourceSha256"],
            "sourceYear": "2025",
            "generatedAt": verification_data["metadata"]["verifiedAt"],
            "fullyVerifiedDepartmentIds": verification_data["metadata"][
                "fullyVerifiedDepartmentIds"
            ],
            "policy": "Only humanVerified courses may be used for graduation simulation.",
        },
        "summary": {
            "totalVerifiedCourses": len(verified_courses),
        },
        "courses": verified_courses,
    }
    OUTPUT_PATH.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Built {len(verified_courses)} verified courses")


if __name__ == "__main__":
    main()
