# -*- coding: utf-8 -*-
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
"""
셔틀버스 시간표 크롤링 스크립트
평일, 금요일, 방학 데이터를 모두 파싱합니다
https://www.syu.ac.kr/school-life/school-bus/
"""

import requests
from bs4 import BeautifulSoup
import json
import os
import re
from datetime import datetime

def sort_times(times):
    """시간을 문자열 형태로 유지하면서 시간 순서대로 정렬"""
    def time_to_minutes(time_str):
        try:
            parts = time_str.split(':')
            return int(parts[0]) * 60 + int(parts[1])
        except:
            return 0
    
    return sorted(set(times), key=time_to_minutes)

def extract_times_from_text(text):
    """텍스트에서 시간 형식의 데이터 추출 (HH:MM)"""
    # "시:분" 또는 "HH:MM ∼ HH:MM" 형식에서 시간 추출
    times = re.findall(r'(\d{1,2}):(\d{2})', text)
    return [f"{t[0]:0>2}:{t[1]}" for t in times]

def parse_table_0(table):
    """표 0: 평일 오전/오후 운행시간표 (화랑대역, 석계역)"""
    routes = []
    tbody = table.find('tbody')
    rows = tbody.find_all('tr')
    
    current_route = None
    for row in rows:
        cells = row.find_all(['th', 'td'])
        if not cells:
            continue
        
        # 경로명 행 (colspan=2인 첫 셀)
        if cells[0].get('colspan') == '2':
            route_text = cells[0].get_text(strip=True)
            route_text = route_text.replace('오전', '').replace('오후', '').strip()
            
            # 오전/오후 판별
            period = '오전' if '화랑대' in route_text else '오후'
            
            current_route = {
                'routeName': route_text,
                'period': period,
                'weekday': [],
                'friday': []
            }
            routes.append(current_route)
        
        elif current_route:
            # 시간 정보 행
            # 구조: col[0] = 월~목시간, col[1] = 월~목간격, col[2] = 금요일시간, col[3] = 금요일간격
            # 모든 컬럼에서 시간을 추출하되, colspan에 따라 처리
            
            # colspan이 있는지 확인
            has_colspan = any(cell.get('colspan') for cell in cells)
            
            if not has_colspan:
                # 일반 행: 4개 셀 (월~목 2개, 금요일 2개)
                if len(cells) >= 4:
                    # col 0, 1: 월~목
                    for col_idx in [0, 1]:
                        times = extract_times_from_text(cells[col_idx].get_text(strip=True))
                        if times:
                            current_route['weekday'].extend(times)
                    
                    # col 2, 3: 금요일
                    for col_idx in [2, 3]:
                        times = extract_times_from_text(cells[col_idx].get_text(strip=True))
                        if times:
                            current_route['friday'].extend(times)
                
                elif len(cells) == 2:
                    # rowspan 때문에 2개만 있는 부분행: 월~목, 금요일
                    times_0 = extract_times_from_text(cells[0].get_text(strip=True))
                    times_1 = extract_times_from_text(cells[1].get_text(strip=True))
                    if times_0:
                        current_route['weekday'].extend(times_0)
                    if times_1:
                        current_route['friday'].extend(times_1)
    
    # 정렬
    for route in routes:
        route['weekday'] = sort_times(route['weekday'])
        route['friday'] = sort_times(route['friday'])
    
    return routes

def parse_table_1(table):
    """표 1: 평일 별내역 운행시간표"""
    routes = []
    tbody = table.find('tbody')
    rows = tbody.find_all('tr')
    
    if not rows:
        return routes
    
    # 표 1은 헤더 역할을 하는 첫 행이 있음 (학교 출발, 별내역 출발)
    # 이것을 경로명으로 사용
    header_cells = rows[0].find_all(['th', 'td'])
    
    # 월~목: [학교 출발] [별내역 출발]
    # 금요일: [학교 출발] [별내역 출발]
    route_names = [
        "학교 → 별내역",  # 학교 출발
        "별내역 → 학교"   # 별내역 출발
    ]
    
    # 데이터 행 (1번째부터)
    for route_name in route_names:
        route = {
            'routeName': route_name,
            'period': 'allday',  # 하루종일
            'weekday': [],
            'friday': [],
            'weekend': []
        }
        
        routes.append(route)
    
    # 각 시간대별로 데이터 추출
    col_mapping = {
        0: (0, 'weekday'),  # 월~목 학교 출발
        1: (1, 'weekday'),  # 월~목 별내역 출발
        2: (0, 'friday'),   # 금요일 학교 출발
        3: (1, 'friday')    # 금요일 별내역 출발
    }
    
    for row_idx in range(1, len(rows)):
        row = rows[row_idx]
        cells = row.find_all(['th', 'td'])
        
        for col_idx, (route_idx, period) in col_mapping.items():
            if col_idx < len(cells):
                times = extract_times_from_text(cells[col_idx].get_text(strip=True))
                if times:
                    routes[route_idx][period].extend(times)
    
    # 정렬
    for route in routes:
        route['weekday'] = sort_times(route['weekday'])
        route['friday'] = sort_times(route['friday'])
    
    return routes

