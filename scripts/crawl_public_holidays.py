"""Collect the official current/next-year public holidays without exposing credentials."""

from __future__ import annotations

import json
import os
import re
import sys
import time
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
REQUEST_ATTEMPTS = 3
RETRY_HTTP_STATUSES = {408, 500, 502, 503, 504}
RETRY_API_CODES = {"01", "05", "23"}
KST = timezone(timedelta(hours=9))


class PublicHolidayError(RuntimeError):
    def __init__(self, reason: str, *, year: int | None = None, page: int | None = None,
                 attempt: int | None = None, http_status: int | None = None, api_code: str | None = None):
        super().__init__("Public holiday collection failed")
        self.reason = reason if reason in {
            "CONNECT_TIMEOUT", "READ_TIMEOUT", "TIMEOUT", "CONNECTION_ERROR", "TLS_ERROR", "REQUEST_ERROR",
            "HTTP_ERROR", "API_ERROR", "RESPONSE_TOO_LARGE", "UNSUPPORTED_XML", "INVALID_XML",
            "INVALID_METADATA", "MISSING_BODY", "INVALID_PAGINATION", "INCOMPLETE_PAGE", "INVALID_DATE",
            "DUPLICATE_ITEM", "INVALID_ITEM", "EMPTY_YEAR", "MISSING_KEY", "INVALID_CLOCK", "SNAPSHOT_LIMIT",
        } else "UNKNOWN_ERROR"
        self.http_status = http_status if type(http_status) is int else None
        self.api_code = api_code if isinstance(api_code, str) and re.fullmatch(r"[0-9]{2}", api_code) else None
        self.context = {name: value for name, value in {
            "year": year, "page": page, "attempt": attempt, "httpStatus": self.http_status,
        }.items() if type(value) is int}

    def diagnostic(self) -> str:
        fields = {"code": self.reason, **self.context}
        if self.api_code is not None:
            fields["apiCode"] = self.api_code
        return " ".join(f"{name}={value}" for name, value in fields.items())


def read_integer(element: ET.Element, name: str, minimum: int = 0) -> int:
    value = element.findtext(name, "").strip()
    if not re.fullmatch(r"\d+", value) or int(value) < minimum:
        raise PublicHolidayError("INVALID_METADATA")
    return int(value)


def request_page(session: requests.Session, service_key: str, year: int, page: int) -> ET.Element:
    for attempt in range(1, REQUEST_ATTEMPTS + 1):
        context = {"year": year, "page": page, "attempt": attempt}
        try:
            # A raw key and the portal's encoded key both receive exactly one final encoding.
            with session.get(API_URL, params={
                "ServiceKey": service_key, "solYear": year,
                "numOfRows": PAGE_SIZE, "pageNo": page,
            }, timeout=(10, 30), stream=True, allow_redirects=False) as response:
                context["http_status"] = response.status_code
                if response.status_code != 200:
                    raise PublicHolidayError("HTTP_ERROR", **context)
                payload = bytearray()
                for chunk in response.iter_content(chunk_size=16 * 1024):
                    payload.extend(chunk)
                    if len(payload) > MAX_RESPONSE_BYTES:
                        raise PublicHolidayError("RESPONSE_TOO_LARGE", **context)
            if b"<!DOCTYPE" in payload.upper() or b"<!ENTITY" in payload.upper():
                raise PublicHolidayError("UNSUPPORTED_XML", **context)
            try:
                root = ET.fromstring(payload)
            except ET.ParseError:
                raise PublicHolidayError("INVALID_XML", **context) from None
            raw_code = root.findtext("header/resultCode", "").strip() if root.tag == "response" else (
                root.findtext("cmmMsgHeader/returnReasonCode", "").strip()
                if root.tag == "OpenAPI_ServiceResponse" else ""
            )
            api_code = raw_code if re.fullmatch(r"[0-9]{2}", raw_code) else None
            if root.tag == "response" and api_code == "00":
                return root
            raise PublicHolidayError("API_ERROR", **context, api_code=api_code)
        except requests.exceptions.SSLError:
            failure = PublicHolidayError("TLS_ERROR", **context)
        except requests.exceptions.ConnectTimeout:
            failure = PublicHolidayError("CONNECT_TIMEOUT", **context)
        except requests.exceptions.ReadTimeout:
            failure = PublicHolidayError("READ_TIMEOUT", **context)
        except requests.Timeout:
            failure = PublicHolidayError("TIMEOUT", **context)
        except requests.ConnectionError:
            failure = PublicHolidayError("CONNECTION_ERROR", **context)
        except requests.RequestException:
            failure = PublicHolidayError("REQUEST_ERROR", **context)
        except PublicHolidayError as error:
            failure = error
        retryable = (
            failure.reason in {"CONNECT_TIMEOUT", "READ_TIMEOUT", "TIMEOUT", "CONNECTION_ERROR"}
            or (failure.reason == "HTTP_ERROR" and failure.http_status in RETRY_HTTP_STATUSES)
            or (failure.reason == "API_ERROR" and failure.api_code in RETRY_API_CODES)
        )
        if not retryable or attempt == REQUEST_ATTEMPTS:
            # Request exceptions and XML messages can contain the URL and ServiceKey.
            raise failure from None
        print(f"[retry] [public-holidays] {failure.diagnostic()}; retrying in {attempt}s")
        time.sleep(attempt)
    raise AssertionError("Public holiday request attempts exhausted")


