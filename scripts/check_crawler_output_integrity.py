"""Check crawler output integrity using isolated HTML fixtures and temporary files."""

from __future__ import annotations

import contextlib
import io
import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

from bs4 import BeautifulSoup

# CLI crawlers wrap stdout at import time; retain each wrapper while testing together.
_stdout_wrappers = [sys.stdout]
import crawl_cafeteria as cafeteria

_stdout_wrappers.append(sys.stdout)
import crawl_schedule as schedule

_stdout_wrappers.append(sys.stdout)
import check_monthly_crawl_data as monthly


def menu_table(headers: list[str], rows: list[list[str]]) -> BeautifulSoup:
    # Official table: meal labels span two columns; lunch shares a row heading.
    headings = '<th colspan="2">구분</th>' + "".join(f"<th>{value}</th>" for value in headers)
    labels = ['<th colspan="2">조식</th>', '<th rowspan="2">중식</th>', "", '<th colspan="2">석식</th>']
    body = "".join(
        "<tr>" + labels[index] + "".join(f"<td>{value}</td>" for value in row) + "</tr>"
        for index, row in enumerate(rows)
    )
    return BeautifulSoup(
        f'<table class="weekly-menu-table"><thead><tr>{headings}</tr></thead>'
        f"<tbody>{body}</tbody></table>",
        "html.parser",
    )


def calendar(date_text: str, month: str = "2") -> BeautifulSoup:
    return BeautifulSoup(
        '<div class="md_textcalendar"><dl><div class="year">2026</div>'
        f'<div class="month">{month}</div><ul><li><dl><dt>{date_text}</dt>'
        "<dd>일정</dd></dl></li></ul></dl></div>",
        "html.parser",
    )


