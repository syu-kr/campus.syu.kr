# -*- coding: utf-8 -*-
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
"""
행사공지 크롤링 스크립트 (증분 크롤링 - 개선)
매일 실행됨 - 기존 데이터는 유지하고 새로운 글만 추가
https://www.syu.ac.kr/university-square/notice/event/page/1
"""

import requests
from bs4 import BeautifulSoup
import json
import os
from datetime import datetime
import hashlib

def generate_stable_id(category: str, title: str, date: str, author: str) -> str:
    """제목+날짜+작성자 기반 안정적 ID 생성"""
    key = f"{title}|{date}|{author}"
    hash_value = hashlib.md5(key.encode()).hexdigest()[:12]
    return f"{category}-{hash_value}"

def extract_event_row(row):
    """행사공지 행에서 정보 추출"""
    try:
        # 다양한 선택자 시도
        title_elem = row.select_one("td:nth-of-type(2) a")
        if not title_elem:
            title_elem = row.select_one("td:nth-of-type(1) a")
        if not title_elem:
            title_elem = row.select_one("td a")
        if not title_elem:
            return None
        
        title = title_elem.get_text(strip=True)
        url = title_elem.get('href', '')
        
        if url and not url.startswith('http'):
            url = "https://www.syu.ac.kr" + url
        
        # 열 정보 동적 감지 (날짜와 작성자 순서 교정)
        tds = row.select("td")
        no_text = ""
        author = ""
        date_text = ""
        
        if len(tds) >= 5:
            # No 추출
            no_raw = tds[0].get_text(strip=True) if tds[0] else ""
            no_text = ''.join(c for c in no_raw if c.isdigit())
            
            author = tds[2].get_text(strip=True) if tds[2] else ""
            date_text = tds[3].get_text(strip=True) if tds[3] else ""
            views_text = tds[4].get_text(strip=True) if tds[4] else "0"
        else:
            no_text = ""
            author = tds[1].get_text(strip=True) if len(tds) > 1 else ""
            date_text = tds[2].get_text(strip=True) if len(tds) > 2 else ""
            views_text = tds[3].get_text(strip=True) if len(tds) > 3 else "0"
        
        try:
            views = int(views_text)
        except:
            views = 0
        
        # Pin 여부 확인 (step1 th의 notice_icon span 확인)
        step1_th = row.select_one("th.step1")
        is_pinned = False
        
        if step1_th:
            notice_icon_span = step1_th.find("span", class_="notice_icon")
            if notice_icon_span:
                is_pinned = True
            else:
                # notice_icon이 없으면 번호 추출
                no_text = step1_th.get_text(strip=True)
        
        is_important = "[중요]" in title or "[공지]" in title
        clean_title = title.replace("[중요]", "").replace("[공지]", "").strip()
        
        return {
            "no": no_text,
            "title": clean_title,
            "date": date_text or datetime.now().strftime("%Y-%m-%d"),
            "author": author or "행사팀",
            "views": views,
            "url": url,
            "is_important": is_important,
            "is_pinned": is_pinned
        }
    except Exception as e:
        print(f"  ⚠️  행 파싱 오류: {e}")
        return None

def find_last_page(base_url: str, headers: dict, max_page: int = 128) -> int:
    """마지막 페이지 찾기 (이진 탐색)"""
    print("🔍 마지막 페이지 찾는 중...")
    
    left, right = 1, max_page
    last_valid = 1
    
    while left <= right:
        mid = (left + right) // 2
        try:
            response = requests.get(f"{base_url}/{mid}/", headers=headers, timeout=10)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                if soup.select("table tbody tr"):
                    last_valid = mid
                    left = mid + 1
                else:
                    right = mid - 1
            else:
                right = mid - 1
        except:
            right = mid - 1
    
    print(f"  ✓ 마지막 페이지: {last_valid}")
    return last_valid

