"""Collect the official current/next-year public holidays without exposing credentials."""

from __future__ import annotations

import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import unquote

import requests

from crawler_utils import write_json_atomic

API_URL = "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo"
SOURCE_URL = "https://www.data.go.kr/data/15012690/openapi.do"
OUTPUT_PATH = Path("public/data/public-holidays.json")
PAGE_SIZE = 100
MAX_RESPONSE_BYTES = 128 * 1024
MAX_YEAR_RECORDS = 1000
KST = timezone(timedelta(hours=9))


def read_integer(element: ET.Element, name: str, minimum: int = 0) -> int:
    value = element.findtext(name, "").strip()
    if not re.fullmatch(r"\d+", value) or int(value) < minimum:
        raise RuntimeError("Invalid public holiday response metadata")
    return int(value)


def request_page(session: requests.Session, service_key: str, year: int, page: int) -> ET.Element:
    try:
        # A raw key and the portal's encoded key both receive exactly one final encoding.
        with session.get(API_URL, params={
            "ServiceKey": service_key, "solYear": year,
            "numOfRows": PAGE_SIZE, "pageNo": page,
        }, timeout=(10, 30), stream=True, allow_redirects=False) as response:
            if response.status_code != 200:
                raise RuntimeError("Public holiday API returned an HTTP error")
            payload = bytearray()
            for chunk in response.iter_content(chunk_size=16 * 1024):
                payload.extend(chunk)
                if len(payload) > MAX_RESPONSE_BYTES:
                    raise RuntimeError("Public holiday API response is too large")
    except requests.RequestException:
        # Request exceptions can include the full URL and ServiceKey. Never emit them.
        raise RuntimeError("Public holiday API request failed") from None
    if b"<!DOCTYPE" in payload.upper() or b"<!ENTITY" in payload.upper():
        raise RuntimeError("Unsupported public holiday XML declaration")
    try:
        root = ET.fromstring(payload)
    except ET.ParseError:
        raise RuntimeError("Invalid public holiday XML") from None
    if root.tag != "response" or root.findtext("header/resultCode", "").strip() != "00":
        raise RuntimeError("Public holiday API reported a failure")
    return root


def collect_year(session: requests.Session, service_key: str, year: int) -> dict[str, set[str]]:
    holidays: dict[str, set[str]] = {}
    seen: set[tuple[str, int]] = set()
    total: int | None = None
    count = 0
    page = 1
    while total is None or count < total:
        body = request_page(session, service_key, year, page).find("body")
        if body is None:
            raise RuntimeError("Public holiday response body is missing")
        page_total = read_integer(body, "totalCount", 1)
        rows = read_integer(body, "numOfRows", 1)
        if (
            page_total > MAX_YEAR_RECORDS or rows != PAGE_SIZE
            or read_integer(body, "pageNo", 1) != page
            or (total is not None and total != page_total)
        ):
            raise RuntimeError("Inconsistent public holiday pagination")
        total = page_total
        items = body.findall("items/item")
        if len(items) != min(PAGE_SIZE, total - count):
            raise RuntimeError("Incomplete public holiday page")
        for item in items:
            raw_date = item.findtext("locdate", "").strip()
            if not re.fullmatch(r"\d{8}", raw_date) or raw_date[:4] != str(year):
                raise RuntimeError("Public holiday date is outside the requested year")
            try:
                date = datetime.strptime(raw_date, "%Y%m%d").strftime("%Y-%m-%d")
            except ValueError:
                raise RuntimeError("Invalid public holiday date") from None
            sequence = read_integer(item, "seq", 1)
            identity = (raw_date, sequence)
            if identity in seen:
                raise RuntimeError("Duplicate public holiday response item")
            seen.add(identity)
            name = item.findtext("dateName", "").strip()
            is_holiday = item.findtext("isHoliday", "").strip()
            if not name or len(name) > 100 or is_holiday not in ("Y", "N"):
                raise RuntimeError("Invalid public holiday item")
            if is_holiday == "Y":
                holidays.setdefault(date, set()).add(name)
        count += len(items)
        page += 1
    if not holidays:
        raise RuntimeError("Public holiday year has no confirmed holidays")
    return holidays


def crawl_public_holidays(
    service_key: str,
    output_path: Path = OUTPUT_PATH,
    now: datetime | None = None,
    session: requests.Session | None = None,
) -> dict[str, object]:
    if not service_key.strip():
        raise RuntimeError("PUBLIC_DATA_SERVICE_KEY is not configured")
    timestamp = now or datetime.now(timezone.utc)
    if timestamp.tzinfo is None:
        raise RuntimeError("Public holiday collection requires a timezone-aware clock")
    year = timestamp.astimezone(KST).year
    years = [year, year + 1]
    holidays: dict[str, set[str]] = {}
    client = session or requests.Session()
    try:
        for requested_year in years:
            holidays.update(collect_year(client, unquote(service_key.strip()), requested_year))
    finally:
        if session is None:
            client.close()
    if len(holidays) > 1000 or any(len(names) > 10 for names in holidays.values()):
        raise RuntimeError("Public holiday snapshot has too many dates or names")
    completed_at = now or datetime.now(timezone.utc)
    snapshot: dict[str, object] = {
        "schemaVersion": 1, "sourceUrl": SOURCE_URL,
        "lastSuccessAt": completed_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "years": years,
        "holidays": [{"date": date, "names": sorted(names)} for date, names in sorted(holidays.items())],
    }
    if len((json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n").encode("utf-8")) > MAX_RESPONSE_BYTES:
        raise RuntimeError("Public holiday snapshot exceeds the allowed size")
    # Collection and validation of both years complete before changing the baseline.
    write_json_atomic(str(output_path), snapshot)
    return snapshot


def main() -> None:
    try:
        snapshot = crawl_public_holidays(os.environ.get("PUBLIC_DATA_SERVICE_KEY", ""))
    except Exception:
        print("[public-holidays] collection failed; previous data preserved. Check API access and response validity.", file=sys.stderr)
        raise SystemExit(1) from None
    print(f"[public-holidays] collected {len(snapshot['holidays'])} dates for {snapshot['years']}")


if __name__ == "__main__":
    main()
