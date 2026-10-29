"""Focused offline checks for official holiday collection, completeness, and rollback."""

from __future__ import annotations

import contextlib
import io
import json
import tempfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import call, patch

import requests

from crawl_public_holidays import (
    API_URL, MAX_RESPONSE_BYTES, PAGE_SIZE, SOURCE_URL, PublicHolidayError,
    crawl_public_holidays, main, request_page,
)

NOW = datetime(2026, 10, 4, tzinfo=timezone.utc)


def item(date: str, name: str = "공휴일", holiday: str = "Y", sequence: int = 1) -> dict[str, str]:
    return {"locdate": date, "dateName": name, "isHoliday": holiday, "seq": str(sequence)}


def xml_page(items: list[dict[str, str]], total: int | None = None, page: int = 1) -> bytes:
    root = ET.Element("response")
    header = ET.SubElement(root, "header")
    ET.SubElement(header, "resultCode").text = "00"
    body = ET.SubElement(root, "body")
    for name, value in {"totalCount": total if total is not None else len(items), "pageNo": page, "numOfRows": PAGE_SIZE}.items():
        ET.SubElement(body, name).text = str(value)
    container = ET.SubElement(body, "items")
    for fields in items:
        entry = ET.SubElement(container, "item")
        for name, value in fields.items():
            ET.SubElement(entry, name).text = value
    return ET.tostring(root, encoding="utf-8")


class Response:
    status_code = 200

    def __init__(self, payload: bytes, status: int = 200, stream_error=None):
        self.payload = payload
        self.status_code = status
        self.stream_error = stream_error
        self.closed = False

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.closed = True
        return False

    def iter_content(self, chunk_size: int):
        if self.stream_error is not None:
            raise self.stream_error
        for start in range(0, len(self.payload), chunk_size):
            yield self.payload[start:start + chunk_size]


class Session:
    def __init__(self, pages: dict[tuple[int, int], bytes]):
        self.pages = pages
        self.requests: list[dict[str, object]] = []

    def get(self, url: str, **kwargs):
        assert url == API_URL and kwargs["allow_redirects"] is False
        params = kwargs["params"]
        self.requests.append(params)
        return Response(self.pages[(params["solYear"], params["pageNo"])])


def expect_failure(callback) -> RuntimeError | KeyError:
    try:
        callback()
    except (RuntimeError, KeyError) as error:
        return error
    else:
        raise AssertionError("Incomplete or invalid holiday collection unexpectedly succeeded")

