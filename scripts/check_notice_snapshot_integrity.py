"""Check current notice pins and incomplete-row rejection using isolated snapshots."""

from __future__ import annotations

import contextlib
import io
import json
import os
import tempfile
from pathlib import Path
from unittest.mock import patch

from bs4 import BeautifulSoup

import crawler_utils as crawler
import crawl_department_notices as departments


def row(slug: str, *, pinned: bool = False, date: str = "2026.10.03", href: str | None = None) -> str:
    number = '<span class="notice_icon">공지</span>' if pinned else "123"
    target = href if href is not None else f"/blog/{slug}"
    return (
        f'<tr><th class="step1">{number}</th><td><a href="{target}"><span class="tit">{slug}</span></a></td>'
        f"<td>교무처</td><td>{date}</td><td>1</td></tr>"
    )


def board(*rows: str) -> BeautifulSoup:
    return BeautifulSoup("<table><tbody>" + "".join(rows) + "</tbody></table>", "html.parser")


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="syu-notice-integrity-") as directory:
        output = Path(directory) / "notices.json"
        old_items = [
            {"id": "old-pin", "title": "old-pin", "date": "2026.09.01", "author": "교무처", "url": "https://www.syu.ac.kr/blog/old-pin", "category": "academic", "isImportant": False, "isPinned": True},
            {"id": "promoted", "title": "promoted", "date": "2026.10.03", "author": "교무처", "url": "https://www.syu.ac.kr/blog/promoted", "category": "academic", "isImportant": False, "isPinned": False},
        ]
        baseline = (json.dumps(old_items) + "\r\n").encode()
        config = crawler.NoticeCrawlerConfig(
            category="academic", label="fixture", base_url="https://fixture.invalid/page",
            output_path=str(output), default_author="교무처", max_pages=2,
        )
        output.write_bytes(baseline)
        first = board(row("promoted", pinned=True), row("fresh-pin", pinned=True), row("fresh-regular"))
        second = board(row("promoted"))
        with patch.object(crawler, "request_soup", side_effect=[first, second]), contextlib.redirect_stdout(io.StringIO()):
            crawler.crawl_notice_board(config)
        notices = {item["title"]: item for item in json.loads(output.read_text(encoding="utf-8"))}
        assert notices["old-pin"]["isPinned"] is False
        assert notices["old-pin"]["id"] == "old-pin"
        assert notices["promoted"]["isPinned"] is True
        assert notices["promoted"]["id"] == "promoted"
        assert notices["fresh-pin"]["isPinned"] is True
        assert notices["fresh-regular"]["isPinned"] is False

        output.write_bytes(baseline)
        no_pins = board(row("regular"), '<tr><td colspan="5">보조 행</td></tr>')
        config.max_pages = 1
        with patch.object(crawler, "request_soup", return_value=no_pins), contextlib.redirect_stdout(io.StringIO()):
            crawler.crawl_notice_board(config)
        notices = json.loads(output.read_text(encoding="utf-8"))
        assert len(notices) == 3
        assert all(not item["isPinned"] for item in notices)

        missing_anchor = row("missing-anchor").replace('<a href="/blog/missing-anchor">', "").replace("</a>", "")
        for malformed in [row("missing-date", date=""), row("missing-url", href=""), row("invalid-url", href="https://[broken"), missing_anchor]:
            output.write_bytes(baseline)
            log = io.StringIO()
            with patch.object(crawler, "request_soup", return_value=board(row("valid"), malformed)), contextlib.redirect_stdout(log):
                try:
                    crawler.crawl_notice_board(config)
                except RuntimeError:
                    pass
                else:
                    raise AssertionError("Incomplete first-page notice was accepted")
            assert "[warn]" in log.getvalue()
            assert output.read_bytes() == baseline

        output.write_bytes(baseline)
        config.max_pages = 2
        with patch.object(crawler, "request_soup", side_effect=[board(row("fresh")), board(row("missing-date", date=""))]), contextlib.redirect_stdout(io.StringIO()):
            try:
                crawler.crawl_notice_board(config)
            except RuntimeError:
                pass
            else:
                raise AssertionError("Incomplete later-page notice was accepted")
        assert output.read_bytes() == baseline

        output.write_bytes(baseline)
        with patch.object(crawler, "request_soup", return_value=board('<tr><td colspan="5">공지가 없습니다</td></tr>')) as request, contextlib.redirect_stdout(io.StringIO()):
            try:
                crawler.crawl_notice_board(config)
            except RuntimeError:
                pass
            else:
                raise AssertionError("Unverified empty first page was accepted")
        assert request.call_count == 1
        assert output.read_bytes() == baseline

        department = {"name": "컴퓨터공학부", "url": "https://www.syu.ac.kr/cse"}
        department_config = crawler.NoticeCrawlerConfig(
            category="campus", label="department fixture", base_url="https://www.syu.ac.kr/cse/community/notice/page",
            output_path=str(output), default_author=department["name"], max_pages=1,
        )
        for valid_board in [board(row("일반 학과 안내")), board('<tr><td colspan="5">공지가 없습니다</td></tr>'), board()]:
            log = io.StringIO()
            with patch.object(departments, "safe_request_soup", return_value=valid_board), contextlib.redirect_stdout(log):
                candidates = departments.crawl_department_board(None, department_config, department, {}, [], 0)
            assert candidates == {}
            assert "[warn]" not in log.getvalue()

        for malformed in [row("공모전 날짜 누락", date=""), missing_anchor, row("공모전 잘못된 URL", href="javascript:alert(1)")]:
            output.write_bytes(baseline)
            log = io.StringIO()
            with (
                patch.dict(os.environ, {
                    "CRAWL_DEPARTMENT_COURSE_GUIDE_URL": "https://www.syu.ac.kr/academic/course-guide/",
                    "CRAWL_DEPARTMENT_COLLEGE_EXCLUDE_URLS": "",
                    "CRAWL_DEPARTMENT_NOTICE_QUERY_URLS": "",
                }),
                patch.object(departments, "OUTPUT_PATH", str(output)),
                patch.object(departments, "discover_course_guide_department_names", return_value=[department["name"]]),
                patch.object(departments, "discover_college_page_urls", return_value=["https://www.syu.ac.kr/engineering"]),
                patch.object(departments, "discover_department_sites_from_college_pages", return_value=[department]),
                patch.object(departments, "discover_notice_board_url", return_value=department_config.base_url),
                patch.object(departments, "safe_request_soup", return_value=board(row("공모전 정상 후보"), malformed)),
                contextlib.redirect_stdout(log),
            ):
                try:
                    departments.crawl_department_notices()
                except RuntimeError:
                    pass
                else:
                    raise AssertionError("Incomplete department source was accepted")
            assert "[warn]" in log.getvalue()
            assert output.read_bytes() == baseline
    print("Validated isolated notice pins and row integrity")


if __name__ == "__main__":
    main()
