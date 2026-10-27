# M3 실제 서비스 구현과 검증

이 문서는 최초 서비스 전환 시점의 검증 기록이다. 이후 Select·로고·열람실·홈·상태 문구는 [후속 기록](M3_UI_STATUS_FOLLOWUP_2026-10-26.md), 현행 컴포넌트는 [UI 가이드](UI_DESIGN_GUIDE.md)를 따른다. 예를 들어 현재는 채움실 제외 7개 열람실이며 국가/언어와 페이지 이동에도 M3Select를 사용한다. 초기 수치·시점 설명을 현행 상태로 승계하지 않는다.

2026-10-26 기준. `codex/m3-service-implementation` 작업 트리에서 기존 Next.js 서비스에 M3 구성을 적용했다. 기준 커밋은 `e39cbb22b8d0da649a5ed75d35b7d19dcf140460`이며 원래 체크아웃의 미커밋 변경은 건드리지 않았다. 시안의 fixture·페이지 레지스트리·고정 시각·API/지도 stub은 운영 코드에 포함하지 않았다. 셔틀 원본 서버 오류는 사용자 설명에 따라 이번 UI 개편에서 조회 방식을 재작성하지 않고 기존 로직을 유지한다. 정상 실시간 위치 수신을 검증했다는 뜻은 아니다.

현재 검토 주소는 `http://127.0.0.1:4180`이다. 이는 로컬 최적화 빌드이며 운영 배포가 아니다.

## 적용 범위

공통 헤더·hover/키보드 하위 메뉴·반응형 하단 탐색·푸터·돋보기 검색 대화상자·검색 결과 복귀를 적용했다. 일반 액션과 아이콘의 48px 목표, 역할별 상태·키보드 초점·오류 안내를 정리했다. 기존 버튼의 중복 상태 스타일을 제거하고 M3 토큰을 공통 기준으로 사용한다. 문의 유형·시간표 학과에만 shadcn 기반 Base UI Select를 사용하며 신규 의존성은 승인한 `@base-ui/react@1.9.0` 하나다. Motion은 추가하지 않았다.

홈은 실제 서버 데이터로 학식·일정·버스를 표시한다. 선택한 교통 정보만 갱신하며 데이터 갱신·오래됨·실패·준비 중을 구별한다. 공지는 원문 이동을 보존하고 AI 요약·기한·할 일을 목록 안에서 제공한다. 시간표는 기존 검색 조건과 최대 4개 비교안·초안·공유를 유지하면서 모바일 요일 보기와 전체 강의 인쇄를 제공한다. 졸업요건의 종속 선택지·진도·검증·초기화 조건을 유지하고 취소·승인·포커스 복귀를 M3 확인창으로 처리한다.

문의·꿀팁의 기존 payload와 검증, 룸메이트·관리자·일정 방의 기존 인증·소유자 토큰·서버 쓰기 제한은 유지했다. 공지 URL 탐색은 Next Router를 사용해 페이지·검색·초점·브라우저 뒤로가기와 메타데이터를 함께 갱신한다. 서버가 판단한 룸메이트 공개 여부를 가벼운 컨텍스트로 전달하여 SSR과 브라우저 메뉴·검색의 조건이 같게 했다.

알림 초기화와 홈 선택 복원은 저장소 접근이 차단되어도 화면을 중단시키지 않는다. 개발·미리보기·localhost 분석 트래픽은 전송하지 않고 운영 도메인의 기존 개인정보 제한을 유지한다. 인쇄에서 전역 탐색·푸터·알림 안내를 제외했다. A 로고를 헤더·웹/PWA·TWA 아이콘에 연결하고 새 PNG URL로 기존 장기 캐시와의 충돌을 피했다.

## 전체 검사

최종 `npm run check`가 exit 0으로 완료되었다. Windows 실행에서는 Vitest가 지원하는 `VITEST_MAX_WORKERS=1`을 지정했고, 저장소 `requirements.txt`의 기존 Python 패키지를 무시되는 `.cache/python-check-deps`에 설치하여 `PYTHONPATH`로 지정했다. 검사 항목과 assertions·시간 제한은 변경하지 않았다.

