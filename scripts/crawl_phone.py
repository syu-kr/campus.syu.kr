# -*- coding: utf-8 -*-
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
"""
업무별 전화번호 안내 크롤링 스크립트
월 1회 실행됨
https://www.syu.ac.kr/about-sahmyook/phone-number-information/
"""

import requests
from bs4 import BeautifulSoup
import json
import os

from crawler_utils import DEFAULT_HEADERS, write_json_atomic


def phone_key(phone_info):
    return f"{phone_info.get('department', '')}|{phone_info.get('description', '')}"

def crawl_phone_numbers():
    """전화번호 크롤링 (증분 업데이트)"""
    data_path = "public/data/phone-numbers.json"
    
    # 기존 데이터 로드
    existing_phones = {}
    if os.path.exists(data_path):
        try:
            with open(data_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
                for phone_info in existing_data:
                    existing_phones[phone_key(phone_info)] = phone_info
                print(f"📌 기존 부서 {len(existing_phones)}개 로드됨")
        except Exception as e:
            print(f"⚠️  기존 데이터 로드 실패: {e}")
    
    phones = []
    url = "https://www.syu.ac.kr/about-sahmyook/phone-number-information/"
    print("📞 업무별 전화번호 크롤링 시작...")
    
    try:
        response = requests.get(url, headers=DEFAULT_HEADERS, timeout=10)
        response.encoding = 'utf-8'
        
        if response.status_code != 200:
            print(f"❌ 요청 실패: {response.status_code}")
            return
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 전화번호 정보 추출 - 클래스 선택자 등으로 시도
        phone_elements = soup.select(".phone-info, .contact-info")
        
        for elem in phone_elements:
            department = elem.select_one(".dept, .department")
            phone = elem.select_one(".phone, .contact")
            description_elem = elem.select_one(".desc, .description")
            
            if department and phone:
                phones.append({
                    "department": department.get_text(strip=True),
                    "phone": phone.get_text(strip=True),
                    "description": description_elem.get_text(strip=True) if description_elem else None
                })
        
        # 테이블 형식이 없으면 테이블에서 추출
        if not phones:
            table_rows = soup.select("table tr")
            current_department = ""
            
            for row in table_rows:
                cells = row.find_all(["th", "td"])
                cell_texts = [cell.get_text(" ", strip=True) for cell in cells]
                if cell_texts == ["담당부서", "담당업무", "연락처"]:
                    continue
                
                if len(cells) >= 3:
                    department = cell_texts[0] or current_department
                    description = cell_texts[1]
                    phone = cell_texts[2]
                    if department:
                        current_department = department
                    
                    if department and phone:
                        phones.append({
                            "department": department,
                            "phone": phone,
                            "description": description or None
                        })
                elif len(cells) >= 2 and current_department:
                    description = cell_texts[0]
                    phone = cell_texts[1]
                    if phone:
                        phones.append({
                            "department": current_department,
                            "phone": phone,
                            "description": description or None
                        })
        
        if not phones:
            raise RuntimeError("전화번호 테이블에서 연락처를 찾지 못했습니다.")
        
        if existing_phones and len(phones) < max(5, len(existing_phones) // 2):
            raise RuntimeError(
                f"크롤링된 연락처가 기존 대비 너무 적습니다: {len(phones)} / {len(existing_phones)}"
            )
        
        # 기존 데이터와 비교하여 변경사항 감지
        new_phones = []
        updated_count = 0
        new_count = 0
        
        for phone_info in phones:
            key = phone_key(phone_info)
            dept = phone_info['department']
            if key in existing_phones:
                # 기존 부서 - 번호가 달라졌으면 업데이트
                if existing_phones[key]['phone'] != phone_info['phone']:
                    print(f"  🔄 {dept}: {existing_phones[key]['phone']} → {phone_info['phone']}")
                    updated_count += 1
                    new_phones.append(phone_info)
                else:
                    # 번호가 같으면 기존 데이터 유지
                    new_phones.append(existing_phones[key])
            else:
                # 새로운 부서
                print(f"  ✨ 신규 부서: {dept}")
                new_count += 1
                new_phones.append(phone_info)
        
        write_json_atomic(data_path, new_phones)
        
        print(f"✅ 전화번호 {len(new_phones)}개 저장 (신규: {new_count}개, 변경: {updated_count}개)")
    
    except Exception as e:
        print(f"❌ 전화번호 크롤링 실패: {e}")
        raise

if __name__ == "__main__":
    crawl_phone_numbers()