def parse_table_2(table):
    """표 2: 방학중 운행표"""
    routes = []
    tbody = table.find('tbody')
    rows = tbody.find_all('tr')
    
    if not rows:
        return routes
    
    route_names = [
        "학교 → 화랑대역",
        "화랑대역 → 학교"
    ]
    
    for route_name in route_names:
        route = {
            'routeName': route_name,
            'period': 'vacation',
            'weekday': [],
            'friday': [],
            'weekend': []
        }
        routes.append(route)
    
    # 컬럼 매핑
    col_mapping = {
        0: (0, 'weekday'),  # 월~목 학교 출발
        1: (1, 'weekday'),  # 월~목 화랑대 출발
        2: (0, 'friday'),   # 금요일 학교 출발
        3: (1, 'friday')    # 금요일 화랑대 출발
    }
    
    for row_idx in range(len(rows)):
        row = rows[row_idx]
        cells = row.find_all(['th', 'td'])
        
        for col_idx, (route_idx, period) in col_mapping.items():
            if col_idx < len(cells):
                times = extract_times_from_text(cells[col_idx].get_text(strip=True))
                if times:
                    routes[route_idx][period].extend(times)
    
    # 정렬
    for route in routes:
        route['weekday'] = sort_times(route['weekday'])
        route['friday'] = sort_times(route['friday'])
    
    return routes

def crawl_shuttle_bus():
    """셔틀버스 시간표 크롤링 - 모든 표를 파싱"""
    data_path = "public/data/shuttle-bus-schedule.json"
    
    url = "https://www.syu.ac.kr/school-life/school-bus/"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    
    print("🚌 셔틀버스 시간표 크롤링 시작...")
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.encoding = 'utf-8'
        
        if response.status_code != 200:
            print(f"❌ 요청 실패: {response.status_code}")
            return
        
        soup = BeautifulSoup(response.text, 'html.parser')
        tables = soup.find_all("table")
        print(f"📊 총 {len(tables)}개의 테이블 발견")
        
        all_routes = []
        
        # 각 표를 처리
        for table_idx, table in enumerate(tables):
            try:
                if table_idx == 0:
                    routes = parse_table_0(table)
                    print(f"  ✓ 표 0 (평일 오전/오후): {len(routes)}개 경로")
                elif table_idx == 1:
                    routes = parse_table_1(table)
                    print(f"  ✓ 표 1 (평일 별내역): {len(routes)}개 경로")
                elif table_idx == 2:
                    routes = parse_table_2(table)
                    print(f"  ✓ 표 2 (방학): {len(routes)}개 경로")
                else:
                    continue
                
                for route in routes:
                    if route.get('weekday') or route.get('friday'):
                        all_routes.append(route)
            
            except Exception as e:
                print(f"  ⚠️  표 {table_idx} 파싱 오류: {e}")
                continue
        
        # 디렉토리 생성 및 JSON 저장
        os.makedirs(os.path.dirname(data_path), exist_ok=True)
        with open(data_path, 'w', encoding='utf-8') as f:
            json.dump(all_routes, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 셔틀버스 {len(all_routes)}개 경로 저장 완료")
        
        # 저장된 경로 출력
        for route in all_routes:
            print(f"  📍 {route['routeName']} ({route.get('period', 'N/A')})")
            print(f"     평일: {len(route.get('weekday', []))}개, 금요일: {len(route.get('friday', []))}개")
    
    except Exception as e:
        print(f"❌ 크롤링 실패: {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    crawl_shuttle_bus()

