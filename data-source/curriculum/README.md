# 교육과정 제작·검증 자료

2025 OCR 입력, 수동 검증 기록, 감사 결과를 보관한다. 이 파일들은 앱의 런타임 데이터가 아니며 웹 정적 경로로 배포하지 않는다. 원본 PDF 경로·해시·페이지 매핑·검증 메타데이터는 기존 내용 그대로 유지한다.

- `curriculum-courses-2025-ocr.json`: OCR 입력
- `curriculum-course-verifications.json`: 수동 검증 기록
- `curriculum-courses-2025-audit.json`: 감사 결과

`scripts/audit_curriculum_courses.py`, `audit_verified_curriculum_quality.py`, `build_verified_curriculum.py`, `check_curriculum_data.mjs`가 이 위치를 사용한다. 앱에서 사용하는 verified 교육과정·졸업 규칙과 기존 fallback JSON은 계속 `public/data/`에 둔다.

위치 변경은 데이터의 재배포 허가를 확인했다는 뜻이 아니다. 권리·출처 범위는 [NOTICE](../../NOTICE.md)를 따른다.
