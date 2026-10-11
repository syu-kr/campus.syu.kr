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
    title_config = crawler.NoticeCrawlerConfig(
        category="academic", label="title fixture", base_url="https://www.syu.ac.kr/academic/",
        output_path="unused.json", default_author="교무처",
    )
    for title_markup in [
        '<span class="md_cate">장학</span> 신청 안내',
        '<span class="md_cate">장학</span><span class="tit">신청 안내</span>',
        '<span class="tit"><span class="md_cate">장학</span> 신청 안내</span>',
    ]:
        source_row = board(row("title").replace('<span class="tit">title</span>', title_markup)).select_one("tr")
        assert crawler.extract_notice_row(source_row, title_config)["title"] == "장학 신청 안내"

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
        for malformed in [row("missing-date", date=""), row("missing-url", href=""), row("invalid-url", href="https://[broken"), missing_anchor, row("")]:
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

        guide_url = "https://www.syu.ac.kr/academic/course-guide/"
        course_guide = BeautifulSoup(
            '<a href="?c=cse">컴퓨터공학부</a>'
            '<a href="/admissions-education/college/engineering/">공과대학</a>',
            "html.parser",
        )
        assert departments.discover_course_guide_department_names(course_guide, guide_url) == ["컴퓨터공학부"]
        assert departments.discover_college_page_urls(course_guide, guide_url, set()) == [
            "https://www.syu.ac.kr/admissions-education/college/engineering/",
        ]
        with (
            patch.dict(os.environ, {"CRAWL_DEPARTMENT_COURSE_GUIDE_URL": guide_url}),
            patch.object(departments, "OUTPUT_PATH", str(output)),
            patch.object(departments, "request_soup", return_value=course_guide) as guide_request,
            patch.object(departments, "discover_department_sites_from_college_pages", return_value=[]),
            contextlib.redirect_stdout(io.StringIO()),
        ):
            departments.crawl_department_notices()
        assert guide_request.call_count == 1
        assert guide_request.call_args.args[1] == guide_url

        department = {"name": "컴퓨터공학부", "url": "https://www.syu.ac.kr/cse"}
        department_config = crawler.NoticeCrawlerConfig(
            category="campus", label="department fixture", base_url="https://www.syu.ac.kr/cse/community/notice/page",
            output_path=str(output), default_author=department["name"], max_pages=1,
        )
        for valid_board in [board(row("일반 학과 안내")), board('<tr><td colspan="5">공지가 없습니다</td></tr>'), board()]:
            log = io.StringIO()
            with patch.object(departments, "request_soup", return_value=valid_board), contextlib.redirect_stdout(log):
                candidates = departments.crawl_department_board(None, department_config, department, {}, [], 0)
            assert candidates == {}
            assert "[warn]" not in log.getvalue()

        untitled = (
            '<tr><th class="step1" scope="row">13</th><td class="step2"><h3>'
            '<a class="itembx" href="https://www.syu.ac.kr/english/1179-2/?pageds=1&amp;k=test">'
            '<span class="tit"></span></a></h3></td><td class="step3">삼육대학교</td>'
            '<td class="step4">2015.09.10</td><td class="step5">'
            '<a class="file_icon" href="" title="첨부파일 다운로드">file download</a></td>'
            '<td class="step6 mo_hidden">10,546</td></tr>'
        )
        for meaningful_row in [row("공모전 정상 후보"), row("일반 학과 안내")]:
            log = io.StringIO()
            with patch.object(departments, "request_soup", return_value=board(untitled, meaningful_row)), contextlib.redirect_stdout(log):
                candidates = departments.crawl_department_board(None, department_config, department, {}, [], 0)
            assert len(candidates) == (1 if "공모전" in meaningful_row else 0)
            assert "[info]" in log.getvalue()
            assert "[warn]" not in log.getvalue()

        with patch.object(departments, "request_soup", return_value=board(untitled)), contextlib.redirect_stdout(io.StringIO()):
            try:
                departments.crawl_department_board(None, department_config, department, {}, [], 0)
            except RuntimeError:
                pass
            else:
                raise AssertionError("An entirely untitled department board was accepted")

        for malformed in [
            row("공모전 날짜 누락", date=""), missing_anchor,
            row("공모전 잘못된 URL", href="javascript:alert(1)"),
            row("", date=""), row("", date="2026.99.99"), row("", href="https://example.com/notice"),
            row("", pinned=True), row("").replace('<span class="tit"></span>', ""),
            row("").replace('<span class="tit"></span>', '<span class="tit"></span>숨은 원문 제목'),
            row("").replace('<span class="tit"></span>', '<span class="tit"><img alt="이미지 제목"></span>'),
        ]:
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
                patch.object(departments, "request_soup", return_value=board(row("공모전 정상 후보"), malformed)),
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
