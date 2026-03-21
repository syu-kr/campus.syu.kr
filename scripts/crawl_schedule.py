# -*- coding: utf-8 -*-
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import requests
from bs4 import BeautifulSoup
import json
import re
import os

def crawl_schedule():
    """학사일정 크롤링 (증분 업데이트)"""
    
    url = "https://www.syu.ac.kr/academic/major-schedule/"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    print("📅 학사일정 크롤링 시작...")
    
    # 기존 데이터 로드
    output_path = "public/data/schedules-major.json"
    existing_schedules = {}
    existing_keys = set()
    
    if os.path.exists(output_path):
        try:
            with open(output_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
                for schedule in existing_data:
                    key = f"{schedule['title']}|{schedule['startDate']}|{schedule['endDate']}"
                    existing_schedules[key] = schedule
                    existing_keys.add(key)
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
        
        new_schedules = []
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
                
                # Check if this schedule is new
                if unique_key not in existing_keys:
                    print(f"    ✨ NEW: {event_text} ({start_date} ~ {end_date})")
                    new_count += 1
                
                # Determine category
                category = "event"
                if "중간고사" in event_text or "기말고사" in event_text:
                    category = "exam"
                
                schedule = {
                    "id": f"schedule-{year}-{date_text.replace('~', '').replace(' ', '-')}-{li_idx}",
                    "title": event_text,
                    "startDate": start_date,
                    "endDate": end_date,
                    "category": category,
                    "description": event_text
                }
                
                new_schedules.append(schedule)
        
        # 기존 일정 + 새 일정 합치기
        all_schedules = list(existing_schedules.values()) + [s for s in new_schedules if f"{s['title']}|{s['startDate']}|{s['endDate']}" not in existing_keys]
        
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