class SequenceSession:
    def __init__(self, outcomes):
        self.outcomes = iter(outcomes)
        self.requests = []

    def get(self, url: str, **kwargs):
        assert url == API_URL and kwargs["allow_redirects"] is False
        assert kwargs["timeout"] == (10, 30) and kwargs["stream"] is True
        self.requests.append(kwargs["params"])
        outcome = next(self.outcomes)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def check_request_recovery() -> None:
    secret = "sentinel+key/=="
    encoded = "sentinel%2Bkey%2F%3D%3D"
    sensitive = f"{API_URL}?ServiceKey={secret}&encoded={encoded}"
    first = xml_page([item("20260101")])
    second = xml_page([item("20270101")])
    transient = [
        requests.Timeout(sensitive), requests.exceptions.ConnectTimeout(sensitive),
        requests.exceptions.ReadTimeout(sensitive), requests.ConnectionError(sensitive),
        Response(second, stream_error=requests.exceptions.ReadTimeout(sensitive)),
        *[Response(b"private-response", status) for status in (408, 500, 502, 503, 504)],
        *[Response(f"<response><header><resultCode>{code}</resultCode></header></response>".encode())
          for code in ("01", "05", "23")],
        Response(b"<OpenAPI_ServiceResponse><cmmMsgHeader><returnReasonCode>23</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>"),
    ]
    log = io.StringIO()
    with tempfile.TemporaryDirectory(prefix="syu-holiday-retry-") as temporary:
        output = Path(temporary) / "holidays.json"
        for outcome in transient:
            session = SequenceSession([Response(first), outcome, Response(second)])
            with patch("crawl_public_holidays.time.sleep") as sleep, contextlib.redirect_stdout(log):
                snapshot = crawl_public_holidays(encoded, output, NOW, session)
            assert snapshot["years"] == [2026, 2027] and len(snapshot["holidays"]) == 2
            assert [(entry["solYear"], entry["pageNo"]) for entry in session.requests] == [(2026, 1), (2027, 1), (2027, 1)]
            assert all(entry["ServiceKey"] == secret for entry in session.requests)
            assert sleep.call_args_list == [call(1)]
            if isinstance(outcome, Response):
                assert outcome.closed
            assert secret not in output.read_text(encoding="utf-8")
        baseline = output.read_bytes()
        for outcomes in [
            [requests.exceptions.ConnectTimeout(sensitive)] * 3,
            [Response(b"private-response", 503) for _ in range(3)],
            [Response(b"<response><header><resultCode>01</resultCode></header></response>") for _ in range(3)],
        ]:
            session = SequenceSession([Response(first), *outcomes])
            with patch("crawl_public_holidays.time.sleep") as sleep, contextlib.redirect_stdout(log):
                error = expect_failure(lambda: crawl_public_holidays(secret, output, NOW, session))
            assert isinstance(error, PublicHolidayError)
            assert error.context["attempt"] == 3 and error.context["year"] == 2027
            assert len(session.requests) == 4 and sleep.call_args_list == [call(1), call(2)]
            assert output.read_bytes() == baseline
            log.write(error.diagnostic())
        permanent = [
            requests.exceptions.SSLError(sensitive), requests.RequestException(sensitive),
            *[Response(b"private-response", status) for status in (400, 401, 403, 404, 429, 501)],
            *[Response(f"<response><header><resultCode>{code}</resultCode></header></response>".encode())
              for code in ("22", "30", "01" + secret)],
            Response(b"<response>"),
            Response(b"<response><header><resultCode>00</resultCode></header><body/></response>"),
            Response(b"<OpenAPI_ServiceResponse><cmmMsgHeader><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>"),
        ]
        for outcome in permanent:
            session = SequenceSession([Response(first), outcome])
            with patch("crawl_public_holidays.time.sleep") as sleep, contextlib.redirect_stdout(log):
                error = expect_failure(lambda: crawl_public_holidays(secret, output, NOW, session))
            assert isinstance(error, PublicHolidayError)
            assert len(session.requests) == 2 and not sleep.called
            assert output.read_bytes() == baseline
            log.write(error.diagnostic())
    assert "[retry]" in log.getvalue() and "[warn]" not in log.getvalue()
    assert "code=CONNECT_TIMEOUT year=2027 page=1 attempt=1" in log.getvalue()
    assert "httpStatus=503" in log.getvalue() and "apiCode=01" in log.getvalue()
    assert secret not in log.getvalue() and encoded not in log.getvalue() and API_URL not in log.getvalue()
    for error, expected in [
        (PublicHolidayError("HTTP_ERROR", year=2027, page=1, attempt=1, http_status=403), "code=HTTP_ERROR year=2027 page=1 attempt=1 httpStatus=403"),
        (PublicHolidayError(secret, api_code=secret), "code=UNKNOWN_ERROR"),
    ]:
        stderr = io.StringIO()
        with patch("crawl_public_holidays.crawl_public_holidays", side_effect=error), contextlib.redirect_stderr(stderr):
            try:
                main()
            except SystemExit as exit_error:
                assert exit_error.code == 1
            else:
                raise AssertionError("Failed collection returned success")
        assert expected in stderr.getvalue() and "previous data preserved" in stderr.getvalue()
        assert secret not in stderr.getvalue() and encoded not in stderr.getvalue()


