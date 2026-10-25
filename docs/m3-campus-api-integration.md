# M3 실제 서비스 이식: 캠퍼스·문의·일정 도구 연결 경계

이 문서는 실제 소스 연결과 운영 환경에서 확인할 항목을 구분한다. 시안의 fixture, API stub, 지도 대체 화면, 고정 시계는 서비스 코드에 이식하지 않았다. API 경로·서버 검증·권한·Firestore 저장 계약은 기존 구현을 사용한다.

## 연결된 데이터와 작업

| 화면/기능 | 실제 경로 및 데이터 | 변경 후 유지한 조건 |
| --- | --- | --- |
| 전체·학사·캠퍼스·장학·SW 공지 | 서버 `getAnnouncementPage`, 브라우저 `/api/announcements` | category, query, page, limit=10, 제목·작성자·본문 검색, 원문 외부 링크, 수집 상태·fallback 안내 |
| 공지 URL·SEO | 화면 URL의 `search`, `page`를 서버·클라이언트가 함께 읽고 Next Router가 서버 데이터·metadata를 함께 갱신 | 언어·기타 query 유지, 검색 변경/초기화 시 1페이지, 번호·이전·다음 실제 href, 수정키 클릭 기본 동작, 비검색 페이지별 canonical/hreflang, 검색 noindex/follow, 일치하는 서버 응답은 브라우저 API로 중복 조회하지 않음 |
| 문의·제안 | `POST /api/contact` → `site_inquiries` | 기존 5개 문의 유형, title/message/pageUrl/contact/website payload, 필수값·HTTP URL 검증, honeypot, 동일 출처·요청량 제한, 성공 결과·작성 중 복귀 |
| 꿀팁 제보 | `POST /api/campus-tips/suggestions` → `campus_tip_suggestions` | 기존 category, title/description/url/tags/note/contact/website payload, 필수값·URL 검증, 동일 출처·요청량 제한 |
| 학식 | `/api/crawl-data/cafeteria-menu.json`, 기존 만나의집 메뉴 경로 | 실제 주간 snapshot·한국 시각·주말/휴일·stale 판정, `restaurant=manna` 직접 진입 및 식당 선택 URL 복귀 |
| 셔틀 | 기존 일정·특별 운행·공휴일 데이터와 `/api/bus/shuttle` | 실제 운행 예외·운행 기간·도착 예측·stale 표시·폴링, 노선별 펼침 독립, 원본 `lastUpdated`를 하단에 표시 |
| 대중교통 | `/api/bus/public-transit` | 4개 선택 정류장, 실제 도착순 정렬·10초 폴링·오류 재시도·열린 노선 상세 갱신, `tab`/`stop` 직접 진입·복귀 |
| 도서관 | `/api/library/reading-rooms` | 실제 좌석·운영 상태·열람실·좌석 지도·수집/오류 표시 유지 |
| 지도 | Kakao SDK + 기존 건물·시설 데이터 | 실제 SDK 로드·이동·마커·InfoWindow·시설 선택·정리 동작 유지; preview 지도 stub 미사용 |
| 룸메이트 | 기존 `/api/roommates/auth/*`, `/api/roommates/posts/*` | 학교 이메일 인증, 쿠키 세션, next 복귀, 필터·선택지·폼 검증·쓰기 제한·신고·본인 글 권한 유지 |
| 일정 잡기 | 기존 `/api/meet/rooms`, `/api/meet/rooms/[roomId]`, 참여 응답 경로 | 날짜 범위·15/30/60분 선택·응답 마감·초대 링크 보호·참여자 수정 토큰·작성자 삭제 토큰 유지; 삭제는 M3 확인 모달 이후 실행 |
| 관리자 | 기존 `/api/admin/submissions*`, `/api/admin/roommate-*` | Firebase ID token과 ADMIN_UIDS 검사, 기존 상태·신고·숨김·복구·삭제·낙관적 버전 검사 유지 |

## 운영 환경이 필요한 검증

