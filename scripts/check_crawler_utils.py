"""Check trust-boundary behavior shared by notice crawlers."""

from bs4 import BeautifulSoup

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
    print("Validated notice crawler trust boundary")


if __name__ == "__main__":
    main()