def collect_year(session: requests.Session, service_key: str, year: int) -> dict[str, set[str]]:
    holidays: dict[str, set[str]] = {}
    seen: set[tuple[str, int]] = set()
    total: int | None = None
    count = 0
    page = 1
    while total is None or count < total:
        body = request_page(session, service_key, year, page).find("body")
        if body is None:
            raise PublicHolidayError("MISSING_BODY", year=year, page=page)
        page_total = read_integer(body, "totalCount", 1)
        rows = read_integer(body, "numOfRows", 1)
        if (
            page_total > MAX_YEAR_RECORDS or rows != PAGE_SIZE
            or read_integer(body, "pageNo", 1) != page
            or (total is not None and total != page_total)
        ):
            raise PublicHolidayError("INVALID_PAGINATION", year=year, page=page)
        total = page_total
        items = body.findall("items/item")
        if len(items) != min(PAGE_SIZE, total - count):
            raise PublicHolidayError("INCOMPLETE_PAGE", year=year, page=page)
        for item in items:
            raw_date = item.findtext("locdate", "").strip()
            if not re.fullmatch(r"\d{8}", raw_date) or raw_date[:4] != str(year):
                raise PublicHolidayError("INVALID_DATE", year=year, page=page)
            try:
                date = datetime.strptime(raw_date, "%Y%m%d").strftime("%Y-%m-%d")
            except ValueError:
                raise PublicHolidayError("INVALID_DATE", year=year, page=page) from None
            sequence = read_integer(item, "seq", 1)
            identity = (raw_date, sequence)
            if identity in seen:
                raise PublicHolidayError("DUPLICATE_ITEM", year=year, page=page)
            seen.add(identity)
            name = item.findtext("dateName", "").strip()
            is_holiday = item.findtext("isHoliday", "").strip()
            if not name or len(name) > 100 or is_holiday not in ("Y", "N"):
                raise PublicHolidayError("INVALID_ITEM", year=year, page=page)
            if is_holiday == "Y":
                holidays.setdefault(date, set()).add(name)
        count += len(items)
        page += 1
    if not holidays:
        raise PublicHolidayError("EMPTY_YEAR", year=year)
    return holidays


def crawl_public_holidays(
    service_key: str,
    output_path: Path = OUTPUT_PATH,
    now: datetime | None = None,
    session: requests.Session | None = None,
) -> dict[str, object]:
    if not service_key.strip():
        raise PublicHolidayError("MISSING_KEY")
    timestamp = now or datetime.now(timezone.utc)
    if timestamp.tzinfo is None:
        raise PublicHolidayError("INVALID_CLOCK")
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
        raise PublicHolidayError("SNAPSHOT_LIMIT")
    completed_at = now or datetime.now(timezone.utc)
    snapshot: dict[str, object] = {
        "schemaVersion": 1, "sourceUrl": SOURCE_URL,
        "lastSuccessAt": completed_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "years": years,
        "holidays": [{"date": date, "names": sorted(names)} for date, names in sorted(holidays.items())],
    }
    if len((json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n").encode("utf-8")) > MAX_RESPONSE_BYTES:
        raise PublicHolidayError("SNAPSHOT_LIMIT")
    # Collection and validation of both years complete before changing the baseline.
    write_json_atomic(str(output_path), snapshot)
    return snapshot


def main() -> None:
    try:
        snapshot = crawl_public_holidays(os.environ.get("PUBLIC_DATA_SERVICE_KEY", ""))
    except Exception as error:
        diagnostic = f" {error.diagnostic()}" if isinstance(error, PublicHolidayError) else ""
        print("[public-holidays] collection failed; previous data preserved. Check API access and response validity." + diagnostic, file=sys.stderr)
        raise SystemExit(1) from None
    print(f"[public-holidays] collected {len(snapshot['holidays'])} dates for {snapshot['years']}")


if __name__ == "__main__":
    main()
