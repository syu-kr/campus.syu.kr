# 2026-10-27 출시·Firebase 전환 실행표

점검 예정 시간은 **2026-10-27 16:00–17:00 KST**다. 17시는 예정 종료이며, 실제 완료를 확인한 뒤 관리자가 점검 배너를 내린다. 이 문서는 준비와 판정 기준이다. PR 병합, Production 배포, 활성 데이터 전환, Actions 실행, GitHub Pages 종료를 실행했다는 기록이 아니다.

조사 시작 기준 소스는 `924f773c355c051c8cd890ae8b806e7d82aede25`다. 이후 점검 배너·디자인·보안 보완의 최종 후보와 증거는 [현재 출시 준비 판정](RELEASE_READINESS_2026-10-27.md)에 연결했다. [앞선 준비 결과](PRE_RELEASE_PROGRESS_2026-10-27.md), [출시 체크리스트](RELEASE_CHECKLIST_2026-10-26.md), [공개 데이터 운영 계약](PUBLIC_DATA_FIREBASE.md), [서비스 공지 이전 계약](SERVICE_NOTICE_MIGRATION.md)을 함께 사용한다.

## 1. 현재 판정

| 항목 | 확보한 근거 | 아직 완료로 볼 수 없는 부분 |
| --- | --- | --- |
| 후보 PR | #271은 Draft·미병합. 조사 당시 head `924f773`, main/base `7021df7`, Actions 4개와 별도 CodeQL 보안 결과까지 5개 성공 | 이번 추가 변경을 포함한 최종 head 검사와 병합 시점 최신 main 재확인 |
| 공개 데이터 초기 복사 | 15:07 `--verify`에서 Firebase 23파일 성공. 활성본 `firebase-migration-20261026`, revision 3. 최신 Pages `20261026235322659-40422689760.1`의 일일 9파일과 나머지 Firebase 14파일을 보존하는 23파일·11,450,989B staging dry-run 성공. sourceHealth 9개 일치, 양쪽 포인터 변경 0 | 활성본은 아직 최신 일일 9파일과 다름. 출시 직전 다시 대조하고 승인된 최신본을 실제 활성화해야 함 |
| 서비스 공지 | 원문 19개·검수 영문 18개 이전·로컬 DB 단독 대조. 15:08 새 빌드의 `database` 모드에서 KO/EN 목록·019 상세 4 GET 200, lang/canonical/article language 확인. importer 재검증에서 source 19·unchanged 19·원래 게시 시각 19 보존, create/enrich/conflict 0 | Production의 `SERVICE_NOTICES_SOURCE=database` 전환과 공개 목록·상세·SEO·게시 중단 검증 |
| 번역 TTL | 10월 27일 14:54 KST에 세 그룹의 `expires_at` GET 200, 모두 `ACTIVE`, 추가 지연 0초 | 실제 만료 삭제 지연·삭제 건수·청구량은 출시 후 관찰. 즉시 삭제를 기대하지 않음 |
| 버킷 접근 | 14:54 조회에서 버킷 IAM의 공개 역할 0, Firebase Storage 규칙은 직접 `read, write` 거부 | Vercel과 Actions 각각의 실제 자격으로 읽기·필요한 쓰기 성공 여부. 규칙 거부는 서버 Admin SDK 접근 실패를 뜻하지 않음 |
| 점검 이미지 | 상위 작업의 15:01 로컬 검증: 576×360 WebP 62,320B, HTTP 200·저장 해시 일치·조건부 304 | Production 도메인에서 이미지 노출 및 캐시 확인 |
| 실제 번역 | 승인한 공개 배너 3필드의 Google 응답 200, 첫 요청 약 1,046ms·반복 약 189ms. 신규 예약 186문자, 반복 추가 예약 0. 날짜·시간 보존 | 모든 학사 용어의 정확성, 새 Production 배포의 키 반영, 실사용 동시성·비용 |
| 번역 저장 | 15:20에 세 컬렉션 전체 220문서(필드 216·기존 요청 캐시 2·사용량 2)의 메타데이터를 조회해 Timestamp 220개, 누락·형식 오류·숫자 만료 불일치 0 확인 | 조회 당시 만료 문서는 0개. TTL이 실제 삭제한 것을 증명하는 결과와 구분 |
| Google 할당량 | 현재 콘솔에서 Cloud Translation API enabled, `v2 and v3 general model characters per day` 50,000자, 표시 사용량 16,494자(32.99%) 확인. 앱 기본 예산은 25,000자/UTC | 서버 계정의 quota 메타데이터 조회는 403이지만 콘솔 조회로 현재 설정 확인. 표시 사용량은 갱신 시점에 따라 달라지며 앱 예산과 직접 비교하지 않음. 이 읽기 권한을 없애기 위한 IAM 확대는 필요하지 않음 |
| Actions 설정 | 변수 이름 조회에서 `PUBLIC_DATA_BACKEND`, `PUBLIC_DATA_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` 없음. 기존 `FIREBASE_SERVICE_ACCOUNT` secret 이름 존재 | 이름 존재는 대상 프로젝트·버킷·쓰기 권한 증명이 아님. 실제 값 출력 없이 대상 일치 확인 필요 |
| GitHub Pages | 현재 `build_type=workflow`, HTTPS 강제 설정 유지 | Firebase 정상 수집·발행과 구주소 의존 해소 전 종료하지 않음 |
| 점검 배너 | 사용자 승인 문구·이미지를 사용한 새 관리 배너 1개 등록, 기존 콘텐츠 변경 0. 현재 운영 `/api/banners`는 404여서 기존 앱에 먼저 표시되지 않음. 로컬 초기 조회 복구 보완 및 최종 첫 HTML의 배너 포함 확인 | 새 앱 배포 성공 뒤 Production cold 요청·API 실패 복구·표시 확인 |