- 문의·제보·일정 도구의 실제 저장: `FIREBASE_SERVICE_ACCOUNT`, 운영 Firestore 권한 및 `RATE_LIMIT_SECRET` 설정이 필요하다. UI 테스트에서는 fetch를 mock하여 실제 문서·메일·사용자 데이터를 만들지 않는다.
- 관리자 실제 로그인·조회·변경: 기존 `NEXT_PUBLIC_FIREBASE_*` 구성, 정상 Firebase 계정, `ADMIN_UIDS` 허용 목록이 필요하다. UI 변경으로 권한 우회나 가짜 관리자 세션을 만들지 않았다.
  - Firebase 시작 실패는 페이지 전체의 500 대신 기존 세션 확인 실패·재시도 화면으로 복구한다. 인증 객체가 없으면 로그인·로그아웃을 실행하지 않으며, 인증 전 관리자 API 조회도 하지 않는다.
- 룸메이트 실제 인증·메일·쓰기: 기존 Firebase 구성 및 `ROOMMATES_ENABLED`, `ROOMMATES_WRITES_ENABLED`, `ROOMMATES_EMAIL_ENABLED`, `ROOMMATES_OWNER_KEY_SECRET`에 따른 원래 제한을 유지한다. 인증 메일 발송과 실제 사용자 계정·글 변경은 별도 운영 검증 항목이다.
- 실제 Kakao 지도: `NEXT_PUBLIC_KAKAO_MAP_KEY`와 허용 도메인이 필요하다. SDK 모의 테스트는 마커·이벤트 수명을 검증하며, 실제 지도 타일·도메인 승인 증거는 아니다.
- 실제 대중교통: 기존 `PUBLIC_DATA_SERVICE_KEY` 및 외부 제공자의 가용성이 필요하다. 셔틀·도서관 등 외부 데이터는 수집 성공·오래된 데이터·오류 상태를 구분해야 한다.
- 알림/개인정보 설정은 기존 브라우저 알림 권한과 FCM 경로를 유지한다. 실제 기기 권한·토큰 저장·푸시 수신은 UI 단위 테스트만으로 확인되지 않는다.

환경 파일과 비밀값은 이식 작업에서 복사하지 않았다. 소스가 실제 API를 호출한다는 사실, mock 기반 회귀 테스트 통과, 운영 API의 실제 성공·인증·저장·메일/푸시 수신은 각각 별도의 검증 근거다.

## 실제 브라우저에서 확인한 흐름

로컬 Next.js 개발 서버에서 실제 서비스 컴포넌트와 실제 공개 데이터를 사용했다. 전체 37개 페이지 검증과 별도로 아래 흐름을 집중 확인했다.

- 2560×1465 데스크톱 문의: 원래 5개 문의 유형, 48px 선택 항목·닫기 버튼, 필수값 오류의 첫 필드 초점, 오류 안내가 나타난 뒤 2열 배치 유지. 오류 안내가 첫 그리드 칸을 차지하던 문제는 전체 열을 차지하도록 수정했다.
- 390×844 모바일 문의: 폼 폭 316px, 선택 메뉴 폭 314px, 모든 선택 항목 높이 48px, 가로 넘침 없음, 모달 본문 내부 스크롤. 선택창에서 Escape는 선택창만 닫고 폼을 유지한다.
- 모바일 학식 `?restaurant=manna` 직접 진입과 SU-Lounge 전환: 표시 식당과 URL이 함께 바뀌며 실제 식단·출처를 표시한다.
- 영문 공지 2→3페이지: 실제 목록과 `3 / 317`, canonical `?page=3`이 함께 갱신됐다. 브라우저의 `/api/announcements` 중복 요청은 0회였다.
- 같은 공지 화면에서 `장학` 입력: 검색어 URL·1페이지 초기화·기본 canonical·`noindex, follow`가 함께 갱신되고 검색창 초점을 유지했다. 초기화 시 `index, follow`로 복구됐다.
- Firebase 환경이 없는 관리자 화면: 정상 페이지 안에 세션 확인 실패·48px 재시도 버튼을 표시하고 가로 넘침 없이 복구했다. 인증 전 관리자 API 요청은 0회였다.
- 대중교통은 환경 없는 로컬에서 외부 API 오류 상태를 표시했다. 정류장 복귀·폴링·노선 갱신 회귀 테스트와 실제 제공자 API 성공 확인은 구분한다.
