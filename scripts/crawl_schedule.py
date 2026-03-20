# -*- coding: utf-8 -*-
import requests
from bs4 import BeautifulSoup
import json
import re

def crawl_schedule():
    """POST 요청으로 학사일정 크롤링"""
    
    url = "https://www.syu.ac.kr/academic/major-schedule/"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    print("Calendar schedule crawling started...")
    print(f"URL: {url}")
    
    try:
        # POST request
        response = requests.post(url, headers=headers, timeout=15)
        response.encoding = 'utf-8'
        
        if response.status_code != 200:
            print(f"Request failed: {response.status_code}")
            return
        
        print(f"Request successful (status: {response.status_code})")
        
        # Parse HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find all calendar boxes
        calendars = soup.find_all("div", {"class": "md_textcalendar"})
        print(f"Calendar boxes found: {len(calendars)}")
        
        schedules = []
        processed_keys = set()
        
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
            
            print(f"\n  Processing {year}-{month}:")
            
            # Find schedule items
            li_items = dl.find_all("li")
            print(f"  Items: {len(li_items)}")
            
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
                
                # Check for duplicates
                unique_key = f"{event_text}|{start_date}|{end_date}"
                if unique_key in processed_keys:
                    continue
                
                processed_keys.add(unique_key)
                
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
                
                schedules.append(schedule)
                print(f"    {event_text} ({start_date} ~ {end_date})")
        
        print(f"\nTotal schedules collected: {len(schedules)}")
        
        # Save JSON
        output_path = "public/data/schedules-major.json"
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(schedules, f, ensure_ascii=False, indent=2)
        
        print(f"Saved: {output_path}")
        
        # Statistics
        categories = {}
        for s in schedules:
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
