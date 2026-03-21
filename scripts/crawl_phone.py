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

def crawl_phone_numbers():
    """전화번호 크롤링"""
    phones = []
    url = "https://www.syu.ac.kr/about-sahmyook/phone-number-information/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    print("📞 업무별 전화번호 크롤링 시작...")
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
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
            table_rows = soup.select("table tbody tr")
            
            for row in table_rows:
                cells = row.select("td")
                
                if len(cells) >= 2:
                    department = cells[0].get_text(strip=True)
                    phone = cells[1].get_text(strip=True)
                    
                    if department and phone:
                        phones.append({
                            "department": department,
                            "phone": phone
                        })
        
        # JsonL로 저장
        data_path = "public/data/phone-numbers.json"
        os.makedirs(os.path.dirname(data_path), exist_ok=True)
        
        with open(data_path, 'w', encoding='utf-8') as f:
            json.dump(phones, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 전화번호 {len(phones)}개 저장 완료: {data_path}")
    
    except Exception as e:
        print(f"❌ 전화번호 크롤링 실패: {e}")
        raise

if __name__ == "__main__":
    crawl_phone_numbers()
