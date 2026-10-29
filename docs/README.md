# 문서 안내

기능·정책·설정·복구 절차는 주제별 가이드 한 곳에서 유지합니다. 과거 검사 성공이나 작성일은 현재 운영 상태를 보장하지 않습니다.

| 목적 | 문서 |
| --- | --- |
| 프로젝트 소개·기여 | [프로젝트](../README.md), [개발](../DEVELOPMENT.md), [기여](../CONTRIBUTING.md) |
| Firebase 전환 준비·실행·복구·Pages 종료 조건 | [전환 실행 가이드](FIREBASE_CUTOVER.md) |
| 공개 데이터 저장·발행·복구 | [Firebase snapshot](PUBLIC_DATA_FIREBASE.md), [Pages 호환](CRAWL_DATA_PAGES.md), [만나의집](STUDENT_RESTAURANT.md) |
| 서비스 공지·배너 | [관리자 운영](ADMIN_CONTENT.md), [공지 이전](SERVICE_NOTICE_MIGRATION.md) |
| UI·문구·다국어 | [UI 가이드](UI_DESIGN_GUIDE.md), [i18n](I18N_POLICY.md), [콘텐츠 번역](CONTENT_TRANSLATION.md) |
| 성능·미검증 경계 | [성능 가이드](../PERFORMANCE.md), [유지보수](MAINTENANCE.md) |
| 환경·Firestore | [환경 등록](ENVIRONMENT_REGISTRATION.md), [규칙·인덱스·TTL](FIRESTORE_RULES.md) |
| 학사·캠퍼스 API | [학사 데이터 계약](M3_ACADEMIC_API_MAPPING.md), [캠퍼스 API](m3-campus-api-integration.md) |
| 룸메이트 | [인증·운영·통합 검증](ROOMMATES.md) |
| 교통 | [버스 API](BUS_API_GUIDE.md) |
| 검색·공유 | [인덱싱·OG](SEARCH_INDEXING_GUIDE.md) |
| Android TWA | [빌드·서명·출시](TWA_ANDROID.md) |

## 공개 문서 유지 원칙

- 날짜별 감사·실행 기록은 현행 가이드의 중복 사본으로 공개하지 않습니다. 날짜가 붙은 로컬 보고서는 Git에서 제외하며 원본은 로컬에 보존할 수 있습니다. 미해결 게이트·복구·라이선스/출처는 주제별 가이드에 남깁니다.
- 캡처·HAR·원본 trace·빌드 로그·개인 실험은 Git에서 제외한 output·.playwright-mcp·.cache에 둡니다. 공개 문서에는 재현 조건과 개인정보를 제거한 요약을 기록합니다.
- 개인 PC 경로·관리자 UID·비밀값·원본 인증/계정 화면·내부 실행 ID를 공개 문서에 넣지 않습니다. 저장소 파일은 상대 링크로 연결하고 로컬 전용 원본에 대한 깨진 링크를 만들지 않습니다.
- 로컬·CI·실제 배포·실기기 검증을 구분하고 미실행 검사를 완료로 표시하지 않습니다. 운영 전환·발행·Pages 종료는 문서 작성이나 PR 생성으로 실행되지 않습니다.
