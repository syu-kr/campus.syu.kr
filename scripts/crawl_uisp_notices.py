"""Collect the university innovation support office's public GnuBoard notices."""

from __future__ import annotations

import re
import sys
import time
from datetime import datetime
from urllib.parse import parse_qs, urljoin, urlsplit

import requests

from crawler_utils import DEFAULT_HEADERS, load_json_list, request_soup, write_json_atomic

sys.stdout.reconfigure(encoding="utf-8", line_buffering=True, write_through=True)

# The official board currently serves HTTP only.
BASE_URL = "http://uisp-origin.example.invalid/bbs/board.php?bo_table=notice"
OUTPUT_PATH = "public/data/announcements-uisp.json"


def parse_notice_row(row) -> dict:
    cells = row.select("td")
    anchor = row.select_one(".bo_tit a[href]")
    if len(cells) != 4 or anchor is None:
        raise ValueError("대학혁신지원사업단 공지 행이 불완전합니다")
    url = urlsplit(urljoin(BASE_URL, anchor["href"]))
    query = parse_qs(url.query)
    post_id = query.get("wr_id", [""])[0]
    if (
        url.scheme not in {"http", "https"}
        or url.netloc != "uisp-origin.example.invalid"
        or url.path != "/bbs/board.php"
        or query.get("bo_table") != ["notice"]
        or not re.fullmatch(r"[1-9][0-9]*", post_id)
    ):
        raise ValueError("대학혁신지원사업단 공지 주소가 올바르지 않습니다")
    title = anchor.get_text(" ", strip=True)
    date = cells[3].get_text(strip=True)
    if not title or not re.fullmatch(r"\d{2}\.\d{2}\.\d{2}", date):
        raise ValueError("대학혁신지원사업단 공지 제목 또는 날짜가 없습니다")
    date = datetime.strptime("20" + date, "%Y.%m.%d").strftime("%Y.%m.%d")
    return {
        "id": f"uisp-{post_id}",
        "title": title,
        "date": date,
        "author": "대학혁신지원사업단",
        "category": "uisp",
        "content": "",
        "url": f"{BASE_URL}&wr_id={post_id}",
        "isImportant": any(marker in title for marker in ("[중요]", "[필독]")),
        "isPinned": "bo_notice" in row.get("class", []),
    }


def crawl_uisp_notices() -> None:
    existing = {item["id"]: item for item in load_json_list(OUTPUT_PATH)}
    collected: dict[str, dict] = {}
    pinned: set[str] = set()
    with requests.Session() as session:
        session.headers.update(DEFAULT_HEADERS)
        for page in range(1, 129):
            soup = request_soup(session, f"{BASE_URL}&page={page}")
            if soup is None:
                raise RuntimeError(f"대학혁신지원사업단 {page}페이지 요청 실패")
            rows = soup.select("#bo_list tbody tr")
            if not rows:
                raise RuntimeError("대학혁신지원사업단 공지 목록을 찾지 못했습니다")
            items = [parse_notice_row(row) for row in rows]
            regular = [item for item in items if not item["isPinned"]]
            if regular and all(item["id"] in collected for item in regular):
                raise RuntimeError("대학혁신지원사업단 페이지가 반복되었습니다")
            for item in items:
                if page == 1 and item["isPinned"]:
                    pinned.add(item["id"])
                if item["title"].endswith(("…", "...")):
                    detail = request_soup(session, item["url"])
                    title = detail.select_one("#bo_v_title .bo_v_tit") if detail else None
                    if title is None or not title.get_text(strip=True):
                        raise RuntimeError("대학혁신지원사업단 원문 제목을 찾지 못했습니다")
                    item["title"] = title.get_text(" ", strip=True)
                collected[item["id"]] = item
            print(f"대학혁신지원사업단 {page}페이지: {len(items)}개")
            pages = [page]
            for link in soup.select(".pg_wrap a[href]"):
                number = parse_qs(urlsplit(link["href"]).query).get("page", [""])[0]
                if number.isdigit():
                    pages.append(int(number))
            if max(pages) == page or (regular and all(item["id"] in existing for item in regular)):
                break
            time.sleep(0.25)
        else:
            raise RuntimeError("대학혁신지원사업단 최대 수집 페이지를 초과했습니다")

    merged = {**existing, **collected}
    for item in merged.values():
        item["isPinned"] = item["id"] in pinned
    write_json_atomic(OUTPUT_PATH, list(merged.values()))
    print(f"대학혁신지원사업단 완료: 총 {len(merged)}개")


if __name__ == "__main__":
    crawl_uisp_notices()
