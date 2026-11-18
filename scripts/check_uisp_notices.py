"""Exercise the UISP board's actual row shape without network or shared output."""

import contextlib
import io
import json
import os
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch

import requests
from bs4 import BeautifulSoup

import crawl_uisp_notices as crawler

BOARD_HOST = "private-board.example.invalid"
BOARD_URL = f"http://{BOARD_HOST}/bbs/board.php?bo_table=notice"


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
    parsed = crawler.parse_notice_row(board(row()).select_one("tr"), BOARD_URL)
    assert parsed["id"] == "uisp-744" and parsed["date"] == "2026.11.06"
    assert "url" not in parsed
    assert parsed["category"] == "uisp" and parsed["author"] == "대학혁신지원사업단"
    assert "views" not in parsed
    assert crawler.parse_notice_row(board(row("743")).select_one("tr"), BOARD_URL)["id"] != parsed["id"]
    assert crawler.parse_notice_row(board(row(date="24.02.29")).select_one("tr"), BOARD_URL)["date"] == "2024.02.29"
    for malformed in [
        row(date=""), row(date="26.02.30"), row(title=""), row(href=""),
        row(href="https://evil.invalid/bbs/board.php?bo_table=notice&wr_id=1"),
        row(href=f"http://{BOARD_HOST}:8080/bbs/board.php?bo_table=notice&wr_id=1"),
        row(href=f"http://{BOARD_HOST}/bbs/board.php?bo_table=other&wr_id=1"),
        row(post_id="abc"), '<tr><td colspan="4">내용 없음</td></tr>',
    ]:
        try:
            crawler.parse_notice_row(board(malformed).select_one("tr"), BOARD_URL)
        except ValueError:
            pass
        else:
            raise AssertionError("Invalid UISP row was accepted")

    for invalid_url in [
        "", f"{BOARD_URL}&wr_id=1", f"{BOARD_URL}#", BOARD_URL.replace("://", "://user@"),
        BOARD_URL.replace(BOARD_HOST, f"{BOARD_HOST}:80"), BOARD_URL.replace(BOARD_HOST, "127.0.0.1"),
    ]:
        with patch.dict(os.environ, {crawler.BOARD_URL_ENV: invalid_url}):
            try:
                crawler.get_board_url()
            except (RuntimeError, ValueError) as error:
                assert BOARD_HOST not in str(error)
            else:
                raise AssertionError("Invalid UISP board address was accepted")

    redirect_session = Mock()
    redirect_session.request.return_value.status_code = 302
    failed_session = Mock()
    failed_session.request.side_effect = requests.ConnectTimeout(f"Fixture failure at {BOARD_URL}")
    private_log = io.StringIO()
    with patch.object(crawler.time, "sleep"), contextlib.redirect_stdout(private_log):
        for session in [redirect_session, failed_session]:
            assert crawler.request_soup(session, BOARD_URL, private_source=True) is None
            assert session.request.call_args.kwargs["allow_redirects"] is False
    assert BOARD_HOST not in private_log.getvalue() and "[warn]" in private_log.getvalue()

    with tempfile.TemporaryDirectory(prefix="syu-uisp-") as directory, patch.dict(os.environ, {crawler.BOARD_URL_ENV: BOARD_URL}):
        output = Path(directory) / "notices.json"
        old = {**parsed, "id": "uisp-1", "url": BOARD_URL + "&wr_id=1", "content": BOARD_URL, "isPinned": True}
        baseline = (json.dumps([old]) + "\r\n").encode()
        with patch.object(crawler, "OUTPUT_PATH", str(output)), patch.object(crawler.time, "sleep"), contextlib.redirect_stdout(io.StringIO()):
            output.write_bytes(baseline)
            first = board(row(pinned=True), row("743", title="전체 제목…"), last_page=2)
            detail = BeautifulSoup('<h2 id="bo_v_title"><span class="bo_v_tit">전체 제목 복원</span></h2>', "html.parser")
            second = board(row("744"), row("742", title=f"참고 {BOARD_URL.replace('.', '%252E')}"), last_page=2)
            with patch.object(crawler, "request_soup", side_effect=[first, detail, second]) as request:
                crawler.crawl_uisp_notices()
            published = output.read_text(encoding="utf-8")
            items = {item["id"]: item for item in json.loads(published)}
            assert len(items) == 4
            assert items["uisp-744"]["isPinned"] and not items["uisp-1"]["isPinned"]
            assert items["uisp-743"]["title"] == "전체 제목 복원"
            assert items["uisp-742"]["title"] == "[원본 주소]"
            assert BOARD_HOST not in published and all("url" not in item for item in items.values())
            assert request.call_args_list[1].args[1].endswith("&wr_id=743")
            assert all(call.kwargs["private_source"] is True for call in request.call_args_list)
            assert request.call_args_list[-1].args[1].endswith("&page=2")
            with patch.object(crawler, "request_soup", return_value=board(row("743"), last_page=48)) as request:
                crawler.crawl_uisp_notices()
            assert request.call_count == 1
            assert len(json.loads(output.read_text(encoding="utf-8"))) == 4
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
    print("Validated UISP notice parsing, stable IDs, private origin and failure preservation")


if __name__ == "__main__":
    main()