def crawl_event_notices():
    """행사공지 증분 크롤링 (개선)"""
    data_path = "public/data/announcements-events.json"
    
    existing_events = []
    existing_map = {}
    latest_item = None
    
    if os.path.exists(data_path):
        try:
            with open(data_path, 'r', encoding='utf-8') as f:
                existing_events = json.load(f)
                if existing_events:
                    latest_item = existing_events[0]
                    print(f"📌 저장된 최신글: \"{latest_item['title']}\" ({latest_item['date']}, {latest_item['author']})")
                    
                    for event in existing_events:
                        key = f"{event['title']}|{event['date']}|{event['author']}"
                        existing_map[key] = event['id']
        except Exception as e:
            print(f"⚠️  기존 데이터 로드 실패: {e}")
    
    base_url = "https://www.syu.ac.kr/university-square/notice/event/page"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    print("🎉 행사공지 크롤링 시작...")
    
    try:
        # Step 1: 페이지 1의 첫 글 확인
        print("\n[Step 1] 페이지 1의 첫 글 확인...")
        response = requests.get(f"{base_url}/1/", headers=headers, timeout=10)
        response.encoding = 'utf-8'
        
        if response.status_code != 200:
            print(f"❌ 페이지 1 요청 실패: {response.status_code}")
            return
        
        soup = BeautifulSoup(response.text, 'html.parser')
        table_rows = soup.select("table tbody tr")
        
        if not table_rows:
            print("❌ 페이지 1에서 데이터를 찾을 수 없음")
            return
        
        print(f"  ✓ 페이지1 검증: {len(table_rows)}개의 글")
        
        # Step 2: 페이지 1 전체를 검증하여 새로운 글이 있는지 확인
        print("\n[Step 2] 페이지 1의 모든 글을 검증 중...")
        need_crawl_all = False
        
        for idx, row in enumerate(table_rows[:20]):  # 첫 20개만 검증
            row_data = extract_event_row(row)
            if not row_data:
                continue
            
            key = f"{row_data['title']}|{row_data['date']}|{row_data['author']}"
            if key not in existing_map:
                print(f"  ✨ 새로운 글 발견 (행 {idx+1}): \"{row_data['title']}\"")
                need_crawl_all = True
                break
        
        if not need_crawl_all:
            print("  ✓ 페이지 1의 모든 글이 기존 데이터와 일치 → 새 글 없음")
            print("\n✅ 크롤링 완료!")
            return
        
        # Step 3: 마지막 페이지 찾기
        print("\n[Step 3] 마지막 페이지 찾는 중...")
        last_page = find_last_page(base_url, headers)
        
        # Step 4: 전체 크롤링
        print(f"\n[Step 4] 페이지 1~{last_page} 전체 크롤링 시작...")
        new_data_by_key = {}
        
        for page in range(1, last_page + 1):
            print(f"  페이지 {page}/{last_page} 크롤링 중...")
            
            try:
                response = requests.get(f"{base_url}/{page}/", headers=headers, timeout=10)
                response.encoding = 'utf-8'
                
                if response.status_code != 200:
                    print(f"  ⚠️  페이지 {page} 요청 실패: {response.status_code}")
                    continue
                
                soup = BeautifulSoup(response.text, 'html.parser')
                table_rows = soup.select("table tbody tr")
                
                if not table_rows:
                    print(f"  페이지 {page}에서 데이터 없음")
                    continue
                
                for row in table_rows:
                    row_data = extract_event_row(row)
                    if not row_data:
                        continue
                    
                    key = f"{row_data['title']}|{row_data['date']}|{row_data['author']}"
                    
                    if key in existing_map:
                        event_id = existing_map[key]
                    else:
                        event_id = generate_stable_id("event", row_data['title'], 
                                                      row_data['date'], row_data['author'])
                    
                    new_data_by_key[key] = {
                        "id": event_id,
                        "no": row_data['no'],
                        "title": row_data['title'],
                        "date": row_data['date'],
                        "author": row_data['author'],
                        "views": row_data['views'],
                        "category": "event",
                        "content": "",
                        "url": row_data['url'],
                        "isImportant": row_data['is_important'],
                        "isPinned": row_data['is_pinned']
                    }
            
            except Exception as e:
                print(f"  ⚠️  페이지 {page} 크롤링 오류: {e}")
                continue
        
        # 새로운 데이터와 기존 데이터 합치기
        new_list = list(new_data_by_key.values())
        
        for existing in existing_events:
            key = f"{existing['title']}|{existing['date']}|{existing['author']}"
            if key not in new_data_by_key:
                new_list.append(existing)
        
        os.makedirs(os.path.dirname(data_path), exist_ok=True)
        with open(data_path, 'w', encoding='utf-8') as f:
            json.dump(new_list, f, ensure_ascii=False, indent=2)
        
        new_count = len(new_data_by_key) - len([k for k in new_data_by_key.keys() if k in existing_map])
        print(f"\n✅ 행사공지 크롤링 완료")
        print(f"   신규: {new_count}개, 기존: {len(existing_map)}개, 총: {len(new_list)}개")
    
    except Exception as e:
        print(f"❌ 행사공지 크롤링 실패: {e}")
        raise

if __name__ == "__main__":
    crawl_event_notices()
