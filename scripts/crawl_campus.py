# -*- coding: utf-8 -*-
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
"""
캠퍼스 생활공지 크롤링 스크립트 (증분 크롤링)
매일 실행됨 - 기존 데이터는 유지하고 새로운 글만 추가
https://www.syu.ac.kr/university-square/notice/campus-notice/page/1
"""

import requests
from bs4 import BeautifulSoup
import json
import os
from datetime import datetime
import uuid

def crawl_campus_notices():
    """캠퍼스 생활공지 전체 크롤링 (모든 페이지 수집)"""
    data_path = "public/data/announcements-campus-life.json"
    
    all_notices = []
    base_url = "https://www.syu.ac.kr/university-square/notice/campus-notice/page"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    print("🏫 캠퍼스 생활공지 크롤링 시작 (전체 수집)...")
    
    try:
        # 모든 페이지를 순회 (최대 100페이지)
        consecutive_failures = 0
        for page in range(1, 101):
            print(f"  페이지 {page} 크롤링 중...")
            
            try:
                response = requests.get(f"{base_url}/{page}/", headers=headers, timeout=10)
                response.encoding = 'utf-8'
                
                if response.status_code != 200:
                    consecutive_failures += 1
                    if consecutive_failures >= 3:
                        print(f"  ❌ {consecutive_failures}회 연속 요청 실패, 크롤링 중지")
                        break
                    continue
                
                consecutive_failures = 0
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # 공지사항 목록 추출
                table_rows = soup.select("table tbody tr")
                
                if not table_rows:
                    print(f"  페이지 {page}에서 데이터 없음, 크롤링 종료")
                    break
                
                page_count = 0
                for idx, row in enumerate(table_rows):
                    
                    try:
                        # 필드 추출
                        title_elem = row.select_one("td:nth-of-type(1) a")
                        if not title_elem:
                            continue
                        
                        title = title_elem.get_text(strip=True)
                        url = title_elem.get('href', '')
                        
                        # 상대 경로를 절대 경로로 변환
                        if url and not url.startswith('http'):
                            url = "https://www.syu.ac.kr" + url
                        
                        date_text = row.select_one("td:nth-of-type(3)").get_text(strip=True) if row.select_one("td:nth-of-type(3)") else ""
                        author = row.select_one("td:nth-of-type(2)").get_text(strip=True) if row.select_one("td:nth-of-type(2)") else ""
                        views_text = row.select_one("td:nth-of-type(5)").get_text(strip=True) if row.select_one("td:nth-of-type(5)") else "0"
                        
                        try:
                            views = int(views_text)
                        except:
                            views = 0
                        
                        # "[공지]" 또는 "[중요]" 텍스트 확인
                        is_important = "[공지]" in title or "[중요]" in title
                        clean_title = title.replace("[공지]", "").replace("[중요]", "").strip()
                        
                        if title:
                            all_notices.append({
                                "id": f"campus-{datetime.now().timestamp()}-{str(uuid.uuid4())[:8]}",
                                "title": clean_title,
                                "date": date_text or datetime.now().strftime("%Y-%m-%d"),
                                "author": author or "학생생활팀",
                                "views": views,
                                "category": "campus",
                                "content": "",
                                "url": url,
                                "isImportant": is_important
                            })
                            page_count += 1
                    except Exception as e:
                        print(f"  ⚠️  행 파싱 오류: {e}")
                        continue
                
                print(f"  페이지 {page}에서 {page_count}개 수집")
            
            except requests.RequestException as e:
                print(f"  ❌ 페이지 요청 실패: {e}")
                break
        
        # 중복 제거 (ID 기준)
        seen_ids = set()
        unique_notices = []
        for notice in all_notices:
            if notice['title'] not in seen_ids:
                seen_ids.add(notice['title'])
                unique_notices.append(notice)
        
        # 디렉토리 생성 및 JSON 파일로 저장
        os.makedirs(os.path.dirname(data_path), exist_ok=True)
        with open(data_path, 'w', encoding='utf-8') as f:
            json.dump(unique_notices, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 캠퍼스 생활공지 총 {len(unique_notices)}개 수집 및 저장 완료")
    
    except Exception as e:
        print(f"❌ 캠퍼스 생활공지 크롤링 실패: {e}")
        raise

if __name__ == "__main__":
    crawl_campus_notices()
