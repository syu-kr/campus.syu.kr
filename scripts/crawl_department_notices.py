# -*- coding: utf-8 -*-
"""공식 학과 홈페이지 공지에서 공모전/대회 후보를 수집합니다."""

from __future__ import annotations

import io
import os
import re
import sys
import time
from typing import Dict, List, Optional
from urllib.parse import parse_qs, urlencode, urljoin, urlsplit, urlunsplit

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
    require_env,
    write_json_atomic,
)

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

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

COMPETITION_SEARCH_TERMS = (
    "공모",
    "대회",
    "경진",
    "해커톤",
)

NOTICE_TEXT_TERMS = ("공지사항", "공지", "notice")
NOTICE_PATH_HINTS = ("/community/notice", "/notice")


DepartmentSite = Dict[str, str]
NoticeItem = Dict[str, object]


def crawl_department_notices() -> None:
    course_guide_url = require_env("CRAWL_DEPARTMENT_COURSE_GUIDE_URL")
    max_pages = read_positive_int_env("CRAWL_DEPARTMENT_NOTICE_MAX_PAGES", 3)
    max_departments = read_positive_int_env(
        "CRAWL_DEPARTMENT_NOTICE_MAX_DEPARTMENTS",
        0,
    )
    search_max_pages = read_positive_int_env(
        "CRAWL_DEPARTMENT_NOTICE_SEARCH_MAX_PAGES",
        2,
    )
    delay_seconds = read_float_env("CRAWL_DEPARTMENT_NOTICE_DELAY_SECONDS", 0.25)
    search_terms = read_csv_env(
        "CRAWL_DEPARTMENT_NOTICE_SEARCH_TERMS",
        COMPETITION_SEARCH_TERMS,
    )

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

    target_department_names = discover_course_guide_department_names(
        session,
        course_guide_url,
    )
    college_page_urls = discover_college_page_urls(session, course_guide_url)
    departments = discover_department_sites_from_college_pages(
        session,
        college_page_urls,
        target_department_names,
    )
    if max_departments > 0:
        departments = departments[:max_departments]

    print("학과 공지 공모전/대회 후보 크롤링 시작")
    print(f"교육과정 학과명: {len(target_department_names)}개")
    print(f"단과대학 페이지: {len(college_page_urls)}개")
    print(f"매칭된 공식 학과 홈페이지: {len(departments)}개")
    print(f"기존 데이터: {len(existing_items)}개")

    if not departments:
        write_json_atomic(OUTPUT_PATH, existing_items)
        print("학과 홈페이지 매칭 결과가 없어 기존 데이터를 유지했습니다")
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
            search_terms,
            search_max_pages,
        )
        for key, item in crawled.items():
            upsert_department_notice(new_by_key, key, item)
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


def discover_course_guide_department_names(
    session: requests.Session,
    course_guide_url: str,
) -> List[str]:
    soup = safe_request_soup(session, course_guide_url)
    if not soup:
        return []

    names: List[str] = []
    seen_names = set()

    for anchor in soup.select("a[href]"):
        href = anchor.get("href")
        if not href:
            continue

        url = urljoin(course_guide_url, href)
        parsed = urlsplit(url)
        query = parse_qs(parsed.query)
        if "c" not in query:
            continue

        name = normalize_department_display_name(anchor.get_text(" ", strip=True))
        if not name:
            continue

        key = normalize_department_name(name)
        if key in seen_names:
            continue

        seen_names.add(key)
        names.append(name)

    return names


def discover_college_page_urls(
    session: requests.Session,
    course_guide_url: str,
) -> List[str]:
    soup = safe_request_soup(session, course_guide_url)
    if not soup:
        return []

    urls: List[str] = []
    seen_urls = set()

    for anchor in soup.select("a[href]"):
        href = anchor.get("href")
        if not href:
            continue

        url = normalize_site_url(urljoin(course_guide_url, href))
        path = urlsplit(url).path
        if "/admissions-education/college/" not in path:
            continue
        if not is_official_syu_url(url):
            continue

        key = normalize_notice_url(url)
        if key in seen_urls:
            continue

        seen_urls.add(key)
        urls.append(url)

    return urls


def discover_department_sites_from_college_pages(
    session: requests.Session,
    college_page_urls: List[str],
    target_department_names: List[str],
) -> List[DepartmentSite]:
    target_name_keys = {
        normalize_department_name(name) for name in target_department_names if name
    }
    if not target_name_keys:
        return []

    departments: List[DepartmentSite] = []
    seen_urls = set()

    for college_url in college_page_urls:
        soup = safe_request_soup(session, college_url)
        if not soup:
            continue

        for department in extract_department_homepage_links(
            soup,
            college_url,
            target_name_keys,
        ):
            key = normalize_notice_url(department["url"])
            if key in seen_urls:
                continue

            seen_urls.add(key)
            departments.append(department)

    return departments


def extract_department_homepage_links(
    soup: BeautifulSoup,
    college_url: str,
    target_name_keys: set[str],
) -> List[DepartmentSite]:
    departments: List[DepartmentSite] = []

    for heading in soup.select("h3"):
        name = normalize_department_display_name(heading.get_text(" ", strip=True))
        if not is_target_department_name(name, target_name_keys):
            continue

        homepage_url = find_homepage_link_after_heading(heading, college_url)
        if not homepage_url:
            continue

        departments.append({"name": name, "url": homepage_url})

    return departments


