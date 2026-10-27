# 문서 안내

코드·환경 설정을 변경할 때 관련 가이드를 함께 갱신합니다. 문서의 기준일이나 과거 검사 성공은 현재 운영 상태를 보장하지 않습니다.

| 목적 | 문서 |
| --- | --- |
| M3 프로덕션 배포 준비 | [보완 반영·재검증](DEPLOYMENT_REMEDIATION_2026-10-26.md), [조사 보고서](PRODUCTION_READINESS_2026-10-26.md), [공개 저장소 정리](PUBLIC_REPOSITORY_CLEANUP_2026-10-26.md), [배포·롤백 체크리스트](RELEASE_CHECKLIST_2026-10-26.md) |
| Firebase 이전과 다음 작업 | [배포 전 남은 작업·진행 상태](PRE_RELEASE_PROGRESS_2026-10-27.md), [실행 기록](FIREBASE_MIGRATION_IMPLEMENTATION_2026-10-26.md), [상세 계획](FIREBASE_MIGRATION_RELEASE_PLAN_2026-10-26.md), [독립 UI 검증](UI_UX_VERIFICATION_2026-10-26.md), [공지 이전](SERVICE_NOTICE_MIGRATION.md), [공개 snapshot 운영](PUBLIC_DATA_FIREBASE.md) |
| 프로젝트 기능·설치 | [프로젝트 소개](../README.md) |
| 개발 환경·명령·검증 | [개발 가이드](../DEVELOPMENT.md), [기여 안내](../CONTRIBUTING.md) |
| UI 구현·다국어 | [UI 가이드](UI_DESIGN_GUIDE.md), [다국어 정책](I18N_POLICY.md), [사용자 문구·예외 처리](USER_COPY_AUDIT_2026-10-26.md) |
| 성능 측정·개선 현황 | [성능 가이드](../PERFORMANCE.md), [디자인·사용성·성능 점검](DESIGN_UX_AUDIT_2026-10-18.md) |
| 환경변수·Firestore | [환경 등록](ENVIRONMENT_REGISTRATION.md), [규칙·인덱스·TTL](FIRESTORE_RULES.md) |
| 룸메이트 게시판 | [기능·인증·운영·검증](ROOMMATES.md) |
| 관리자·서비스 공지·배너 | [운영 가이드](ADMIN_CONTENT.md), [구현·검증 결과](ADMIN_DASHBOARD_IMPLEMENTATION_2026-10-26.md) |
| 크롤링 데이터·발행·복구 | [Crawl Data Pages](CRAWL_DATA_PAGES.md), [만나의집 데이터](STUDENT_RESTAURANT.md) |
| 교통 데이터 | [버스 API](BUS_API_GUIDE.md) |
| 검색 노출·IndexNow | [검색 인덱싱](SEARCH_INDEXING_GUIDE.md) |
| Android TWA | [빌드·서명·출시](TWA_ANDROID.md) |
| 운영 확인이 필요한 경계 | [유지보수 점검](MAINTENANCE.md) |

## 공개 문서 유지 원칙

공개 자료의 영문본과 Google Translate 연결은 [콘텐츠 번역 운영](CONTENT_TRANSLATION.md), 기본 UI 사전과 원문 보존은 [i18n 정책](I18N_POLICY.md)을 참고합니다.

- 기능·정책·설정·복구 절차는 주제별 가이드 한 곳에 유지하고, 다른 문서는 연결합니다. 수정 전 계획과 작업 중간 기록을 현행 운영 설명과 섞지 않습니다.
- 문서를 정리할 때 미해결 문제·수동 검증 조건·권리 및 출처는 보존합니다. 로컬·CI·배포·실제 서비스 검증을 구분하고 실행하지 않은 검사를 완료로 표시하지 않습니다.
- 캡처·HAR·성능 원본·실험 checkout·빌드 로그는 로컬의 `output/`, `.playwright-mcp/`, `.cache/`에 둡니다. 이 경로는 Git과 앱 검사에서 제외됩니다. 공개 근거가 필요하면 개인정보를 제거한 요약과 재현 조건을 문서에 기록합니다.
- 개인 PC 절대경로, 인증 링크·계정·비밀값, 분석 도구 원본 화면을 공개 문서에 넣지 않습니다. 저장소 파일은 상대 링크로 연결합니다.

2026-10-18 정리에서 룸메이트 작업 기록 7개는 `ROOMMATES.md`로, 10월 4–5일 사이트 감사·수정·위험 기록 4개는 현행 가이드와 `MAINTENANCE.md`로 통합했습니다. 디자인·성능 조사는 동일 날짜 문서에 적용 상태와 비교 조건을 남겼습니다. 원문은 로컬 보관했으며 공개 저장소에는 중복 사본을 추가하지 않습니다.