def main() -> None:
    original_cwd = Path.cwd()
    with tempfile.TemporaryDirectory(prefix="syu-crawler-integrity-") as directory:
        root = Path(directory)
        data_dir = root / "public" / "data"
        data_dir.mkdir(parents=True)
        menu_path = data_dir / "cafeteria-menu.json"
        schedule_path = data_dir / "schedules-major.json"
        headers = ["10월 5일 (월)", "10월 6일 (화)", "10월 7일 (수)", "10월 8일 (목)", "10월 9일 (금)"]
        rows = [
            ["조식 월", "조식 화", "조식 수", "조식 목", "조식 금"],
            ["A", "A 월", "A 화", "A 수", "A 목", "A 금"],
            ["B", "B 월", "B 화", "B 수", "B 목", "B 금"],
            ["석식 월", "석식 화", "석식 수", "석식 목", "석식 금"],
        ]
        baseline = (json.dumps({
            "id": "cafeteria", "name": "식당", "weekStart": "2026-09-28", "menus": [],
            "lastUpdated": "2026-09-28T03:00:00Z",
        }) + "\r\n").encode()
        try:
            os.chdir(root)
            with patch.dict(os.environ, {
                "CRAWL_CAFETERIA_URL": "https://fixture.invalid/menu",
                "CRAWL_ACADEMIC_SCHEDULE_URL": "https://fixture.invalid/calendar",
            }), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                malformed_tables = [
                    menu_table([headers[0], "해석 불가", *headers[2:]], rows),
                    menu_table([headers[0], "", *headers[2:]], rows),
                ]
                for row_index in range(4):
                    missing_cell_rows = [list(row) for row in rows]
                    missing_cell_rows[row_index].pop()
                    malformed_tables.append(menu_table(headers, missing_cell_rows))
                for soup in malformed_tables:
                    menu_path.write_bytes(baseline)
                    with patch.object(cafeteria, "request_soup", return_value=soup):
                        try:
                            cafeteria.crawl_cafeteria_menu()
                        except RuntimeError:
                            pass
                        else:
                            raise AssertionError("Incomplete cafeteria table was accepted")
                    assert menu_path.read_bytes() == baseline

                with patch.object(cafeteria, "request_soup", return_value=menu_table(headers, rows)):
                    cafeteria.crawl_cafeteria_menu()
                menus = json.loads(menu_path.read_text(encoding="utf-8"))["menus"]
                assert len(menus) == 5
                assert menus[4]["meals"]["lunch"]["a_corner"] == ["A 금"]

                empty_rows = [[""] * 5, ["A", *([""] * 5)], ["B", *([""] * 5)], [""] * 5]
                with patch.object(cafeteria, "request_soup", return_value=menu_table(headers, empty_rows)):
                    cafeteria.crawl_cafeteria_menu()
                menus = json.loads(menu_path.read_text(encoding="utf-8"))["menus"]
                assert menus[0]["meals"] == cafeteria.closed_meals()

                for date_text, month in [
                    ("31", "2"), ("31", "4"), ("1", "13"), ("0", "2"),
                    ("10.12.3", "10"), ("10..12", "10"), ("10.12x", "10"),
                    ("10.12 ~ 13.14.15", "10"),
                ]:
                    schedule_path.write_bytes(b"[]\r\n")
                    with patch.object(schedule, "request_soup", return_value=calendar(date_text, month)):
                        try:
                            schedule.crawl_schedule()
                        except ValueError:
                            pass
                        else:
                            raise AssertionError("Impossible calendar date was accepted")
                    assert schedule_path.read_bytes() == b"[]\r\n"

                previous_schedules = [
                    {"id": "old-date", "title": "일정", "startDate": "2026.10.10", "endDate": "2026.10.10", "category": "event"},
                    {"id": "cancelled", "title": "취소된 일정", "startDate": "2026.10.05", "endDate": "2026.10.05", "category": "event"},
                    {"id": "uncollected", "title": "미수집 월 일정", "startDate": "2026.09.20", "endDate": "2026.09.20", "category": "event"},
                ]
                schedule_baseline = (json.dumps(previous_schedules) + "\r\n").encode()
                schedule_path.write_bytes(schedule_baseline)
                complete_month = calendar("12", "10")
                with patch.object(schedule, "request_soup", return_value=complete_month):
                    schedule.crawl_schedule()
                updated = json.loads(schedule_path.read_text(encoding="utf-8"))
                assert len(updated) == 2
                assert updated[0]["startDate"] == "2026.10.12"
                assert updated[1] == previous_schedules[2]

                partial_month = calendar("12", "10")
                partial_month.select_one("ul").append(BeautifulSoup("<li><dl><dt>13</dt></dl></li>", "html.parser"))
                missing_header = calendar("12", "10")
                missing_header.select_one(".year").decompose()
                empty_month = calendar("12", "10")
                empty_month.select_one("li").decompose()
                duplicate_month = BeautifulSoup(str(complete_month) + str(complete_month), "html.parser")
                for soup in [partial_month, missing_header, empty_month, duplicate_month, calendar("09.12", "10")]:
                    schedule_path.write_bytes(schedule_baseline)
                    with patch.object(schedule, "request_soup", return_value=soup):
                        try:
                            schedule.crawl_schedule()
                        except RuntimeError:
                            pass
                        else:
                            raise AssertionError("Incomplete calendar month was accepted")
                    assert schedule_path.read_bytes() == schedule_baseline

            assert schedule.parse_schedule_dates("2028", "2", "29") == ("2028.02.29", "2028.02.29")
            assert schedule.parse_schedule_dates("2027", "12", "12.21 ~ 02.29") == ("2027.12.21", "2028.02.29")
            assert schedule.parse_schedule_dates("2026", "12", "12.21 ~ 01.12") == ("2026.12.21", "2027.01.12")
            for invalid in ["10.12.3", "10..12", "10.12x", "", " . ", "10."]:
                try:
                    schedule.normalize_schedule_date("2026", "10", invalid)
                except ValueError:
                    pass
                else:
                    raise AssertionError("Malformed date component was shortened")
            with patch.object(monthly, "DATA_DIR", data_dir):
                for date_text in ["2026.02.31", "2026.04.31", "2026.13.01", "2026.02.00"]:
                    schedule_path.write_text(json.dumps([{
                        "id": "fixture", "title": "일정", "startDate": date_text, "endDate": date_text,
                    }]), encoding="utf-8")
                    try:
                        monthly.validate_schedules()
                    except RuntimeError:
                        pass
                    else:
                        raise AssertionError("Monthly validator accepted an impossible date")
                schedule_path.write_text(json.dumps([{
                    "id": "leap", "title": "윤일", "startDate": "2028.02.29", "endDate": "2028.02.29",
                }]), encoding="utf-8")
                monthly.validate_schedules()
        finally:
            os.chdir(original_cwd)
    print("Validated isolated cafeteria and calendar output integrity")


if __name__ == "__main__":
    main()
