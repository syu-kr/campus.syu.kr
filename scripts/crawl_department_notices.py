# -*- coding: utf-8 -*-
"""공식 학과 홈페이지 공지에서 공모전/대회 후보를 수집합니다."""

from __future__ import annotations

import io
import os
import re
import sys
import time
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlsplit, urlunsplit

import requests
from bs4 import BeautifulSoup
from bs4.element import Tag

from crawler_utils import (
    DEFAULT_HEADERS,
    NoticeCrawlerConfig,
    clean_notice_title,
    extract_notice_row,
    generate_stable_id,
    is_valid_notice_item,
    legacy_notice_key,
    load_json_list,
    normalize_notice_url,
    notice_key,
    request_soup,
    write_json_atomic,
)

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

DEFAULT_DEPARTMENT_DIRECTORY_URL = (
    "https://www.syu.ac.kr/about-sahmyook/college-guide/family-site/"
)
OUTPUT_PATH = "public/data/announcements-departments.json"

COMPETITION_HINT_TERMS = (
    "공모전",
    "공모 이벤트",
    "공모이벤트",
    "공모 안내",
    "공모 모집",
    "공모사업",
    "아이디어 공모",
    "콘텐츠 공모",
    "프로젝트 공모",
    "프로그램 공모",
    "후기 공모",
    "수기 공모",
    "에세이 공모",
    "리포트 공모",
    "보고서 공모",
    "독후감 공모",
    "ucc 공모",
    "영상 공모",
    "v-log 공모",
    "vlog 공모",
    "경진대회",
    "경시대회",
    "발표대회",
    "발명대회",
    "말하기대회",
    "말하기 대회",
    "토론대회",
    "토론 대회",
    "글쓰기 대회",
    "해커톤",
    "hackathon",
    "아이디어톤",
    "캡스톤디자인 경진",
    "캡스톤 디자인 경진",
    "대회",
    "선발대회",
    "코딩테스트 대회",
    "프로그래밍 경진",
)

NOTICE_TEXT_TERMS = ("공지사항", "공지", "notice")
NOTICE_PATH_HINTS = ("/community/notice", "/notice")


DepartmentSite = Dict[str, str]
NoticeItem = Dict[str, object]


def crawl_department_notices() -> None:
    directory_url = (
        os.environ.get("CRAWL_DEPARTMENT_DIRECTORY_URL")
        or DEFAULT_DEPARTMENT_DIRECTORY_URL
    )
    max_pages = read_positive_int_env("CRAWL_DEPARTMENT_NOTICE_MAX_PAGES", 3)
    max_departments = read_positive_int_env(
        "CRAWL_DEPARTMENT_NOTICE_MAX_DEPARTMENTS",
        0,
    )
    delay_seconds = read_float_env("CRAWL_DEPARTMENT_NOTICE_DELAY_SECONDS", 0.25)

    existing_items = [
        item for item in load_json_list(OUTPUT_PATH) if is_valid_notice_item(item)
    ]
    existing_id_by_key = {
        notice_key(item): str(item.get("id"))
        for item in existing_items
        if item.get("id")
    }
    for item in existing_items:
        if item.get("id"):
            existing_id_by_key.setdefault(legacy_notice_key(item), str(item.get("id")))

    session = requests.Session()
    session.headers.update(DEFAULT_HEADERS)

    departments = discover_department_sites(session, directory_url)
    if max_departments > 0:
        departments = departments[:max_departments]

    print("학과 공지 공모전/대회 후보 크롤링 시작")
    print(f"공식 학과 홈페이지: {len(departments)}개")
    print(f"기존 데이터: {len(existing_items)}개")

    if not departments:
        write_json_atomic(OUTPUT_PATH, existing_items)
        print("학과 홈페이지 목록을 찾지 못해 기존 데이터를 유지했습니다")
        return

    new_by_key: Dict[str, NoticeItem] = {}

    for index, department in enumerate(departments, start=1):
        board_base_url = discover_notice_board_url(session, department)
        if not board_base_url:
            print(f"  ⚠️ {department['name']} 공지사항 링크를 찾지 못했습니다")
            continue

        config = NoticeCrawlerConfig(
            category="campus",
            label=f"{department['name']} 학과공지",
            base_url=board_base_url,
            output_path=OUTPUT_PATH,
            default_author=department["name"],
            max_pages=max_pages,
        )
        crawled = crawl_department_board(
            session,
            config,
            department,
            existing_id_by_key,
        )
        new_by_key.update(crawled)
        print(
            f"  {index}/{len(departments)} {department['name']}: "
            f"{len(crawled)}개 후보"
        )

        if delay_seconds > 0:
            time.sleep(delay_seconds)

    merged = merge_department_notices(existing_items, new_by_key)
    write_json_atomic(OUTPUT_PATH, merged)

    new_count = sum(1 for key in new_by_key if key not in existing_id_by_key)
    print(f"학과 공지 완료: 신규 {new_count}개, 총 {len(merged)}개")


