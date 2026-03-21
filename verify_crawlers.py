# -*- coding: utf-8 -*-
import json
import sys
from collections import Counter

files = {
    "행사공지": "public/data/announcements-events.json",
    "학사공지": "public/data/announcements-academic.json",
    "장학공지": "public/data/announcements-scholarship.json",
    "캠퍼스공지": "public/data/announcements-campus-life.json",
}

print("=" * 80)
print("📊 JSON 파일 검증 및 중복 확인")
print("=" * 80)

for name, path in files.items():
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"\n📌 {name}")
        print(f"   파일: {path}")
        print(f"   총 항목 수: {len(data)}")
        
        if len(data) > 0:
            first = data[0]
            print(f"   ✓ 최신 항목 (JSON 상단):")
            print(f"     - 제목: {first.get('title', 'N/A')[:70]}")
            print(f"     - 날짜: {first.get('date', 'N/A')}")
            print(f"     - 작성: {first.get('author', 'N/A')}")
            
            # 제목 중복 확인
            titles = [item.get('title', '') for item in data]
            unique_titles = set(titles)
            duplicates = len(titles) - len(unique_titles)
            print(f"   ✓ 중복 제목 수: {duplicates}")
            
            if duplicates > 0:
                title_counts = Counter(titles)
                dup_titles = [t for t, c in title_counts.items() if c > 1]
                print(f"   ⚠️ 중복된 제목 예시: {dup_titles[:2]}")
    except Exception as e:
        print(f"   ❌ 오류: {e}")

print("\n" + "=" * 80)
print("✅ 검증 완료")
print("=" * 80)
