# -*- coding: utf-8 -*-
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
"""
학식 메뉴 크롤링 스크립트 (날짜별 업데이트)
매일 실행됨 - 같은 날짜 메뉴는 덮어쓰고, 새로운 날짜는 추가
대상 URL은 CRAWL_CAFETERIA_URL 환경변수로 주입
"""

import requests
from bs4 import BeautifulSoup
import json
import re
import os
import html
from datetime import datetime

from crawler_utils import DEFAULT_HEADERS, require_env, write_json_atomic

CLOSED_LABEL = "운영 없음"
CLOSED_TEXTS = {"운영없음", "운영 없음", "휴무", "없음", "-", "미운영"}

def parse_korean_date(date_str):
    """'3월 16일 (월)' 형식의 날짜 파싱"""
    match = re.search(r'(\d{1,2})월\s*(\d{1,2})일\s*\((.)\)', date_str)
    if match:
        month, day, day_of_week = match.groups()
        today = datetime.now()
        year = today.year
        month_int = int(month)
        if today.month == 12 and month_int == 1:
            year += 1
        elif today.month == 1 and month_int == 12:
            year -= 1
        date_formatted = f"{year}-{int(month):02d}-{int(day):02d}"
        return date_formatted, day_of_week
    return None, None

def parse_menu_items(html_text):
    """메뉴 항목 파싱"""
    items = []
    for item in re.split(r'<br\s*/?>', html_text):
        cleaned = re.sub(r'<[^>]*>', '', item)
        cleaned = html.unescape(cleaned)
        cleaned = cleaned.replace('\xa0', ' ')
        cleaned = re.sub(r'\s+', ' ', cleaned)
        cleaned = cleaned.strip()
        if cleaned:
            items.append(cleaned)
    return items


def is_closed_text(value):
    normalized = re.sub(r"\s+", "", value or "")
    return normalized in {re.sub(r"\s+", "", text) for text in CLOSED_TEXTS}


def normalize_menu_items(items):
    if not items:
        return [CLOSED_LABEL]
    if all(is_closed_text(item) for item in items):
        return [CLOSED_LABEL]
    return [item for item in items if not is_closed_text(item)]


def has_food_items(items):
    return any(not is_closed_text(item) for item in items)


def cell_menu_items(row, cell_index):
    cells = row.select("td")
    if cell_index >= len(cells):
        return []
    return parse_menu_items(cells[cell_index].decode_contents())


def is_closed_day(meals):
    sections = [
        meals["breakfast"],
        meals["lunch"]["a_corner"],
        meals["lunch"]["b_corner"],
        meals["dinner"],
    ]
    return not any(has_food_items(section) for section in sections)


def closed_meals():
    return {
        "breakfast": [CLOSED_LABEL],
        "lunch": {
            "a_corner": [CLOSED_LABEL],
            "b_corner": [CLOSED_LABEL],
        },
        "dinner": [CLOSED_LABEL],
    }


def crawl_cafeteria_menu():
    """학식 메뉴 크롤링"""
    data_path = "public/data/cafeteria-menu.json"
    
    # 기존 데이터 로드
    existing_menus = {}
    if os.path.exists(data_path):
        try:
            with open(data_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # menus 배열에서 date별로 인덱싱
                if isinstance(data, dict) and 'menus' in data:
                    for menu in data['menus']:
                        existing_menus[menu['date']] = menu
                print(f"📌 기존 메뉴 {len(existing_menus)}개 로드됨")
        except Exception as e:
            print(f"⚠️  기존 데이터 로드 실패: {e}")
    
    url = require_env("CRAWL_CAFETERIA_URL")
    print("🍜 학식 메뉴 크롤링 시작...")
    
    try:
        response = requests.get(url, headers=DEFAULT_HEADERS, timeout=10)
        response.encoding = 'utf-8'
        
        if response.status_code != 200:
            print(f"❌ 요청 실패: {response.status_code}")
            return
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 주간 메뉴 테이블 찾기
        table = soup.select_one(".weekly-menu-table")
        if not table:
            print("⚠️  weekly-menu-table을 찾을 수 없습니다.")
            return
        
        # 헤더에서 날짜 추출
        header_cells = table.select("thead th")
        dates = []
        
        for i in range(1, len(header_cells)):
            date_str = header_cells[i].get_text(strip=True)
            if date_str:
                date_formatted, day_name = parse_korean_date(date_str)
                if date_formatted:
                    dates.append((date_formatted, day_name))
        
        print(f"📊 발견된 날짜: {len(dates)}개")
        if not dates:
            raise RuntimeError("학식 날짜 헤더를 찾지 못했습니다.")
        for date, day in dates:
            print(f"   - {date} ({day})")
        
        # 테이블 바디 행 처리
        body_rows = table.select("tbody tr")
        print(f"📋 Body 행: {len(body_rows)}개")
        
        if len(body_rows) < 4:
            print("⚠️  예상되는 4개 행이 없습니다.")
            return
        
        # 각 날짜별로 메뉴 구성
        menus = []
        new_count = 0
        updated_count = 0
        
        for date_idx, (date, day) in enumerate(dates):
            breakfast_row = body_rows[0]
            a_corner_row = body_rows[1]
            b_corner_row = body_rows[2]
            dinner_row = body_rows[3]
            
            meals = {
                "breakfast": [CLOSED_LABEL],
                "lunch": {
                    "a_corner": [CLOSED_LABEL],
                    "b_corner": [CLOSED_LABEL]
                },
                "dinner": [CLOSED_LABEL]
            }
            
            # 조식
            meals["breakfast"] = normalize_menu_items(
                cell_menu_items(breakfast_row, date_idx)
            )
            
            # A코너 (첫 셀은 라벨, 1~5번 셀이 월~금)
            meals["lunch"]["a_corner"] = normalize_menu_items(
                cell_menu_items(a_corner_row, date_idx + 1)
            )
            
            # B코너
            meals["lunch"]["b_corner"] = normalize_menu_items(
                cell_menu_items(b_corner_row, date_idx + 1)
            )
            
            # 석식
            meals["dinner"] = normalize_menu_items(
                cell_menu_items(dinner_row, date_idx)
            )

            if is_closed_day(meals):
                meals = closed_meals()
            
            menu_data = {
                "date": date,
                "day": day,
                "meals": meals
            }
            
            # 기존 데이터와 비교
            if date in existing_menus:
                print(f"  🔄 업데이트: {date}")
                updated_count += 1
            else:
                print(f"  ✨ 신규: {date}")
                new_count += 1
            
            menus.append(menu_data)
        
        if len(menus) < len(dates):
            raise RuntimeError("학식 날짜 수와 메뉴 수가 일치하지 않습니다.")
        
        # JSON 구조 생성
        result = {
            "id": "cafeteria-sulounge",
            "name": "SU-Lounge",
            "weekStart": dates[0][0] if dates else "",
            "menus": menus,
            "lastUpdated": datetime.now().isoformat()
        }
        
        write_json_atomic(data_path, result)
        
        print(f"✅ 학식 메뉴 저장 완료 (신규: {new_count}개, 업데이트: {updated_count}개)")
    
    except Exception as e:
        print(f"❌ 학식 메뉴 크롤링 실패: {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    crawl_cafeteria_menu()
