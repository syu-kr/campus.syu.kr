"""Check trust-boundary behavior shared by notice crawlers."""

import os

from bs4 import BeautifulSoup

from crawl_department_notices import (
    build_notice_request_urls,
    read_official_url_set_env,
    to_notice_board_base_url,
)
from crawler_utils import NoticeCrawlerConfig, extract_notice_row, request_soup


def main() -> None:
    config = NoticeCrawlerConfig(
        category="academic",
        label="test",
        base_url="https://www.syu.ac.kr/academic/",
        output_path="unused.json",
        default_author="교무처",
    )
    valid = BeautifulSoup(
        '<tr><td><a href="/notice/1">공지</a></td><td>교무처</td>'
        '<td>2026.09.14</td><td>1</td></tr>',
        "html.parser",
    ).select_one("tr")
    missing_date = BeautifulSoup(
        '<tr><td><a href="/notice/2">날짜 없음</a></td><td>교무처</td>'
        '<td></td><td>1</td></tr>',
        "html.parser",
    ).select_one("tr")

    assert valid is not None and extract_notice_row(valid, config) is not None
    assert missing_date is not None and extract_notice_row(missing_date, config) is None

    class FakeResponse:
        status_code = 200
        headers = {"Content-Type": "text/html; charset=utf-8"}

        @staticmethod
        def iter_content(chunk_size: int):
            del chunk_size
            return iter([b"<html><body>ok</body></html>"])

    class FakeSession:
        @staticmethod
        def request(method: str, url: str, timeout: int, stream: bool):
            del method, url, timeout, stream
            return FakeResponse()

    assert request_soup(FakeSession(), "https://www.syu.ac.kr") is not None
    assert request_soup(FakeSession(), "https://www.syu.ac.kr", max_bytes=8) is None

    standard_board = to_notice_board_base_url(
        "https://example.syu.ac.kr/department/community/notice/",
        set(),
    )
    assert standard_board == "https://example.syu.ac.kr/department/community/notice/page"
    assert build_notice_request_urls(standard_board, 2, ["공모"], 1) == [
        "https://example.syu.ac.kr/department/community/notice/page/1/",
        "https://example.syu.ac.kr/department/community/notice/page/2/",
        "https://example.syu.ac.kr/department/community/notice/page/1/?k=%EA%B3%B5%EB%AA%A8",
    ]

    query_url = "https://example.syu.ac.kr/special/community/notice/"
    os.environ["TEST_DEPARTMENT_QUERY_URLS"] = query_url
    query_urls = read_official_url_set_env("TEST_DEPARTMENT_QUERY_URLS")
    query_board = to_notice_board_base_url(
        query_url,
        query_urls,
    )
    del os.environ["TEST_DEPARTMENT_QUERY_URLS"]
    assert query_board == query_url
    assert build_notice_request_urls(query_board, 2, ["공모"], 1) == [
        "https://example.syu.ac.kr/special/community/notice/?var_page=1",
        "https://example.syu.ac.kr/special/community/notice/?var_page=2",
        "https://example.syu.ac.kr/special/community/notice/?var_page=1&K=%EA%B3%B5%EB%AA%A8",
    ]
    print("Validated notice crawler trust boundary")


if __name__ == "__main__":
    main()