| 검사 | 결과 |
| --- | --- |
| ESLint, 전체 TypeScript, i18n | 통과 |
| PWA/TWA 매니페스트·아이콘·Digital Asset Links 정적 검사 | 통과 |
| 미사용 코드 검사 | 통과 |
| Python 24개 스크립트·크롤러 경계·공휴일 검사 | 통과 |
| 졸업요건·교육과정·crawl-data dry-run | 통과 |
| 단위·회귀 테스트 | 164개 파일, 1,452개 통과 |
| 최적화 Next.js 빌드 | 통과 |
| `git diff --check` | 통과 |

실제 환경 추가 검증: 도서관 8개 현황·마지막 roomNo 13 실제 좌석도표·모달 복귀, 빈 관리자 로그인폼, 홈 날씨·대중교통의 실제 데이터 표시가 390/1440px에서 성공했다. 비읽기 요청·가로 넘침·브라우저 오류는 각각 0개였다. 지도 시설 검색·패널은 정상이며, SDK는 같은 키로 localhost Referer에서는 401 JSON, 실제 서비스 Referer에서는 200 JavaScript였다. 로컬 허용 Web 도메인 설정과 제품 코드 연결을 구분하며, 키·계정·도메인 등록은 바꾸지 않았다.

교육과정 검사는 저장소에 없는 요람 원본 PDF 3개의 해시 비교를 기존 동작에 따라 건너뛰었다. 이는 그 PDF 원문을 다시 검증했다는 뜻이 아니다. 초기 병렬 테스트의 시간 초과와 구현 도중 실행한 중간 실패를 최종 통과 결과와 구분한다.

## 37개 페이지의 화면 검증

최적화 운영 모드에서 1440px·390px로 37개 경로, 총 74개 화면을 순회했다. HTTP 200은 74개, 가로 넘침과 처리되지 않은 브라우저 오류는 0개였다. 표시된 버튼 432개 중 달력 격자를 제외한 48px 미만 목표는 없었다. 768px에서는 별도로 하단 탐색과 Select를 확인했다.

| 구역 | 검사한 페이지 |
| --- | --- |
| 홈·공지 3개 | `/`, `/announcements`, `/announcements/[category]/[id]` |
| 학사 8개 | `/academic`, `/academic/announcements`, `/academic/scholarship`, `/academic/sw-notices`, `/academic/schedule`, `/academic/competitions`, `/academic/timetable`, `/academic/graduation` |
| 캠퍼스 11개 | `/campus`, `/campus/announcements`, `/campus/cafeteria`, `/campus/bus-info`, `/campus/library`, `/campus/map`, `/campus/phone`, `/campus/gym`, `/campus/health-center`, `/campus/campus-tips`, `/campus/campus-tips/suggest` |
| 룸메이트 6개 | `/campus/roommates`, `/campus/roommates/[postId]`, `/campus/roommates/new`, `/campus/roommates/me`, `/campus/roommates/verify`, `/campus/roommates/verify/finish` |
| 더보기·정책·관리 9개 | `/more`, `/more/meet`, `/more/meet/[roomId]`, `/more/privacy`, `/service/notices`, `/service/notices/[slug]`, `/terms`, `/privacy`, `/admin` |

환경값이 없는 룸메이트의 비활성 상태, 관리자 초기화 실패·재시도, 유효 데이터가 없는 일정 방의 오류 상태도 포함한 화면 검증이다. 이 74개를 로그인·게시·외부 데이터의 정상 성공 74개로 해석하지 않는다. 먼저 환경 없는 오류 복구와 격리 테스트 데이터를 검증한 뒤, 승인된 환경의 실제 강의 API로 1,526과목과 모든 선택지·결합 검색·3과목 추가·최대 4개 비교·안/과목 삭제·조건 보존을 390/1440px에서 다시 검증했다. 실제 과목으로 인쇄한 PDF도 각각 1페이지였다.

상호작용 검증에서는 hover·ArrowDown·Escape, 900px 경계를 넘는 탐색 초점 이동, 검색창 자동 초점·닫기 복귀, 서비스 결과→기능→검색 결과 초점 복귀, 문의 Select의 5개 선택지·화면 내 배치·부모 모달 유지, 학식·정류장 URL 복귀, 공지 페이지·검색·초기화의 canonical/robots·중복 API 0회를 확인했다. 모바일·데스크톱 인쇄 PDF는 각각 1페이지이며 모든 선택 강의가 포함된다.

