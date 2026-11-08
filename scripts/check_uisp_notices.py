"""Exercise the UISP board's actual row shape without network or shared output."""

import contextlib
import io
import json
import tempfile
from pathlib import Path
from unittest.mock import patch

from bs4 import BeautifulSoup

import crawl_uisp_notices as crawler


def row(post_id="744", title="프로그램 안내", date="26.11.06", pinned=False, href=None):
    href = href if href is not None else f"./board.php?bo_table=notice&wr_id={post_id}&page=2"
    return (
        f'<tr class="{"bo_notice" if pinned else ""}"><td>710</td>'
        f'<td><div class="bo_tit"><a href="{href}">{title}</a></div></td>'
        f'<td class="sv_use">혁신지원사업단</td><td>{date}</td></tr>'
    )


def board(*rows, last_page=1):
    return BeautifulSoup(
        '<div id="bo_list"><table><tbody>' + "".join(rows) + '</tbody></table></div>'
        f'<nav class="pg_wrap"><a href="?bo_table=notice&page={last_page}">맨끝</a></nav>',
        "html.parser",
    )


def main():
    parsed = crawler.parse_notice_row(board(row()).select_one("tr"))
    assert parsed["id"] == "uisp-744" and parsed["date"] == "2026.11.06"
    assert parsed["url"] == crawler.BASE_URL + "&wr_id=744"
    assert parsed["category"] == "uisp" and parsed["author"] == "대학혁신지원사업단"
    assert "views" not in parsed
    assert crawler.parse_notice_row(board(row("743")).select_one("tr"))["id"] != parsed["id"]
    assert crawler.parse_notice_row(board(row(date="24.02.29")).select_one("tr"))["date"] == "2024.02.29"
    for malformed in [
        row(date=""), row(date="26.02.30"), row(title=""), row(href=""),
        row(href="https://evil.invalid/bbs/board.php?bo_table=notice&wr_id=1"),
        row(href="http://uisp-origin.example.invalid:8080/bbs/board.php?bo_table=notice&wr_id=1"),
        row(href="http://uisp-origin.example.invalid/bbs/board.php?bo_table=other&wr_id=1"),
        row(post_id="abc"), '<tr><td colspan="4">내용 없음</td></tr>',
    ]:
        try:
            crawler.parse_notice_row(board(malformed).select_one("tr"))
        except ValueError:
            pass
        else:
            raise AssertionError("Invalid UISP row was accepted")

    with tempfile.TemporaryDirectory(prefix="syu-uisp-") as directory:
        output = Path(directory) / "notices.json"
        old = {**parsed, "id": "uisp-1", "url": crawler.BASE_URL + "&wr_id=1", "isPinned": True}
        baseline = (json.dumps([old]) + "\r\n").encode()
        with patch.object(crawler, "OUTPUT_PATH", str(output)), patch.object(crawler.time, "sleep"), contextlib.redirect_stdout(io.StringIO()):
            output.write_bytes(baseline)
            first = board(row(pinned=True), row("743", title="전체 제목…"), last_page=2)
            detail = BeautifulSoup('<h2 id="bo_v_title"><span class="bo_v_tit">전체 제목 복원</span></h2>', "html.parser")
            second = board(row("744"), row("1"), last_page=2)
            with patch.object(crawler, "request_soup", side_effect=[first, detail, second]) as request:
                crawler.crawl_uisp_notices()
            items = {item["id"]: item for item in json.loads(output.read_text(encoding="utf-8"))}
            assert len(items) == 3
            assert items["uisp-744"]["isPinned"] and not items["uisp-1"]["isPinned"]
            assert items["uisp-743"]["title"] == "전체 제목 복원"
            assert request.call_args_list[-1].args[1].endswith("&page=2")
            with patch.object(crawler, "request_soup", return_value=board(row("743"), last_page=48)) as request:
                crawler.crawl_uisp_notices()
            assert request.call_count == 1
            assert len(json.loads(output.read_text(encoding="utf-8"))) == 3
            assert not any(item["isPinned"] for item in json.loads(output.read_text(encoding="utf-8")))

            for responses in [
                [None], [board(row(date=""))], [board()],
                [board(row(), last_page=2), None],
                [board(row(), last_page=2), board(row(date=""))],
                [board(row(), last_page=2), board(row(), last_page=2)],
                [board(row(title="잘린 제목…")), None],
            ]:
                output.write_bytes(baseline)
                with patch.object(crawler, "request_soup", side_effect=responses):
                    try:
                        crawler.crawl_uisp_notices()
                    except (RuntimeError, ValueError):
                        pass
                    else:
                        raise AssertionError("Incomplete UISP snapshot was accepted")
                assert output.read_bytes() == baseline
    print("Validated UISP notice parsing, pagination, stable IDs and failure preservation")


if __name__ == "__main__":
    main()