def checks() -> None:
    with tempfile.TemporaryDirectory(prefix="syu-public-holidays-") as temporary:
        output = Path(temporary) / "holidays.json"
        records = [item((datetime(2026, 1, 1) + timedelta(days=day)).strftime("%Y%m%d")) for day in range(101)]
        records[1]["isHoliday"] = "N"
        records.append(item("20260101", "추가 공휴일명", sequence=2))
        pages = {
            (2026, 1): xml_page(records[:100], len(records)),
            (2026, 2): xml_page(records[100:], len(records), page=2),
            (2027, 1): xml_page([item("20271009", "한글날")]),
        }
        for key in ("test+key/==", "test%2Bkey%2F%3D%3D"):
            session = Session(pages)
            snapshot = crawl_public_holidays(key, output, NOW, session)
            assert snapshot["years"] == [2026, 2027]
            assert snapshot["sourceUrl"] == SOURCE_URL
            assert snapshot["lastSuccessAt"] == "2026-10-04T00:00:00Z"
            assert all(request["ServiceKey"] == "test+key/==" for request in session.requests)
            assert len(session.requests) == 3
            assert snapshot["holidays"][0]["names"] == ["공휴일", "추가 공휴일명"]
            assert all(holiday["date"] != "2026-01-02" for holiday in snapshot["holidays"])
            assert json.loads(output.read_text(encoding="utf-8")) == snapshot
            assert "test+key" not in output.read_text(encoding="utf-8")

        baseline = output.read_bytes()
        invalid_pages = [
            xml_page([item("20270230")]),
            xml_page([item("20261009")]),
            xml_page([item("20271009", holiday="unknown")]),
            xml_page([item("20271009", name="")]),
            xml_page([item("20271009", holiday="N")]),
            xml_page([item("20271009")], total=2),
            xml_page([item("20271009"), item("20271009")]),
            xml_page([]),
            xml_page([item("20271009")], page=2),
            b"<response><header><resultCode>30</resultCode></header></response>",
            b"<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>DENIED</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>",
            b"<response>",
            b'<!DOCTYPE response [<!ENTITY x "x">]><response />',
            b" " * (MAX_RESPONSE_BYTES + 1),
        ]
        for invalid in invalid_pages:
            session = Session({**pages, (2027, 1): invalid})
            expect_failure(lambda: crawl_public_holidays("test", output, NOW, session))
            assert output.read_bytes() == baseline
            assert len(session.requests) == 3
        changed_total = Session({**pages, (2026, 2): xml_page(records[100:], len(records) + 1, page=2)})
        expect_failure(lambda: crawl_public_holidays("test", output, NOW, changed_total))
        assert output.read_bytes() == baseline
        expect_failure(lambda: crawl_public_holidays("", output, NOW, Session(pages)))
        assert output.read_bytes() == baseline

        new_year = Session({
            (2027, 1): xml_page([item("20270101")]),
            (2028, 1): xml_page([item("20280101")]),
        })
        snapshot = crawl_public_holidays("test", output, datetime(2026, 12, 31, 15, tzinfo=timezone.utc), new_year)
        assert snapshot["years"] == [2027, 2028]

    with patch("requests.Session.get", side_effect=requests.RequestException("secret-full-url")) as get:
        error = expect_failure(lambda: request_page(requests.Session(), "secret", 2026, 1))
        assert isinstance(error, PublicHolidayError) and error.reason == "REQUEST_ERROR"
        assert get.call_count == 1
    stderr = io.StringIO()
    with patch("crawl_public_holidays.crawl_public_holidays", side_effect=RuntimeError("secret-full-url")), contextlib.redirect_stderr(stderr):
        try:
            main()
        except SystemExit as error:
            assert error.code == 1
        else:
            raise AssertionError("Failed collection returned success")
    assert "secret" not in stderr.getvalue()
    assert "previous data preserved" in stderr.getvalue()
    check_request_recovery()
    print("Validated public holiday pagination, key normalization, KST rollover, bounded recovery, safe diagnostics, and failure preservation")


if __name__ == "__main__":
    checks()
