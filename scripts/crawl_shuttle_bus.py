# -*- coding: utf-8 -*-
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
"""
셔틀버스 시간표 크롤링 스크립트 (변경사항만 반영)
월 1회 실행됨 - 기존 데이터와 비교 후 변경된 노선만 업데이트
https://www.syu.ac.kr/school-life/school-bus/
"""

import requests
from bs4 import BeautifulSoup
import json
import os
import re
from datetime import datetime

def crawl_shuttle_bus():
    """셔틀버스 시간표 크롤링"""
    data_path = "public/data/shuttle-bus-schedule.json"
    
    # 기존 데이터 로드
    existing_routes = {}
    if os.path.exists(data_path):
        try:
            with open(data_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
                for route in existing_data:
                    existing_routes[route['routeName']] = route
                print(f"📌 기존 노선 {len(existing_routes)}개 로드됨")
        except Exception as e:
            print(f"⚠️  기존 데이터 로드 실패: {e}")
    
    url = "https://www.syu.ac.kr/school-life/school-bus/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    print("🚌 셔틀버스 시간표 크롤링 시작...")
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.encoding = 'utf-8'
        
        if response.status_code != 200:
            print(f"❌ 요청 실패: {response.status_code}")
            return
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        schedules = []
        tables = soup.find_all("table")
        print(f"📊 총 {len(tables)}개의 테이블 발견")
        
        for table in tables:
            try:
                # 제목 찾기
                header_title = ""
                prev_elem = table.find_previous(["h3", "h4", "strong", "b", "p"])
                if prev_elem:
                    header_title = prev_elem.get_text(strip=True)
                
                # 목적지 찾기
                route_title = ""
                header_row = table.select_one("thead tr")
                if header_row:
                    route_title = header_row.get_text(strip=True)
                
                # 첫 행에서 목적지 추출
                first_row = table.select_one("tbody tr")
                if not first_row:
                    continue
                
                cells = first_row.select("td")
                if not cells:
                    continue
                
                destination = cells[0].get_text(strip=True) or route_title or header_title
                
                # 시간 추출
                times = []
                for tr in table.select("tbody tr"):
                    for td in tr.select("td"):
                        time_text = td.get_text(strip=True)
                        if re.match(r'^\d{1,2}:\d{2}', time_text):
                            time = time_text[:5]
                            if time not in times:
                                times.append(time)
                
                if times:
                    times.sort()
                    
                    # 금요일 여부 확인
                    is_alt_day = "금" in (header_title + route_title)
                    
                    schedule = {
                        "id": f"shuttle-{len(schedules)}",
                        "routeName": destination,
                        "startLocation": "삼육대학교",
                        "endLocation": destination,
                        "schedules": {
                            "weekday": times if not is_alt_day else [],
                            "weekdayAlt": times if is_alt_day else [],
                            "weekend": []
                        },
                        "lastUpdated": datetime.now().isoformat()
                    }
                    
                    # 기존 데이터와 비교
                    if destination in existing_routes:
                        old_times = existing_routes[destination]['schedules'].get('weekday', [])
                        if old_times != times:
                            print(f"  🔄 노선 업데이트: {destination}")
                        else:
                            print(f"  ✓ 노선 유지: {destination}")
                        # 기존 데이터의 다른 필드 유지
                        schedule = {**existing_routes[destination], **schedule}
                    else:
                        print(f"  ✨ 신규 노선: {destination}")
                    
                    schedules.append(schedule)
            
            except Exception as e:
                print(f"  ⚠️  테이블 파싱 오류: {e}")
                continue
        
        # 디렉토리 생성 및 JSON 파일로 저장
        os.makedirs(os.path.dirname(data_path), exist_ok=True)
        with open(data_path, 'w', encoding='utf-8') as f:
            json.dump(schedules, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 셔틀버스 {len(schedules)}개 노선 저장 완료")
    
    except Exception as e:
        print(f"❌ 셔틀버스 크롤링 실패: {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    crawl_shuttle_bus()