def find_homepage_link_after_heading(
    heading: Tag,
    college_url: str,
) -> Optional[str]:
    for element in heading.next_elements:
        if not isinstance(element, Tag):
            continue

        if element is not heading and element.name in {"h2", "h3"}:
            return None

        if element.name != "a":
            continue

        text = normalize_text(element.get_text(" ", strip=True))
        if "학과홈페이지" not in text and "홈페이지 바로가기" not in text:
            continue

        href = element.get("href")
        if not href:
            continue

        url = normalize_site_url(urljoin(college_url, href))
        return url if is_official_syu_url(url) else None

    return None


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
    search_terms: List[str],
    search_max_pages: int,
) -> Dict[str, NoticeItem]:
    crawled: Dict[str, NoticeItem] = {}
    request_urls = build_notice_request_urls(
        config.base_url,
        config.max_pages,
        search_terms,
        search_max_pages,
    )

    for request_url in request_urls:
        soup = safe_request_soup(session, request_url)
        if not soup:
            continue

        rows = soup.select("table tbody tr")
        if not rows:
            continue

        for row in rows:
            row_data = extract_notice_row(row, config)
            if not row_data:
                continue

            fix_department_notice_url(row, request_url, row_data)

            if not is_valid_notice_item(row_data):
                continue

            if not is_competition_notice(row_data):
                continue

            key = department_notice_group_key(row_data)
            notice_id = (
                existing_id_by_key.get(notice_key(row_data))
                or existing_id_by_key.get(legacy_notice_key(row_data))
                or generate_stable_id(
                    "department",
                    str(row_data["title"]),
                    str(row_data["date"]),
                )
            )

            upsert_department_notice(crawled, key, {
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
                "departmentNames": [department["name"]],
                "departmentUrls": [department["url"]],
                "content": "",
                "url": row_data["url"],
                "isImportant": row_data["is_important"],
                "isPinned": row_data["is_pinned"],
            })

    return crawled


def upsert_department_notice(
    crawled: Dict[str, NoticeItem],
    key: str,
    item: NoticeItem,
) -> None:
    existing = crawled.get(key)
    if not existing:
        crawled[key] = item
        return

    department_name = str(item.get("departmentName", ""))
    department_url = str(item.get("departmentUrl", ""))
    department_names = [
        str(name)
        for name in existing.get("departmentNames", [])
        if isinstance(name, str) and name
    ]
    department_urls = [
        str(url)
        for url in existing.get("departmentUrls", [])
        if isinstance(url, str) and url
    ]

    if department_name and department_name not in department_names:
        department_names.append(department_name)
    if department_url and department_url not in department_urls:
        department_urls.append(department_url)

    existing["departmentNames"] = department_names
    existing["departmentUrls"] = department_urls
    existing["sourceName"] = format_department_source_name(department_names)
    existing["isImportant"] = bool(existing.get("isImportant")) or bool(
        item.get("isImportant")
    )
    existing["isPinned"] = bool(existing.get("isPinned")) or bool(item.get("isPinned"))


def department_notice_group_key(item: NoticeItem) -> str:
    title = re.sub(r"\s+", "", str(item.get("title", "")))
    date = str(item.get("date", "")).strip()
    return f"{title}|{date}"


def format_department_source_name(department_names: List[str]) -> str:
    if not department_names:
        return "학과공지"
    if len(department_names) == 1:
        return department_names[0]
    return f"{department_names[0]} 외 {len(department_names) - 1}개 학과"


def build_notice_request_urls(
    board_base_url: str,
    max_pages: int,
    search_terms: List[str],
    search_max_pages: int,
) -> List[str]:
    urls: List[str] = []
    seen_urls = set()

    for page in range(1, max_pages + 1):
        add_notice_request_url(urls, seen_urls, board_base_url, page)

    for term in search_terms:
        for page in range(1, search_max_pages + 1):
            add_notice_request_url(urls, seen_urls, board_base_url, page, term)

    return urls


def add_notice_request_url(
    urls: List[str],
    seen_urls: set[str],
    board_base_url: str,
    page: int,
    search_term: Optional[str] = None,
) -> None:
    url = f"{board_base_url}/{page}/"
    if search_term:
        url = f"{url}?{urlencode({'k': search_term})}"

    key = url
    if key in seen_urls:
        return

    seen_urls.add(key)
    urls.append(url)


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
        group_key = department_notice_group_key(item)
        if key in merged_keys or legacy_key in new_by_key or group_key in new_by_key:
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


def normalize_department_display_name(value: str) -> str:
    return normalize_text(re.sub(r"\bNEW\b", "", value, flags=re.IGNORECASE))


def normalize_department_name(value: str) -> str:
    normalized = normalize_department_display_name(value)
    normalized = re.sub(r"\([^)]*\)", "", normalized)
    normalized = re.sub(r"\s+", "", normalized)
    normalized = re.sub(r"[-–—].*$", "", normalized)
    normalized = re.sub(r"(Ⅰ|Ⅱ|Ⅲ|Ⅳ|I|II|III|IV)$", "", normalized)
    return normalized.lower()


def is_target_department_name(name: str, target_name_keys: set[str]) -> bool:
    key = normalize_department_name(name)
    if not key:
        return False
    if key in target_name_keys:
        return True

    return any(
        target.startswith(key) or key.startswith(target)
        for target in target_name_keys
        if len(target) >= 3 and len(key) >= 3
    )


def read_positive_int_env(name: str, fallback: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return fallback

    try:
        value = int(raw)
    except ValueError:
        return fallback

    return value if value >= 0 else fallback


def read_csv_env(name: str, fallback: tuple[str, ...]) -> List[str]:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return list(fallback)

    values: List[str] = []
    seen_values = set()
    for value in raw.split(","):
        normalized = normalize_text(value)
        key = normalized.lower()
        if not normalized or key in seen_values:
            continue

        seen_values.add(key)
        values.append(normalized)

    return values or list(fallback)


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
