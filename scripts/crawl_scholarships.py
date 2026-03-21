# -*- coding: utf-8 -*-
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
"""
장학공지 크롤링 스크립트 (증분 크롤링)
매일 실행됨 - 기존 데이터는 유지하고 새로운 글만 추가
https://www.syu.ac.kr/academic/scholarship-information/scholarship-notice/page/1
"""

import requests
from bs4 import BeautifulSoup
import json
import os
from datetime import datetime
import uuid

def crawl_scholarship_notice():
    """장학공지 증분 크롤링"""
    data_path = "public/data/announcements-scholarship.json"
    
    # 기존 데이터 로드
    existing_notices = []
    latest_title = ""
    
    if os.path.exists(data_path):
        try:
            with open(data_path, 'r', encoding='utf-8') as f:
                existing_notices = json.load(f)
                if existing_notices:
                    latest_title = existing_notices[0]['title']
                    print(f"📌 최신 글: \"{latest_title}\"")
        except Exception as e:
            print(f"⚠️  기존 데이터 로드 실패: {e}")
            print("새로 시작합니다.")
    
    new_notices = []
    base_url = "https://www.syu.ac.kr/academic/scholarship-information/scholarship-notice/page"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    print("🎓 장학공지 크롤링 시작...")
    
    try:
        # 최신 글을 찾을 때까지 페이지 순회
        for page in range(1, 227):
            print(f"  페이지 {page} 크롤링 중...")
            
            try:
                response = requests.get(f"{base_url}/{page}/", headers=headers, timeout=10)
                response.encoding = 'utf-8'
                
                if response.status_code != 200:
                    break
                
                soup = BeautifulSoup(response.text, 'html.parser')
                found_latest = False
                
                # 공지사항 목록 추출
                table_rows = soup.select("table tbody tr")
                
                for row in table_rows:
                    if found_latest:
                        break
                    
                    try:
                        # 필드 추출
                        title_elem = row.select_one("td:nth-of-type(2) a")
                        if not title_elem:
                            continue
                        
                        title = title_elem.get_text(strip=True)
                        url = title_elem.get('href', '')
                        
                        # 상대 경로를 절대 경로로 변환
                        if url and not url.startswith('http'):
                            url = "https://www.syu.ac.kr" + url
                        
                        date_text = row.select_one("td:nth-of-type(3)").get_text(strip=True) if row.select_one("td:nth-of-type(3)") else ""
                        author = row.select_one("td:nth-of-type(4)").get_text(strip=True) if row.select_one("td:nth-of-type(4)") else ""
                        views_text = row.select_one("td:nth-of-type(5)").get_text(strip=True) if row.select_one("td:nth-of-type(5)") else "0"
                        
                        try:
                            views = int(views_text)
                        except:
                            views = 0
                        
                        # "[공지]" 또는 "[필독]" 텍스트 확인
                        is_important = "[공지]" in title or "[필독]" in title
                        clean_title = title.replace("[공지]", "").replace("[필독]", "").strip()
                        
                        # 최신 글과 같은 글을 찾았으면 중지
                        if clean_title == latest_title:
                            print(f"  ✓ 최신 글 \"{latest_title}\" 발견, 크롤링 중지")
                            found_latest = True
                            break
                        
                        if title:
                            new_notices.append({
                                "id": f"scholarship-{datetime.now().timestamp()}-{str(uuid.uuid4())[:8]}",
                                "title": clean_title,
                                "date": date_text,
                                "author": author or "장학팀",
                                "views": views,
                                "category": "scholarship",
                                "content": "",
                                "url": url,
                                "isImportant": is_important
                            })
                    except Exception as e:
                        print(f"  ⚠️  행 파싱 오류: {e}")
                        continue
                
                if found_latest:
                    break
            
            except requests.RequestException as e:
                print(f"  ❌ 페이지 요청 실패: {e}")
                break
        
        # 새로운 글과 기존 글 합치기 (새 글이 앞에 옴)
        all_notices = new_notices + existing_notices
        
        # 디렉토리 생성 및 JSON 파일로 저장
        os.makedirs(os.path.dirname(data_path), exist_ok=True)
        with open(data_path, 'w', encoding='utf-8') as f:
            json.dump(all_notices, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 장학공지 {len(new_notices)}개 신규 추가, 총 {len(all_notices)}개 저장 완료")
    
    except Exception as e:
        print(f"❌ 장학공지 크롤링 실패: {e}")
        raise

if __name__ == "__main__":
    crawl_scholarship_notice()