## API 연결과 남은 환경 검증

운영 UI는 기존 `app/api`와 서버 데이터 모듈을 호출한다. HTTP API·서버 인증·출처·요청 제한 모듈은 기준 커밋 대비 변경하지 않았다. 환경값 없는 오류 복구 검증 후, 사용자가 승인한 원본 .env.local을 복사·출력하지 않고 로컬 프로세스에서 읽어 실제 성공 응답도 검사했다. Sentry 업로드 토큰을 제거하고 로컬 실행 환경으로 제한하여 테스트가 운영 릴리스·원격 오류 이벤트를 만들지 않게 했다.

| 실제 읽기 검사 | 결과와 의미 |
| --- | --- |
| 공지 목록·공지 요약·공모전·수집 상태·서비스 공지 | 200, 실제 기존 응답 구조 확인 |
| 학식 수집 데이터 | 200, `X-Crawl-Data-Source: github-pages` 확인 |
| 날씨·대중교통·도서관 | 기존 환경을 사용한 실제 200 응답 확인 |
| 셔틀 위치 | 로컬·기존 운영 API는 502, 정상 원본 페이지 실행에서 403 확인. 사용자가 bus.html 서버측 기존 오류로 설명하여 기존 조회 로직·타임아웃·캐시·재시도·오류 복구를 유지 |
| 강의 시간표 | 기존 환경에서 200, 실제 2026년 2학기 정규 1,526과목·37학과·학년 1~6·이수구분 9종 확인 |
| 룸메이트 세션·글·내 글 | 503, 기능·환경 제한 유지 |
| 관리자 3개 읽기 API | 미인증 401, 관리자 데이터 요청 전 권한 제한 유지 |
| SW | 기존 Firebase 공개 구성에서 200. 실제 푸시 등록·발송은 실행하지 않음 |
| 만나의 집 공개 JSON | 문서의 검증된 공개 주소를 로컬 프로세스에만 설정. 실제 200·days 10개, 390/1440px 화면·선택·오류/넘침/쓰기 0 확인. 이번 주 자료가 아직 없어 지난 식단을 현재 주로 표시하지 않는 원본 조건 유지 |

외부 API 성공 검증에는 기존 `PUBLIC_DATA_SERVICE_KEY`, KMA/셔틀/도서관/강의 URL, 만나 식단 URL, Kakao 공개 키와 허용 도메인, Firebase 공개 구성·서버 서비스 계정, 기존 룸메이트 기능 플래그가 필요하다. 값이나 비밀을 새로 만들거나 임의 URL로 대체하지 않았다. 환경 파일 복사는 자동 승인 검토에서 비밀값 중복 저장을 이유로 거부되었다. 이후 사용자가 원본 환경을 로컬에서 읽는 방식으로 검증하도록 승인했다. 작업 트리에 .env.local이 생성되지 않았고, 브라우저 JS에서 비교한 서버 비밀값 4개의 노출 일치는 없었다. 원본 로컬 환경에는 SHUTTLE_PAGE_URL·SHUTTLE_CHALLENGE_SALT·NEXT_PUBLIC_CAFETERIA_JSON_URL이 비어 있어 별도로 조사했다. 셔틀은 원본 페이지·공개 script에서 현재 challenge 조합을 확인하지 못했고, 정상 페이지 실행의 원본 403에서 즉시 중단했다. 사용자는 bus.html의 기존 서버측 오류이며 기존 로직을 유지하면 추후 조회될 것으로 설명했다. 이에 API·설정·프로토콜을 임의 변경하지 않고 기존 오류·재시도 경로를 보존했다. 만나 공개 JSON은 문서와 실제 200 응답으로 검증한 뒤 로컬 실행기에만 설정했으며 원본 환경파일이나 운영 설정은 변경하지 않았다.