def discover_department_sites(
    session: requests.Session,
    directory_url: str,
) -> List[DepartmentSite]:
    soup = safe_request_soup(session, directory_url)
    if not soup:
        return []

    links = find_links_between_headings(soup, "학과 홈페이지", "주요 부서 홈페이지")
    departments: List[DepartmentSite] = []
    seen_urls = set()

    for link in links:
        href = link.get("href")
        if not href:
            continue

        url = normalize_site_url(urljoin(directory_url, href))
        if not is_official_syu_url(url):
            continue

        name = normalize_text(link.get_text(" ", strip=True))
        if not name:
            continue

        key = normalize_notice_url(url)
        if key in seen_urls:
            continue

        seen_urls.add(key)
        departments.append({"name": name, "url": url})

    return departments


def find_links_between_headings(
    soup: BeautifulSoup,
    start_text: str,
    end_text: str,
) -> List[Tag]:
    start_node = soup.find(
        string=lambda text: bool(text and start_text in normalize_text(text)),
    )
    if not start_node or not start_node.parent:
        return []

    links: List[Tag] = []
    for element in start_node.parent.next_elements:
        if not isinstance(element, Tag):
            continue

        text = normalize_text(element.get_text(" ", strip=True))
        if element.name in {"h2", "h3", "h4"} and end_text in text:
            break

        if element.name == "a":
            links.append(element)

    return links


def discover_notice_board_url(
    session: requests.Session,
    department: DepartmentSite,
) -> Optional[str]:
    soup = safe_request_soup(session, department["url"])
    candidates: List[tuple[int, str]] = []

    if soup:
        for anchor in soup.select("a[href]"):
            href = anchor.get("href")
            if not href:
                continue

            url = normalize_site_url(urljoin(department["url"], href))
            score = score_notice_link(anchor, url)
            if score is None or not is_official_syu_url(url):
                continue

            board_url = to_notice_board_base_url(url)
            if board_url:
                candidates.append((score, board_url))

    common_url = to_notice_board_base_url(
        urljoin(f"{department['url'].rstrip('/')}/", "community/notice/"),
    )
    if common_url:
        candidates.append((50, common_url))

    seen_urls = set()
    for _, url in sorted(candidates, key=lambda item: item[0]):
        if url in seen_urls:
            continue
        seen_urls.add(url)
        return url

    return None


def score_notice_link(anchor: Tag, url: str) -> Optional[int]:
    path = urlsplit(url).path.lower()
    text = normalize_text(anchor.get_text(" ", strip=True)).lower()

    if any(hint in path for hint in NOTICE_PATH_HINTS):
        return 0

    if text == "공지사항":
        return 5

    if any(term in text for term in NOTICE_TEXT_TERMS):
        return 10

    return None


def to_notice_board_base_url(url: str) -> Optional[str]:
    parsed = urlsplit(url)
    if not parsed.scheme or not parsed.netloc:
        return None

    path = re.sub(r"/+$", "", parsed.path)
    if not path:
        return None

    if "/page/" in path:
        path = path.split("/page/", 1)[0].rstrip("/") + "/page"
    elif not path.endswith("/page"):
        path = f"{path}/page"

    return urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))


