# -*- coding: utf-8 -*-
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import requests
from bs4 import BeautifulSoup
import json
import re
import os
import hashlib

def generate_stable_id(title: str, start_date: str, end_date: str) -> str:
    """제목+시작날짜+종료날짜 기반 안정적 ID 생성"""
    key = f"{title}|{start_date}|{end_date}"
    hash_value = hashlib.md5(key.encode()).hexdigest()[:12]
    return f"schedule-{hash_value}"

def crawl_schedule():
    """학사일정 크롤링 (증분 업데이트 - 개선)"""
    
    url = "https://www.syu.ac.kr/academic/major-schedule/"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    print("📅 학사일정 크롤링 시작...")
    
    # 기존 데이터 로드
    output_path = "public/data/schedules-major.json"
    existing_schedules = {}
    existing_map = {}  # 안정적 ID 추적용
    
    if os.path.exists(output_path):
        try:
            with open(output_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
                for schedule in existing_data:
                    key = f"{schedule['title']}|{schedule['startDate']}|{schedule['endDate']}"
                    existing_schedules[key] = schedule
                    existing_map[key] = schedule['id']
                print(f"📌 기존 일정 {len(existing_schedules)}개 로드됨")
        except Exception as e:
            print(f"⚠️  기존 데이터 로드 실패: {e}")
    
    try:
        # POST request
        response = requests.post(url, headers=headers, timeout=15)
        response.encoding = 'utf-8'
        
        if response.status_code != 200:
            print(f"Request failed: {response.status_code}")
            return
        
        print(f"✓ Request successful (status: {response.status_code})")
        
        # Parse HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find all calendar boxes
        calendars = soup.find_all("div", {"class": "md_textcalendar"})
        print(f"📍 Calendar boxes found: {len(calendars)}")
        
        new_schedules_by_key = {}
        processed_keys = set()
        new_count = 0
        
        for calendar_idx, calendar in enumerate(calendars):
            # Find DL element
            dl = calendar.find("dl")
            if not dl:
                continue
            
            # Extract year and month
            year_elem = dl.find("div", {"class": "year"})
            month_elem = dl.find("div", {"class": "month"})
            
            if not year_elem or not month_elem:
                continue
            
            year = year_elem.text.strip()
            month = month_elem.text.strip()
            
            print(f"\n  📍 {year}-{month}:")
            
            # Find schedule items
            li_items = dl.find_all("li")
            print(f"    Items: {len(li_items)}")
            
            for li_idx, li in enumerate(li_items):
                inner_dl = li.find("dl")
                if not inner_dl:
                    continue
                
                dt_elem = inner_dl.find("dt")
                dd_elem = inner_dl.find("dd")
                
                if not dt_elem or not dd_elem:
                    continue
                
                date_text = dt_elem.text.strip()
                event_text = dd_elem.text.strip()
                
                if not date_text or not event_text:
                    continue
                
                # Parse dates
                start_date = ""
                end_date = ""
                
                if "~" in date_text:
                    parts = [p.strip() for p in date_text.split("~")]
                    if len(parts) == 2:
                        start_part = parts[0]
                        end_part = parts[1]
                        
                        if "." in start_part:
                            start_date = f"{year}.{start_part}"
                        else:
                            start_date = f"{year}.{month}.{start_part}"
                        
                        if "." in end_part:
                            end_date = f"{year}.{end_part}"
                        else:
                            end_date = f"{year}.{month}.{end_part}"
                else:
                    start_date = f"{year}.{date_text}"
                    end_date = start_date
                
                # Check for duplicates within current session
                unique_key = f"{event_text}|{start_date}|{end_date}"
                if unique_key in processed_keys:
                    continue
                
                processed_keys.add(unique_key)
                
                # Determine category
                category = "event"
                if "중간고사" in event_text or "기말고사" in event_text:
                    category = "exam"
                
                # Check if this schedule is new
                is_new = unique_key not in existing_map
                
                # 기존 ID 있으면 사용, 없으면 새로 생성
                if unique_key in existing_map:
                    schedule_id = existing_map[unique_key]
                else:
                    schedule_id = generate_stable_id(event_text, start_date, end_date)
                    print(f"    ✨ NEW: {event_text} ({start_date} ~ {end_date})")
                    new_count += 1
                
                schedule = {
                    "id": schedule_id,
                    "title": event_text,
                    "startDate": start_date,
                    "endDate": end_date,
                    "category": category,
                    "description": event_text
                }
                
                new_schedules_by_key[unique_key] = schedule
        
        # 새 데이터와 기존 데이터 합치기
        all_schedules = list(new_schedules_by_key.values())
        
        # 기존 데이터 중 새 데이터에 없는 항목 추가
        for key, schedule in existing_schedules.items():
            if key not in new_schedules_by_key:
                all_schedules.append(schedule)
        
        # Save JSON
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(all_schedules, f, ensure_ascii=False, indent=2)
        
        print(f"\n✅ 학사일정 저장 완료")
        print(f"   기존: {len(existing_schedules)}개, 신규: {new_count}개, 총: {len(all_schedules)}개")
        
        # Statistics
        categories = {}
        for s in all_schedules:
            cat = s["category"]
            categories[cat] = categories.get(cat, 0) + 1
        
        print("\nCategory statistics:")
        for cat, count in sorted(categories.items()):
            print(f"  - {cat}: {count}")
        
    except Exception as e:
        print(f"Crawling error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    crawl_schedule()