실제 문의 메일·인증 메일·푸시 발송, 운영 Firestore 쓰기·삭제, 실제 계정 전환·룸메이트 게시, Kakao 로컬 도메인 등록, 실기기 설치는 실행하지 않았다. 사용자가 승인한 실제 환경 검증의 범위는 읽기 전용이다. 이 항목의 단위 테스트나 화면 오류 복구 통과를 실제 접수·저장·수신 성공으로 대신하지 않는다. API별 연결 표는 [캠퍼스·문의 API 기록](m3-campus-api-integration.md), [학사 API 기록](M3_ACADEMIC_API_MAPPING.md)에 있다.

## SEO와 성능

Googlebot 요청의 초기 HTML에서 제목·본문과 구조화 데이터를 확인했다. 공지 2페이지는 해당 `?page=2`로 self-canonical/hreflang을 제공한다. 홈·목록 검색은 `noindex, follow`와 기본 경로 canonical, 개인·관리 화면은 기존 noindex 제한을 유지한다. sitemap·robots는 200, 없는 경로는 404, 기존 별칭은 308이었다.

운영 JS/CSS 전체에서 알려진 시안 fixture·어댑터·4179 주소는 발견되지 않았다. 측정 시점의 공통 CSS 청크는 원본 189,962바이트, gzip 계산값 29,990바이트다. 로컬 홈의 콜드 로드 6회에서 script initiator 요청의 부분합은 약 313KB 전송·977KB 해제 크기였다. preload/link를 포함한 별도 단일 trace의 전체 JS resource 합은 약 362KB 전송·1.13MB 해제 크기였으므로 앞의 부분합을 전체 JS 크기로 해석하지 않는다. 모바일 390px·CPU 4배·150ms/1.6Mbps에서 FCP 1.33~1.56초, LCP 1.51~1.92초, CLS 약 0.00049였다. 데스크톱 3회 LCP는 0.18~0.21초였다.

이는 환경값 없는 로컬 측정이며 실제 사용자 p75나 운영 Core Web Vitals를 증명하지 않는다. 측정 스크립트의 `tbt`는 관찰 구간 전체 long-task 초과분 합계로, 정식 Lighthouse TBT·INP가 아니다. 모바일 초기 JS 작업의 긴 점유도 기록되어 추가 원인 확인과 운영 기기 측정 대상으로 남긴다. 모달의 첫 마운트와 이미지 저장용 격자의 동적 생성은 유지한다. 첫 화면에서도 Base UI를 포함한 공유 JS 청크가 다운로드·파싱되었으므로 Select가 초기 네트워크에서 완전히 빠졌다고 주장하지 않는다. 단일 trace에서 주요 후보는 원래와 해시가 같은 폰트 subset 16개 완료 후의 반복 Layout, 공통 Next/React/Sentry 번들 평가였다. M3 홈 자체의 평가는 약 2ms였지만 이를 정식 전후 회귀 비교로 일반화하지 않는다. 자세한 근거는 output/playwright/m3-service/performance-attribution.md에 있다.

## 증거와 적용 경계

재현 자료는 작업 트리의 `output/playwright/m3-service/`에 있다. `inventory.json`과 74개 PNG는 승인된 원본 환경을 읽은 최적화 운영 모드 결과다. `inventory-without-env.json`은 환경 없는 운영 모드, `dev-inventory.json`은 초기 개발 모드 결과다. `http-check.json`은 승인 환경, `http-check-without-env.json`은 환경 없는 초기 결과다. `bundle-check.json`, `performance.json`, `academic-results.json`, `academic-print-check.json`, `home-shell-qa.md`가 각 근거를 보관한다. 이 폴더는 저장소 정책에 따라 Git에서 제외된다.

소스는 별도 작업 트리의 브랜치에 있으며 merge·push·배포는 하지 않았다. 웹/PWA 자산 및 TWA 소스 동기화는 [브랜딩 기록](M3_TWA_BRANDING_SYNC.md)에 있다. Android APK/AAB 빌드·서명·설치·스토어 공개는 실행하지 않았다. 성공 응답이 확인된 실제 API 검증과 제공자 설정·쓰기·배포 검증을 구분한다. UI 구현·API 연결 보존·로컬 검증은 완료했고, 셔틀 원본 오류는 사용자 설명에 따라 기존 로직을 유지하는 것으로 범위를 확정했다. 실제 API 환경은 읽기 전용으로 사용했으며 운영 적용은 하지 않았다.