def crawl_department_board(
    session: requests.Session,
    config: NoticeCrawlerConfig,
    department: DepartmentSite,
    existing_id_by_key: Dict[str, str],
) -> Dict[str, NoticeItem]:
    crawled: Dict[str, NoticeItem] = {}

    for page in range(1, config.max_pages + 1):
        soup = safe_request_soup(session, f"{config.base_url}/{page}/")
        if not soup:
            break

        rows = soup.select("table tbody tr")
        if not rows:
            break

        for row in rows:
            row_data = extract_notice_row(row, config)
            if not row_data:
                continue

            fix_department_notice_url(row, config.base_url, row_data)

            if not is_valid_notice_item(row_data):
                continue

            if not is_competition_notice(row_data):
                continue

            key = notice_key(row_data)
            notice_id = (
                existing_id_by_key.get(key)
                or existing_id_by_key.get(legacy_notice_key(row_data))
                or generate_stable_id(
                    "department",
                    department["url"],
                    str(row_data["title"]),
                    str(row_data["date"]),
                    str(row_data["url"]),
                )
            )

            crawled[key] = {
                "id": notice_id,
                "no": row_data["no"],
                "title": row_data["title"],
                "date": row_data["date"],
                "author": row_data["author"] or department["name"],
                "views": row_data["views"],
                "category": "campus",
                "sourceCategory": "department",
                "sourceName": department["name"],
                "sourceUrl": department["url"],
                "departmentName": department["name"],
                "departmentUrl": department["url"],
                "content": "",
                "url": row_data["url"],
                "isImportant": row_data["is_important"],
                "isPinned": row_data["is_pinned"],
            }

    return crawled


def fix_department_notice_url(
    row,
    board_base_url: str,
    row_data: NoticeItem,
) -> None:
    link = row.select_one("td a")
    href = link.get("href") if link else ""
    if href:
        row_data["url"] = normalize_site_url(urljoin(board_base_url, href))


def safe_request_soup(
    session: requests.Session,
    url: str,
) -> Optional[BeautifulSoup]:
    try:
        return request_soup(session, url)
    except requests.RequestException as error:
        print(f"  ⚠️ 요청 중 오류: {url} ({error})")
        return None


def is_competition_notice(item: NoticeItem) -> bool:
    text = normalize_text(
        " ".join(
            [
                str(item.get("title", "")),
                str(item.get("author", "")),
                str(item.get("content", "")),
            ]
        )
    ).lower()

    if is_excluded_competition_text(text):
        return False

    return any(term.lower() in text for term in COMPETITION_HINT_TERMS)


def is_excluded_competition_text(text: str) -> bool:
    if "수상안전" in text:
        return True

    if ("아산상" in text or "수상 후보" in text or "수상후보" in text) and (
        "공모전" not in text
    ):
        return True

    if "체육대회" in text and any(
        term in text for term in ("수업", "정상수업", "진행요원", "기간 중")
    ):
        return True

    if "학술대회" in text and "논문 공모" not in text:
        return True

    return False


def merge_department_notices(
    existing_items: List[NoticeItem],
    new_by_key: Dict[str, NoticeItem],
) -> List[NoticeItem]:
    merged = list(new_by_key.values())
    merged_keys = set(new_by_key.keys())

    for item in existing_items:
        key = notice_key(item)
        legacy_key = legacy_notice_key(item)
        if key in merged_keys or legacy_key in new_by_key:
            continue

        normalized_item = dict(item)
        normalized_item["title"] = clean_notice_title(
            str(normalized_item.get("title", "")),
            ("[공지]", "[중요]", "[필독]"),
        )
        merged.append(normalized_item)
        merged_keys.add(key)

    return sorted(merged, key=get_notice_sort_key, reverse=True)


def get_notice_sort_key(item: NoticeItem) -> tuple[int, int, int]:
    return (
        int(bool(item.get("isPinned"))),
        int(bool(item.get("isImportant"))),
        parse_date_key(str(item.get("date", ""))),
    )


def parse_date_key(value: str) -> int:
    digits = re.sub(r"[^0-9]", "", value)
    return int(digits) if digits else 0


def is_official_syu_url(url: str) -> bool:
    parsed = urlsplit(url)
    host = (parsed.hostname or "").lower()
    return parsed.scheme in {"http", "https"} and (
        host == "syu.ac.kr" or host.endswith(".syu.ac.kr")
    )


def normalize_site_url(url: str) -> str:
    parsed = urlsplit(url)
    path = parsed.path or "/"
    return urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def read_positive_int_env(name: str, fallback: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return fallback

    try:
        value = int(raw)
    except ValueError:
        return fallback

    return value if value >= 0 else fallback


def read_float_env(name: str, fallback: float) -> float:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return fallback

    try:
        value = float(raw)
    except ValueError:
        return fallback

    return value if value >= 0 else fallback


if __name__ == "__main__":
    crawl_department_notices()
