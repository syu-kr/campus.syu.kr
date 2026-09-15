"""Validate monthly phone and academic schedule crawl outputs."""

from __future__ import annotations

import json
import re
from pathlib import Path

DATA_DIR = Path("public/data")
DATE_PATTERN = re.compile(r"^\d{4}\.\d{2}\.\d{2}$")
PHONE_PATTERN = re.compile(r"^0\d{1,2}-\d{3,4}-\d{4}$")


def read_list(path: Path, max_bytes: int) -> list[object]:
    if path.stat().st_size > max_bytes:
        raise RuntimeError(f"{path.name} exceeds the allowed size")
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(value, list) or not value:
        raise RuntimeError(f"{path.name} must be a non-empty array")
    return value


def validate_phone_numbers() -> None:
    path = DATA_DIR / "phone-numbers.json"
    items = read_list(path, 512 * 1024)
    for item in items:
        if not isinstance(item, dict):
            raise RuntimeError(f"{path.name} contains a non-object item")
        numbers = item.get("phoneNumbers")
        if (
            not isinstance(item.get("department"), str)
            or not item["department"].strip()
            or not isinstance(item.get("phone"), str)
            or not isinstance(numbers, list)
            or not numbers
            or any(not isinstance(number, str) or not PHONE_PATTERN.fullmatch(number) for number in numbers)
        ):
            raise RuntimeError(f"{path.name} contains an invalid phone entry")


def validate_schedules() -> None:
    paths = sorted(DATA_DIR.glob("schedules-*.json"))
    if not paths:
        raise RuntimeError("No schedules-*.json files found")
    for path in paths:
        items = read_list(path, 1024 * 1024)
        ids: set[str] = set()
        for item in items:
            if (
                not isinstance(item, dict)
                or not isinstance(item.get("id"), str)
                or not item["id"]
                or item["id"] in ids
                or not isinstance(item.get("title"), str)
                or not item["title"].strip()
                or not DATE_PATTERN.fullmatch(str(item.get("startDate", "")))
                or not DATE_PATTERN.fullmatch(str(item.get("endDate", "")))
                or item["startDate"] > item["endDate"]
            ):
                raise RuntimeError(f"{path.name} contains an invalid schedule entry")
            ids.add(item["id"])


def main() -> None:
    validate_phone_numbers()
    validate_schedules()
    print("Validated monthly phone and schedule crawl data")


if __name__ == "__main__":
    main()
