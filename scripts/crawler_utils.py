# -*- coding: utf-8 -*-
"""Shared helpers for SYU public-data crawlers."""

from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from dataclasses import dataclass
from datetime import datetime
from typing import Callable, Dict, List, Optional
from urllib.parse import urljoin, urlsplit, urlunsplit

import requests
from bs4 import BeautifulSoup

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name} environment variable is not configured")
    return value


@dataclass
class NoticeCrawlerConfig:
    category: str
    label: str
    base_url: str
    output_path: str
    default_author: str
    important_markers: tuple[str, ...] = ("[공지]", "[중요]", "[필독]")
    max_pages: int = 256


def generate_stable_id(prefix: str, *parts: str) -> str:
    key = "|".join(parts)
    hash_value = hashlib.md5(key.encode("utf-8")).hexdigest()[:12]
    return f"{prefix}-{hash_value}"


def legacy_notice_key(item: Dict[str, object]) -> str:
    title = re.sub(r"\s+", "", str(item.get("title", "")))
    date = str(item.get("date", "")).strip()
    author = re.sub(r"\s+", "", str(item.get("author", "")))
    return f"{title}|{date}|{author}"


def normalize_notice_url(url: str) -> str:
    split_url = urlsplit(url)
    path = re.sub(r"/+$", "", split_url.path)
    return urlunsplit((split_url.scheme, split_url.netloc, path, "", ""))


def notice_key(item: Dict[str, object]) -> str:
    url = str(item.get("url", "")).strip()
    if url:
        return normalize_notice_url(url)
    return legacy_notice_key(item)