TTL은 비동기 삭제다. 만료 문서가 잠시 조회되는 것만으로 실패라고 판정하지 않으며, 애플리케이션의 만료 검사가 먼저 적용되어야 한다. 통상 만료 후 24시간 안에 삭제되지만 보장된 즉시 삭제는 아니다. [Firebase TTL 동작](https://firebase.google.com/docs/firestore/ttl)

Google의 일일 할당량은 Pacific Time 자정, 이 앱의 사용량 예약은 UTC 날짜 기준이다. 두 숫자와 날짜 경계는 동일하지 않다. 공급자 할당량 설정은 비용 청구 상한 보장이나 앱 캐시 성공을 대신하지 않는다. [Cloud Translation 할당량](https://docs.cloud.google.com/translate/quotas)

## 2. 배포 전 남은 작업 전체 목록

| 우선순위 | 작업 | 완료 기준 |
| --- | --- | --- |
| P0 | 최종 변경 통합 | 점검 배너 화면·디자인/접근성·보안 보완과 아래 알림 workflow 수정까지 하나의 후보로 확정. 선택지·검색 조건·검증·목록 복귀·브라우저 저장 계약 유지 |
| P0 | 최종 검사 | 최종 head의 lint·타입·관련 회귀·빌드 및 원격 필수 검사 4개+별도 CodeQL 결과 성공. 이전 head 성공을 재사용하지 않음 |
| P0 | 출시 대상 확인 | PR source SHA, 병합될 최신 main, mirror commit, Vercel project·Production domain·Node 24를 연결해 기록 |
| P0 | 복구 기준선 보관 | 이전 정상 deployment/source SHA, 환경 설정 이름과 복구값의 안전한 보관 위치, Firebase 활성 version/revision·보존 버전, 공지 이전 백업을 확인. 비밀값/초안 백업 공개 금지 |
| P0 | 환경 등록·권한 확인 | Vercel Production의 서비스 계정·관리자 UID·요청 제한 비밀·번역 키·버킷, Actions의 backend/버킷 변수·기존 서비스 계정 대상을 대조. Preview에 운영 계정을 복사하지 않음 |
| P0 | 최신 공개 자료 반영 | 두 저장소 current manifest를 다시 읽고 최신 일일 9파일을 검증. 참조 13개·만나의집 1개의 최신성과 보존 범위를 대조하고 CAS를 사용해 활성화. 다른 작업의 변경이 있으면 재계획 |
| P0 | 생산자 전환 | 새 main의 일일·만나의집·참조 발행·롤백·IndexNow·일일 알림이 동일 Firebase backend/버킷을 사용. Pages writer와 무기한 이중 발행하지 않음 |
| P0 | 소비자 전환 | `PUBLIC_DATA_BACKEND=firebase`를 Vercel build/runtime 양쪽에 적용한 새 배포. `/data/*`, 만나의집 호환 주소, API의 출처·버전 확인 |
| P0 | 공지 DB 단독 전환 | `SERVICE_NOTICES_SOURCE=database`에서 19개 원문·18개 검수 영문, 번호·날짜·작성자·요약·본문·언어·링크·404·비게시 상태를 대조 |
| P0 | 점검 배너 | 날짜·시간·이미지·대체 텍스트·한국어/영어·모바일 줄바꿈 확인. 17시 자동 숨김 대신 완료 후 게시 중단. 관리자/민감 페이지의 기존 비노출 정책 유지 |
| P1 | 성능 | 최종 로컬 표본과 측정 조건은 현재 준비 판정 참조. Production의 cold/warm 응답·LCP·INP를 재측정. 과거 홈 cold 약 5초 관측과 새 표본 TTFB는 동일 지표로 치환하지 않음. 응답 크기 감소도 사용자 LCP/INP 통과를 뜻하지 않음 |
| P1 | 데이터·번역 품질 | 학사 고유명사·졸업 수치·시간·요일·링크, 셔틀 공급자 장애와 정적 시간표, 기존 미검수 졸업 선택지 표시를 확인 |
| 수동 | 실기기·접근성 | iOS Safari·Android·Firefox, 한글 IME/가상 키보드, 스크린리더, OS 확대, 설치 PWA/TWA의 업데이트·공유·복귀 확인 |
| 수동 | 운영 도메인 연동 | Kakao 허용 도메인·쿠키/CSP, Firebase 로그인, 관리자 접근, 문의/제안 접수, 공유, 테스트 알림 수신을 정해진 테스트 대상으로 확인 |
| 수동 | 공개 자료·자산 | 공지/전화번호/이미지/요람 데이터의 재배포 근거·삭제 요청 처리, 공개 저장소의 불필요 파일·이전 설치 앱 자산 호환성 확인 |
| 후속 | Pages 종료·파일 정리 | 아래 종료 조건을 충족한 다음 Pages 배포 단계/권한과 구주소 의존을 제거. 공지 MD·JSON fallback·과거 Storage 객체를 한꺼번에 삭제하지 않음 |
| 출시 후 | 관측·운영 | 다음 수집·참조 발행·알림 주기, 번역 429/캐시/사용량, TTL 삭제·비용, Sentry 수신, 실제 CWV를 관찰 |

### 이번 조사에서 보완한 알림 경로

`scripts/send-daily-notification.ts:4,51`은 공용 `readDailyCrawlDataJson`을 사용하지만, 일일 알림 workflow가 backend·버킷 변수를 넘기지 않았다. 따라서 앱과 크롤러를 Firebase로 전환해도 알림 집계는 기본 Pages를 계속 읽는 문제가 있었다.

`.github/workflows/daily-announcement-notification.yml`의 기존 발송 단계에 `PUBLIC_DATA_BACKEND`, `PUBLIC_DATA_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` 세 변수만 연결했다. 발송 시각·조건·FCM 대상·dry-run·중복 방지·기존 비밀값은 변경하지 않았다. 같은 단계에 연결됐는지 확인하는 회귀를 `scripts/send-daily-notification.test.ts`에 추가했다. Node 24.22.1에서 알림·crawl reader·만나의집/IndexNow workflow 관련 **4파일 29테스트와 전체 TypeScript 검사**, 대상 ESLint와 `git diff --check`가 성공했다. 실제 workflow 실행·알림 발송은 하지 않았다.

## 3. 16:00–17:00 순차 진행안

시간표는 목표이며 성공을 가정한 강제 마감이 아니다. 앞 단계의 통과 조건이 충족되지 않으면 다음 전환을 진행하지 않는다. 배너 종료도 실제 완료를 기준으로 한다.

| 순서 | 작업 | 진행 조건과 증거 |
| --- | --- | --- |
| 0. 시작 전 | 최종 후보·배포 설정·복구 기준선 확인 | PR 최종 head 검사 성공, 최신 base와 리뷰 확인, 현재 자동 수집/발행 실행과 충돌 없음 |
| 1. 첫 출시 | 승인 후 main에 squash merge | 실제 병합 SHA 기록. Draft 해제·병합은 별도 출시 실행이며 이 문서 작성으로 수행하지 않음 |
| 2. 앱 배포 확인 | main CI → Sync to Vercel Repository → 개인 mirror → Vercel Production 순으로 확인 | 각 단계 완료와 source SHA 매핑, 실제 운영 `/indexnow-deployment.json` 확인. PR CI나 mirror push만으로 배포 성공 판정 금지 |
| 3. 점검 안내 확인 | 운영 홈과 대표 공개 페이지의 배너·이미지·시간 확인 | 기존 운영에는 배너 코드가 없으므로 **merge 순간이 아니라 새 배포가 실제 반영된 뒤** 나타남. 관리자/룸메이트·일정 방 등 기존 비노출 구간은 제외 |
| 4. 새 UI 기본 smoke | 한국어/영어 홈·공지·학식·버스·시간표·졸업·검색·관리자 읽기 | 이 첫 배포를 기본 `pages/hybrid`로 확인하면 UI 출시와 데이터 전환 장애를 구분하기 쉬움. 배포 설정을 미리 Firebase로 바꾸는 경우 5–6번을 먼저 완료해야 함 |
| 5. 활성 자료 최신화 | 출시 직전 Pages와 Firebase를 재대조하고 승인된 자료를 불변 버전으로 저장·검증·활성화 | 일일 9개와 나머지 14개 보존, schema/hash/size/sourceHealth 검증, 예상 current/revision 일치. 재실행은 no-op, 충돌은 중단 |
| 6. 생산자 설정 | 새 main에서 Actions의 `PUBLIC_DATA_BACKEND=firebase`와 검증된 버킷 설정 | 일일·만나의집·참조·롤백·IndexNow·알림이 같은 대상을 읽는지 확인. 전환 시점에 실행 중인 구 Pages writer와 새 writer를 겹치지 않게 확인 |
| 7. 소비자 설정·재배포 | Vercel `PUBLIC_DATA_BACKEND=firebase`, 검증된 버킷, `SERVICE_NOTICES_SOURCE=database` 반영 후 새 빌드·배포 | runtime 값 등록만으로 `/data/*` rewrite가 바뀌지 않음. Production build 환경·실제 응답까지 확인 |
| 8. Firebase 운영 smoke | 23개 파일, 공지, 배너, 번역, 공개 이미지, 선택/저장/복귀 확인 | HTTP 200뿐 아니라 `firebase-storage` 출처와 활성 version 확인. `bundled-fallback`은 연결 성공으로 계산하지 않음 |
| 9. 첫 자동화 확인 | 승인한 일일/만나의집 또는 무변경 검증 실행과 결과 확인 | scope 밖 해시 보존, 활성 version 변경 또는 정확한 no-op, Pages 발행 단계 미실행. AI/외부 호출·발송이 있는 작업은 범위를 확인하고 실행 |
| 10. 완료 판정 | 오류율·관리 기능·기본 서비스 정상 확인 후 배너 게시 중단 | 종료 시각만으로 완료 처리하지 않음. Pages는 정상 주기와 복구 근거가 확보될 때까지 보존 |

GitHub Actions는 수집·검토·발행을 실행하는 장소로 유지한다. Firebase로 바뀌는 것은 공개 콘텐츠의 저장·활성화·읽기 경로다. Vercel의 앱 호스팅, GitHub의 소스/검토 PR, 외부 원본 API, 브라우저의 개인 시간표·졸업 저장은 그대로 각 역할을 가진다.

## 4. 배포 후 테스트 목록

각 항목에 실제 source SHA·deployment·활성 data version·시각·환경·결과를 남긴다. 오류 화면이나 fallback이 정상 HTTP 200을 반환하는 경우도 있으므로 화면 내용과 출처를 함께 확인한다.

### 배포 직후: 앱·데이터·SEO

- [ ] 운영 도메인 TLS·리다이렉트·Production deployment·source SHA가 방금 출시한 버전과 일치한다.
- [ ] KO/EN의 `html lang`, canonical·hreflang, title·description, OG image URL/크기·실제 렌더, robots·sitemap 응답이 일치한다.
- [ ] 신규 공지는 사이트맵에 나오고 게시 중단 공지는 목록·홈·상세·사이트맵에서 사라진다. 비공개/관리/개인 상태 URL은 검색 대상이 아니다.
- [ ] `/api/public-data/current`의 version이 승인한 활성본이고, 23개 공개 파일의 출처·버전·내용이 대응한다.
- [ ] `/data/<file>.json`, `/cafeteria/student-restaurant-1.json`, `/api/crawl-data/<file>`의 호환 경로가 새 저장소를 읽는다.
- [ ] API ETag/304·캐시 후 갱신이 정상이고 이전 버전이 잠시 캐시된 경우와 영구 오설정을 구분한다. 앱 활성 캐시는 30초, 공개 응답은 60초+SWR 300초다.
- [ ] 19개 서비스 공지·18개 검수 영문을 DB 단독으로 읽고 원문 날짜·번호·작성자·링크·한국어/영어·페이지네이션·목록 복귀를 유지한다.
- [ ] 404·오류·로딩·빈 자료 상태에서 사용자에게 재시도/복귀가 보이고 내부 원인·계정·토큰·버킷 경로를 노출하지 않는다.

### 배포 직후: 37경로의 기능 그룹

기존 자동 목록은 37경로×KO/EN×데스크톱/모바일의 148뷰다. 아래는 같은 경로를 기능 단위로 묶은 운영 검사이며 자동 화면 성공이 실제 서비스 쓰기나 실기기 성공을 대신하지 않는다.

| 기능 그룹·대표 경로 | 확인할 동작 |
| --- | --- |
| 홈 `/`, 메뉴 `/academic`, `/campus`, `/more` | 날짜·현재 날씨, 학식/버스 요약, 메뉴 hover와 키보드, 활성 모션, 검색 열기/Escape/초점 복귀, 언어·국가 선택 |
| 통합 검색 `/announcements` 및 공지 상세 | 입력 도중 메뉴 제안, 검색 제출 후 공지, 우선순위·페이지·필터·뒤로가기 보존, 원문 이동과 인라인 AI 요약 |
| 공지 `/academic/announcements`, `/academic/scholarship`, `/academic/sw-notices`, `/campus/announcements` | 원래 분류·검색 조건·페이지 선택 Select, 빈 결과·외부 원문 링크·조회 실패 복구 |
| 공모전 `/academic/competitions` | 종류/분류 탭 모션, 검색·페이지네이션·선택 유지·원문 이동 |
| 일정 `/academic/schedule`, `/more/meet`, `/more/meet/[roomId]` | 날짜·공휴일, 방 생성·참여·수정·복귀, 삭제/없는 방 오류. 합성 방만 사용하고 정리 범위를 기록 |
| 시간표 `/academic/timetable` | 학과·학년·학기 등 기존 검색 선택지, 결과·중복 검증, 최대 4안 생성/비교, 새로고침 저장, 공유·이미지 내보내기·모바일 읽기 |
| 졸업 `/academic/graduation` | 입학연도·학과·원래 선택지, 검수/미검수 구분, 계산·선택 저장, 초기화 취소/Escape·확인·복귀 |
| 학식 `/campus/cafeteria` | SU-LOUNGE/만나의집 전환, 같은 주차/요일·재료·미운영 상태, 원본 갱신과 화면 갱신 일치 |
| 교통 `/campus/bus-info` | 셔틀 여러 노선의 다음 출발, 시간표 펼침, 업데이트 날짜, 실시간 오류와 정적 시간표 구분, 대중교통 선택·새로고침 |
| 도서관 `/campus/library` | 채움실·그 좌석 미노출 유지, 열람실 탭, 좌석·갱신·실패 상태. 남은 좌석을 보장 좌석으로 오인하게 하지 않음 |
| 지도/연락처 `/campus/map`, `/campus/phone` | Kakao 허용 도메인·쿠키/CSP, 검색·건물/시설 선택·전화 링크, 네트워크 실패 복구 |
| 생활 정보 `/campus/gym`, `/campus/health-center`, `/campus/campus-tips` | 시설 정보·꿀팁 카테고리와 모션, 링크·번역·내용 넘침 |
| 문의/제안 `/more/privacy`, `/campus/campus-tips/suggest` | 유형 Select·필수/길이/오류 연결, 중복 제출 방지·접수 결과·관리자에서 확인. 사용자 실제 개인정보 대신 명시한 테스트 내용 사용 |
| 룸메이트 6개 진입/상세/작성/내 글/인증/인증완료 경로 | 기존 비활성 상태 유지. 켜지 않은 기능을 이번 검증 때문에 켜지 않음. 별도 활성화 시 소유자 권한·학교 메일·로그아웃·차단·신고 검사 필요 |
| 서비스 공지 `/service/notices`, `/service/notices/[slug]` | DB 단독 목록·상세·번호·날짜·원문 언어·페이지 복귀·없는/중단 공지 상태 |
| 정책 `/terms`, `/privacy` | 고지·외부 링크·언어·목록 탐색·확대 상태, 개인정보 관련 문구가 실제 저장/보존 정책과 일치 |
| 관리자 `/admin` | 정상 UID 허용·비관리자 거부·로그아웃, 공지/배너 초안·미리보기·게시·중단·충돌·복구, 업로드 오류·조회 실패·확인 후 초점 복귀 |

### 배포 직후: 새 Firebase·번역 기능

- [ ] Production에서 공개 배너·이미지를 읽는다. 이미지의 content-type·실제 디코딩·대체 텍스트·크기·ETag/304를 확인한다.
- [ ] 관리자 테스트 이미지 1개를 허용된 경로로 업로드·조회하고 생성한 객체만 정리한다. 테스트 성공을 기존 이미지/공지 삭제로 만들지 않는다.
- [ ] 익명·잘못된 로그인·비허용 UID의 관리자 API는 각각 올바르게 거부된다. 관리자 UI가 숨겨진 것만으로 권한 검증 성공을 판정하지 않는다.
- [ ] draft 저장이 공개 본문을 바꾸지 않는다. 게시·수정 충돌·게시 중단이 예상 revision과 공개 cache에 반영된다.
- [ ] `/en` 첫 진입과 내부 이동에서 등록된 한글 공개 필드만 번역되고, 개인 입력·연락처 입력·시간표 이름·문의 본문은 공급자에 보내지 않는다.
- [ ] 같은 공개 문구 재조회에서 캐시가 재사용되고 사용량 예약이 늘지 않는다. 원문 변경 시 이전 문구의 번역이 잘못 재사용되지 않는다.
- [ ] 숫자·날짜·시간·학점·고유명사 표본을 확인한다. 번역 실패·일일 제한·오프라인에서 원문과 재시도·초점 복귀를 유지한다.
- [ ] 캐시·사용량 문서의 `expires_at`은 Timestamp다. 앱이 이미 만료된 값을 재사용하지 않는다. 시험 때문에 실제 한도를 소진하거나 캐시 전체를 삭제하지 않는다.

### 첫 정상 수집·발행 주기

- [ ] Daily Crawl의 Firebase restore·daily publish가 성공하며 선택 범위 9파일 외 14개 해시를 보존한다. 원본 일부 실패는 sourceHealth에 반영되고 정상본을 빈 데이터로 덮어쓰지 않는다.
- [ ] 만나의집 수집의 이미지 해시·검수 JSON·주차·재료 검증을 유지한다. Firebase 발행 성공/no-op 전에는 성공 캐시를 앞당겨 저장하지 않는다.
- [ ] 월간 전화번호·학사 일정은 검토 PR을 만든다. 승인된 최신 main CI 성공 후 reference 13파일을 발행하고 daily/만나의집을 보존한다.
- [ ] 동일 자료 재실행은 추가 업로드·새 활성 version을 만들지 않는다. 오래된 CI는 참조 자료를 과거로 되돌리지 않는다.
- [ ] IndexNow가 실제 운영 source SHA·Firebase version·응답 출처를 맞춘 뒤 변경 URL만 처리한다. 수신 성공과 검색 색인 반영은 별도다.
- [ ] 일일 알림 dry-run 집계가 Firebase 공지와 맞고 FCM·중복 잠금 소비·발송 기록 쓰기는 없다. 실제 테스트 발송은 승인된 테스트 구독에만 한다.
- [ ] 다음 정상 알림의 KST 날짜 경계·중복 방지·재시도 정책을 확인한다. 대량 발송을 검증 수단으로 사용하지 않는다.

현재 예정 주기는 일일 전체 20:17 KST, 학식 보완 05:17/10:17 KST, 만나의집 월요일 07:00/09:00 KST, 알림 평일 08:00 KST다. 월간 cron `0 15 1 * *`는 **매월 2일 00:00 KST**다. 이번 수정은 이 시각들을 바꾸지 않는다. Actions 예약은 정확한 실행 시각을 보장하지 않으므로 실제 실행 기록을 확인한다.

### 24시간 이후와 안정화 기간

- [ ] TTL 삭제 건수·만료→삭제 지연과 실제 문서 정리를 확인한다. 만료 24시간만으로 장애를 단정하거나 운영 문서를 수동 대량 삭제하지 않는다.
- [ ] Storage 저장량·다운로드/egress, Firestore read/write/delete, 번역 사용량·429·오류·재시도와 예산 알림을 확인한다.
- [ ] Sentry에서 실제 운영 오류 수신·source map·개인정보 제거를 확인하고, 사용자 흐름별 새 회귀를 분류한다.
- [ ] 실제 모바일/데스크톱 LCP·CLS·INP와 cold/warm 차이를 확인한다. 로컬 합성 측정으로 field CWV를 통과 처리하지 않는다.
- [ ] 설치 PWA/TWA·기존 열린 탭·푸시 click·이전 asset URL이 정상 복귀하고 브라우저 저장값이 유지된다.
- [ ] 정상 수집·발행과 복구 근거가 확보된 뒤 Pages 종료·원본 파일 정리 계획을 실행한다. 자동화 없이 남은 옛 Storage 객체와 참조 없는 이미지 정리는 별도 범위다.

## 5. Firebase로 모두 이전할 때 남는 일

### 저장소별 최종 역할

| 데이터/동작 | 목표 위치 | 남은 작업 |
| --- | --- | --- |
| 공지 6종·학식·AI·공휴일 9파일 | Storage 불변 snapshot + Firestore 활성 manifest | 최신 일일본 반영, Actions 변수와 첫 발행 검증 |
| 전화번호·일정·꿀팁·셔틀·졸업 참조 13파일 | 같은 snapshot, 검토한 Git 원본은 작성/검증 입력으로 유지 | 월간 PR→최신 main CI→reference 발행 실제 경로 확인 |
| 만나의집 1파일 | 같은 snapshot의 `student-restaurant` scope | 현재 자료·수집 성공 캐시·fallback·구주소 의존 해소 |
| 서비스 공지/검수 영문·배너 | Firestore `site_managed_content` | Production DB 단독 모드, 게시/중단/충돌·메타데이터 검증 |
| 배너 이미지 | 비공개 Storage 객체, 앱의 공개 미디어 API | 운영 업로드·읽기·권한 확인. 공개 클라이언트 쓰기를 열지 않음 |
| 공개 번역 캐시·예약 사용량 | Firestore 세 TTL 컬렉션 | 운영 키 반영·캐시·예산·만료 삭제 관찰 |
| 수집 성공 상태/IndexNow 제출 상태 | Actions cache/artifact | 공개 콘텐츠가 아니므로 Firebase 이전에 필수 아님. 기존 성공/no-op/복구 계약 유지 |
| 개인 시간표·졸업 설정 | 현재 브라우저 저장 | 사용자별 서버 저장 기능은 이번 이전에 포함하지 않음. 키/데이터 형식을 유지 |
| 날씨·실시간 버스·열람실·강의·지도 | 기존 공급자/API | snapshot으로 바꾸지 않음. 공급자 장애와 이전 장애를 구분 |
| 소스·i18n·정책/운영 문서·감사 원본·라이선스 | Git | 콘텐츠 DB로 옮기지 않음. 동작에 필요한 테스트 fixture·원본 증빙 유지 |
| 로고·앱 아이콘·폰트·고정 OG 등 앱 정적 자산 | 앱의 `public`/빌드 자산 | 편집 가능한 관리 배너 이미지와 구분. Pages 종료나 데이터 이전을 이유로 Firestore에 옮기거나 삭제하지 않음 |

### Pages를 먼저 끌 수 없는 구체적인 의존

| 위치 | 현재 남은 Pages 경로 | 종료 전 조치 |
| --- | --- | --- |
| `lib/server/crawl-data.ts:16,60` | 미설정 backend는 Pages manifest/파일을 읽음 | 앱과 모든 script 호출자의 Firebase 환경 연결 확인. 이번 일일 알림 env 누락 포함 |
| `scripts/publish-crawl-data.ts:26,424` | 기존 pull/prepare/rollback용 Pages CLI | 새 writer가 안정화되고 구 Pages 복구를 끝낸 후 제거 또는 명시적 legacy 도구로 격리 |
| `.github/workflows/crawl-daily.yml:153` | Pages 준비·upload·deploy 분기 | Firebase 첫 성공과 no-op 확인 뒤 구 배포 분기·pages/id-token 권한을 별도 변경으로 제거 |
| `.github/workflows/student-restaurant.yml:34,94` | Firebase 모드에서도 job에 `github-pages` environment 및 Pages 권한 선언이 남음 | Firebase 수집은 유지하고 Pages 전용 environment/권한/준비·배포 단계 정리. workflow 전체 삭제 금지 |
| `.github/workflows/rollback-crawl-data.yml:60` | backend 미설정 시 Pages 복구 | Firebase CAS rollback 경로를 유지하며 Pages 복구 제거 시점을 확정 |
| `scripts/indexnow.ts:16,133,146,158` | Firebase 분기 밖에 Pages manifest/만나의집 경로가 존재 | Actions backend/버킷 연결과 운영 source/version 검증 통과 후 legacy 분기 정리 |
| `app/features/cafeteria/useStudentRestaurantMenu.ts` | 후속 보완으로 Firebase 모드에서는 옛 URL 없이 홈·학식 상세가 같은 origin API를 읽음 | 코드 게이트는 해소됐다. Pages 모드와 Firebase 장애 fallback을 위해 현행 URL은 출시 중 보존하며 [최종 보완](PRE_DEPLOY_FIXES_2026-10-27.md)을 따른다 |
| `lib/server/public-data.ts:15` | 만나의집 번들 파일이 없으면 설정된 공개 URL을 fallback으로 요청 | Git에 만나의집 fallback 파일은 없음. 대체 복구 자료/명시적 오류 흐름을 마련한 뒤 Pages 의존 제거. 단순히 자기 API URL로 치환하면 순환 요청 방지 검사에 걸림 |
| `lib/server/content-translation-sources.ts` | 후속 보완으로 만나의집 화면·번역 원본이 공용 `readPublicDataJson` 경로로 통일됨 | 코드의 별도 URL 분기는 제거됐다. 공용 reader의 실제 fallback과 운영 버전 검증은 유지 |
| 공개 설정·구버전 앱/외부 사용자 | 빌드에 포함된 옛 식단 URL, 직접 공유한 Pages JSON 주소 | 기존 앱·설치 PWA·외부 소비자를 조사하고 유예/대체 주소 공지 후 종료. 소스 검색만으로 외부 사용 0을 단정하지 않음 |

### Pages 종료 순서

1. Firebase를 실제 서비스의 읽기·쓰기 기준으로 전환하고 첫 정상 자동 발행과 복구 근거를 확보한다. 이 시점에는 기존 Pages의 마지막 성공본을 보존한다.
2. Pages를 사용하는 모든 앱/script/env/설치 앱/외부 주소를 대조한다. 특히 만나의집 fallback과 일일 알림 집계가 중요하다.
3. 정상 수집 workflow를 유지한 채 Pages 전용 configure/upload/deploy 단계·environment 의존·권한·복구 분기를 좁게 제거하고 CI를 통과시킨다. GitHub Actions 자체를 없애지 않는다.
4. Firebase 장애를 fixture/검증 환경에서 재현해 유효 fallback 또는 의도한 오류·재시도 흐름을 확인한다. 잘못된 200 응답이나 옛 자료를 최신으로 표시하는 상태를 허용하지 않는다.
5. 승인한 종료 시점에 GitHub **Settings → Pages → Unpublish site**를 실행한다. 현재 저장소는 workflow 게시 방식이므로 branch 드롭다운 `None`만 가정하지 않는다.
6. 기존 Pages 주소가 더 이상 필요하지 않음을 확인하고 운영 앱·새 수집·IndexNow·알림이 영향을 받지 않는지 검사한다. 소스/백업/권리 고지를 함께 삭제하지 않는다.

Pages unpublish는 현재 배포를 내리지만 콘텐츠/설정을 모두 지우지는 않는다. 성공한 Pages 배포 workflow가 남아 있으면 다시 게시될 수 있으므로 writer 정리가 먼저다. [GitHub Pages 게시 중단](https://docs.github.com/en/pages/getting-started-with-github-pages/unpublishing-a-github-pages-site)

### MD·JSON과 버킷 객체 삭제는 별도 단계

- 서비스 공지 MD는 DB 단독 Production 대조·게시 중단·sitemap/OG·복구 확인 후 정리한다. importer와 credential 없는 CI/fixture/추적 입력도 함께 바꾸어야 한다.
- `public/data` JSON은 현재 장애 복구·생성·검증·졸업 계산 호환성에 쓰인다. Firebase가 주 저장소가 되어도 바로 쓸모없는 파일이 되는 것은 아니다. 웹 정적 원본을 없애려면 server-only fallback 위치와 file tracing·생산자·테스트·IndexNow를 함께 바꾸는 후속 작업이 필요하다.
- 공개 데이터의 논리적 보존 버전은 7개지만 옛 Storage 객체 자동 GC는 구현돼 있지 않다. 참조 없는 이미지도 자동 삭제 대상이라고 가정하지 않는다. 활성/복구/진행 중 업로드·옛 앱이 참조하지 않는 객체만 별도 정책으로 정리한다.
- 번역 TTL 세 정책은 번역 캐시/사용량 문서에만 적용된다. 공개 JSON·배너 이미지·공지·문의의 보존 정책을 대신하지 않는다.

## 6. 중단·복구 기준

| 증상 | 조치 | 재개 조건 |
| --- | --- | --- |
| main CI/Sync/Vercel 실패, source SHA 불일치 | 다음 단계 중단. 기존 정상 deployment 유지 | 원인을 해결하고 같은 후보의 실제 배포/응답 확인 |
| 23파일 누락·hash/schema 실패·current 경쟁 | 활성화 중단. 새 자료를 덮어써 맞추지 않음 | 최신 포인터로 dry-run부터 다시 대조 |
| 앱은 Firebase인데 Actions는 Pages, 또는 버킷 불일치 | 추가 발행/전환 중단. 어느 저장소가 최종 기준인지 확정 | 설정과 활성 version을 맞추고 첫 실제 읽기/쓰기 확인 |
| Firebase 읽기 실패 또는 예상 밖 fallback | 직전 정상 데이터 버전으로 CAS 복구 검토. 필요하면 이전 앱·backend 설정 복구 후 재배포 | 데이터 version·출처·표시 내용과 경로 rewrite의 일치 |
| DB 공지 누락/중단 항목 재노출 | `database`/`hybrid`·게시 상태·메타데이터 확인. 관리자 후속 편집을 원본으로 덮어쓰지 않음 | 19/18 대조와 중단/404·목록/사이트맵 검증 |
| 번역 장애/429 | 원문 유지, 예산/상태 확인. 무한 재시도·한도 확대·키 교체부터 하지 않음 | 공급자 및 앱 한도 범위에서 표본·캐시 검증 |
| 업로드/관리자 오류 | 공개 Storage 쓰기를 열지 않고 대상 계정·권한·입력 검증 확인 | 승인한 테스트 객체/계정으로 최소 왕복 검증 |
| 17시에도 완료 불가 | 배너를 유지하고 실제 진행 상황·예정 종료를 수정 | 핵심 운영 smoke와 담당자 완료 확인 |

데이터 복구는 `npm run data:snapshot -- --rollback <retained-version> --expected-current <current-version>`의 기존 CAS 절차를 사용한다. 앱 rollback, 환경 rollback, Firebase 활성 version rollback, 관리 공지 rollback은 서로 다른 작업이다. 어느 하나만 되돌리고 전체 복구로 표시하지 않는다.

## 7. 실행 기록 형식

```text
실행 시각(KST):
최종 PR head / 병합 main SHA:
mirror commit / Vercel deployment / 실제 sourceSha:
PUBLIC_DATA_BACKEND / SERVICE_NOTICES_SOURCE (비밀값 제외):
이전 활성 version/revision -> 새 활성 version/revision:
23파일 검증 / 19·18 공지 대조 / API source·version:
배너·이미지 / 실제 번역·반복 캐시 / 관리자 권한:
수집·참조·IndexNow·알림 run ID와 결과:
실기기 / SEO·OG·sitemap / 오류·성능:
중단·복구 실행과 결과:
완료 판정 / 배너 게시 중단 시각:
남은 수동·출시 후 항목과 담당자:
```

이 문서 작성 중 실제 병합·배포·Actions 실행·데이터 활성화·Pages 종료·알림 발송은 수행하지 않았다. 운영상의 성공은 위 실행 기록과 실제 응답으로 판정한다.
