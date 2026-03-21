# -*- coding: utf-8 -*-
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
"""
학식 메뉴 크롤링 스크립트 (날짜별 업데이트)
매일 실행됨 - 같은 날짜 메뉴는 덮어쓰고, 새로운 날짜는 추가
https://www.syu.ac.kr/school-life/facility-information/cafeteria/
"""

import requests
from bs4 import BeautifulSoup
import json
import re
import os

def parse_korean_date(date_str):
    """'3월 16일 (월)' 형식의 날짜 파싱"""
    match = re.search(r'(\d{1,2})월\s*(\d{1,2})일\s*\((.)\)', date_str)
    if match:
        month, day, day_of_week = match.groups()
        from datetime import datetime
        today = datetime.now()
        year = today.year
        date_formatted = f"{year}-{int(month):02d}-{int(day):02d}"
        return date_formatted, day_of_week
    return None, None

def parse_menu_items(html_text):
    """메뉴 항목 파싱"""
    items = []
    # <br> 태그로 구분된 항목들 분리
    for item in re.split(r'<br\s*/?>', html_text):
        # HTML 태그 제거
        cleaned = re.sub(r'<[^>]*>', '', item)
        # HTML 엔티티 처리
        cleaned = cleaned.replace('&nbsp;', '').replace('&amp;', '&')
        cleaned = cleaned.replace('&lt;', '<').replace('&gt;', '>')
        cleaned = cleaned.strip()
        if cleaned:
            items.append(cleaned)
    return items

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
    
    url = "https://www.syu.ac.kr/school-life/facility-information/cafeteria/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    print("🍜 학식 메뉴 크롤링 시작...")
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
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
                "breakfast": [],
                "lunch": {
                    "a_corner": [],
                    "b_corner": []
                },
                "dinner": []
            }
            
            # 조식
            cells = breakfast_row.select("td")
            if date_idx < len(cells):
                breakfast_html = cells[date_idx].decode_contents() if hasattr(cells[date_idx], 'decode_contents') else str(cells[date_idx].contents)
                meals["breakfast"] = parse_menu_items(breakfast_html)
            
            # A코너 (첫 셀은 라벨, 1~5번 셀이 월~금)
            cells = a_corner_row.select("td")
            if date_idx + 1 < len(cells):
                a_html = cells[date_idx + 1].decode_contents() if hasattr(cells[date_idx + 1], 'decode_contents') else str(cells[date_idx + 1].contents)
                meals["lunch"]["a_corner"] = parse_menu_items(a_html)
            
            # B코너
            cells = b_corner_row.select("td")
            if date_idx + 1 < len(cells):
                b_html = cells[date_idx + 1].decode_contents() if hasattr(cells[date_idx + 1], 'decode_contents') else str(cells[date_idx + 1].contents)
                meals["lunch"]["b_corner"] = parse_menu_items(b_html)
            
            # 석식
            cells = dinner_row.select("td")
            if date_idx < len(cells):
                dinner_html = cells[date_idx].decode_contents() if hasattr(cells[date_idx], 'decode_contents') else str(cells[date_idx].contents)
                meals["dinner"] = parse_menu_items(dinner_html)
            
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
        
        # JSON 구조 생성
        result = {
            "id": "cafeteria-sulounge",
            "name": "SU-Lounge",
            "weekStart": dates[0][0] if dates else "",
            "menus": menus,
            "lastUpdated": str(__import__('datetime').datetime.now().isoformat())
        }
        
        # 디렉토리 생성 및 JSON 파일로 저장
        os.makedirs(os.path.dirname(data_path), exist_ok=True)
        with open(data_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 학식 메뉴 저장 완료 (신규: {new_count}개, 업데이트: {updated_count}개)")
    
    except Exception as e:
        print(f"❌ 학식 메뉴 크롤링 실패: {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    crawl_cafeteria_menu()