def clean_notice_title(title: str, markers: tuple[str, ...]) -> str:
    cleaned = title
    for marker in markers:
        cleaned = cleaned.replace(marker, "")
    cleaned = re.sub(r"\bNEW\b", "", cleaned, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", cleaned).strip()


def is_valid_notice_item(item: Dict[str, object]) -> bool:
    date = str(item.get("date", ""))
    author = str(item.get("author", ""))
    title = str(item.get("title", ""))
    if not title:
        return False
    if not re.match(r"^\d{4}\.\d{2}\.\d{2}$", date):
        return False
    if re.match(r"^\d{4}\.\d{2}\.\d{2}$", author):
        return False
    if author.lower() == "file download":
        return False
    return True


def parse_int(value: str) -> int:
    digits = re.sub(r"[^0-9]", "", value or "")
    return int(digits) if digits else 0


def load_json_list(path: str) -> List[Dict[str, object]]:
    if not os.path.exists(path):
        return []

    with open(path, "r", encoding="utf-8") as file:
        data = json.load(file)

    return data if isinstance(data, list) else []


def write_json_atomic(path: str, data: object) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    directory = os.path.dirname(path) or "."

    with tempfile.NamedTemporaryFile(
        "w",
        encoding="utf-8",
        dir=directory,
        delete=False,
    ) as temp_file:
        json.dump(data, temp_file, ensure_ascii=False, indent=2)
        temp_file.write("\n")
        temp_path = temp_file.name

    os.replace(temp_path, path)


def request_soup(session: requests.Session, url: str, timeout: int = 10) -> Optional[BeautifulSoup]:
    response = session.get(url, timeout=timeout)
    response.encoding = "utf-8"
    if response.status_code != 200:
        print(f"  ⚠️ 요청 실패: {url} ({response.status_code})")
        return None
    return BeautifulSoup(response.text, "html.parser")


def extract_notice_row(row, config: NoticeCrawlerConfig) -> Optional[Dict[str, object]]:
    title_elem = row.select_one("td a")
    if not title_elem:
        return None

    cells = row.select("td")
    if not cells:
        return None

    title_cell_index = next(
        (index for index, cell in enumerate(cells) if cell.select_one("a")),
        0,
    )

    title_root = BeautifulSoup(str(title_elem), "html.parser")
    for noisy in title_root.select(".new, .new_icon, .file_icon, img, svg"):
        noisy.decompose()
    category_elem = title_root.select_one(".md_cate")
    title_text_elem = title_root.select_one(".tit")
    raw_title = " ".join(
        part
        for part in [
            category_elem.get_text(" ", strip=True) if category_elem else "",
            title_text_elem.get_text(" ", strip=True)
            if title_text_elem
            else title_root.get_text(" ", strip=True),
        ]
        if part
    )
    title = clean_notice_title(raw_title, config.important_markers)

    url = urljoin("https://www.syu.ac.kr", title_elem.get("href", ""))
    author = (
        cells[title_cell_index + 1].get_text(" ", strip=True)
        if title_cell_index + 1 < len(cells)
        else ""
    )
    date_text = (
        cells[title_cell_index + 2].get_text(" ", strip=True)
        if title_cell_index + 2 < len(cells)
        else ""
    )
    views_text = cells[-1].get_text(" ", strip=True) if cells else "0"

    step1 = row.select_one("th.step1")
    no_text = step1.get_text(" ", strip=True) if step1 else ""
    is_pinned = bool(step1 and step1.find("span", class_="notice_icon"))
    if no_text.lower() == "notice":
        is_pinned = True
        no_text = ""

    return {
        "no": no_text,
        "title": title,
        "date": date_text or datetime.now().strftime("%Y-%m-%d"),
        "author": author or config.default_author,
        "views": parse_int(views_text),
        "url": url,
        "is_important": any(marker in raw_title for marker in config.important_markers),
        "is_pinned": is_pinned,
    }


def find_last_page(
    session: requests.Session,
    base_url: str,
    max_page: int,
    page_has_rows: Callable[[BeautifulSoup], bool],
) -> int:
    left, right = 1, max_page
    last_valid = 1

    while left <= right:
        mid = (left + right) // 2
        soup = request_soup(session, f"{base_url}/{mid}/")
        if soup and page_has_rows(soup):
            last_valid = mid
            left = mid + 1
        else:
            right = mid - 1

    return last_valid


def crawl_notice_board(config: NoticeCrawlerConfig) -> None:
    existing_items = [
        item for item in load_json_list(config.output_path) if is_valid_notice_item(item)
    ]
    existing_id_by_key = {
        notice_key(item): str(item.get("id"))
        for item in existing_items
        if item.get("id")
    }
    for item in existing_items:
        if item.get("id"):
            existing_id_by_key.setdefault(legacy_notice_key(item), str(item.get("id")))

    print(f"{config.label} 크롤링 시작")
    print(f"기존 데이터: {len(existing_items)}개")

    session = requests.Session()
    session.headers.update(DEFAULT_HEADERS)

    new_by_key: Dict[str, Dict[str, object]] = {}
    pages_crawled = 0
    reached_existing_tail = False
    first_page_checked = False

    for page in range(1, config.max_pages + 1):
        soup = request_soup(session, f"{config.base_url}/{page}/")
        if not soup:
            if page == 1:
                raise RuntimeError(f"{config.label} 첫 페이지 요청 실패")
            break

        rows = soup.select("table tbody tr")
        if not rows:
            if page == 1:
                raise RuntimeError(f"{config.label} 첫 페이지에서 행을 찾을 수 없습니다")
            break

        pages_crawled += 1
        page_non_pinned = 0
        page_new_non_pinned = 0
        page_existing_non_pinned = 0

        for row in rows:
            row_data = extract_notice_row(row, config)
            if not row_data:
                continue

            key = notice_key(row_data)
            is_existing = key in existing_id_by_key
            if not row_data["is_pinned"]:
                page_non_pinned += 1
                if is_existing:
                    page_existing_non_pinned += 1
                else:
                    page_new_non_pinned += 1

            notice_id = existing_id_by_key.get(key) or generate_stable_id(
                config.category,
                str(row_data["title"]),
                str(row_data["date"]),
                str(row_data["author"]),
            )

            new_by_key[key] = {
                "id": notice_id,
                "no": row_data["no"],
                "title": row_data["title"],
                "date": row_data["date"],
                "author": row_data["author"],
                "views": row_data["views"],
                "category": config.category,
                "content": "",
                "url": row_data["url"],
                "isImportant": row_data["is_important"],
                "isPinned": row_data["is_pinned"],
            }

        if page == 1:
            first_page_checked = True
            if (
                existing_id_by_key
                and page_non_pinned > 0
                and page_new_non_pinned == 0
            ):
                reached_existing_tail = True
                break
            continue

        if (
            existing_id_by_key
            and first_page_checked
            and page_new_non_pinned == 0
            and page_existing_non_pinned > 0
        ):
            reached_existing_tail = True
            break

    if not new_by_key:
        raise RuntimeError(f"{config.label}에서 저장할 데이터를 찾지 못했습니다")

    merged = list(new_by_key.values())
    merged_keys = set(new_by_key.keys())
    for item in existing_items:
        key = notice_key(item)
        legacy_key = legacy_notice_key(item)
        if key not in merged_keys and legacy_key not in new_by_key:
            normalized_item = dict(item)
            normalized_item["title"] = clean_notice_title(
                str(normalized_item.get("title", "")),
                config.important_markers,
            )
            merged.append(normalized_item)
            merged_keys.add(key)

    write_json_atomic(config.output_path, merged)

    new_count = sum(1 for key in new_by_key if key not in existing_id_by_key)
    print(
        f"{config.label} 완료: 페이지 {pages_crawled}개, 신규 {new_count}개, "
        f"총 {len(merged)}개"
    )
    if reached_existing_tail:
        print("기존 글 구간에 도달하여 크롤링을 조기 종료했습니다")
