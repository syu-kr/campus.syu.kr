# 배포 직전 보완·재검증

기존 검증의 미해결 항목을 다시 대조해 코드로 해결할 수 있는 문제를 수정했다. 기능 소스는 `05335cc`, 최종 로컬 빌드는 **`ys14VPxN1CMMX93QVduSr`**, Node 24.22.1이다. 이번 작업은 배포 준비까지이며 **main 병합·배포·운영 환경 전환·자료 활성화·Actions 실행·Pages 종료·발송은 하지 않았다.**

## 수정한 문제

| 문제 | 보완과 보존한 동작 |
| --- | --- |
| 초기 배너 조회가 연속으로 비면 30초 동안 새 공지를 못 봄 | 초기 복구를 1초·2초 뒤 최대 2회 추가한다. 요청마다 8초 상한을 적용하고 중복 조회·취소·타이머를 정리한다. 이후 정상 30초 조회 주기는 유지한다. |
| 받은 배너의 시작·종료·오늘 숨김 만료가 조회 주기까지 늦어짐 | 알려진 경계에서 로컬 시각을 갱신한다. 서버가 아직 보내지 않은 미래 예약 공지의 발견은 기존 30초 조회 주기다. |
| 검색·문의 작성 중 새 팝업이 초점을 가져감 | 기존 모달이 닫힌 뒤 팝업을 표시한다. 입력·취소·초점 복귀와 한 번에 하나씩 보이는 공지 계약을 유지한다. |
| Firebase 식단도 옛 공개 URL 없이는 화면에서 비활성화됨 | 서버가 Firebase 사용 여부만 boolean으로 전달해 홈·학식 상세에서 같은 origin API를 읽는다. 화면과 번역은 같은 공용 reader를 사용한다. Pages 기본값·URL/스키마 검사·장애 fallback·동일 서비스 재귀 차단은 유지한다. |
| 지도 SDK가 무응답이면 계속 로딩하고 실패 Promise가 고정됨 | 전체 SDK 로드를 10초로 제한하고 실패 캐시/스크립트를 정리한다. 같은 화면에서 다시 불러올 수 있고, 검색어와 안정된 상태 안내의 초점을 유지한다. 셔틀 지도의 같은 loader 호출자도 회귀 검사했다. |
| 관리자 배너의 enum에 배열·객체가 강제 변환되어 잘못 저장될 수 있음 | `category`·`placement`를 실제 문자열과 정확한 선택지로 검사한다. `placement:["popup"]` 등의 재현 2건을 고치고 잘못된 타입 회귀 8건을 추가했다. 인증 우회·권한 상승으로 확대해 주장하지 않는다. |

새 의존성은 없다. 시간표 최대 4안·검색 조건·졸업 선택지·검증·브라우저 저장·복귀 계약은 유지했다. 일반 격자·목록은 변경하지 않았다.

## 최종 후보 검증

| 범위 | 결과 |
| --- | --- |
| 소스 검사 | 관련 17파일 **249테스트**, 전체 lint·타입·i18n·미사용 검사·빌드 통과 |
| 보안 변경분 | 네트워크 없는 제한 컨테이너에서 **27/27 통과**. 격리 Node는 기존 이미지의 24.21.0이며 정식 24.22.1 타입·빌드와 구분한다. 실제 실행 9모듈·준비 소스 22개, 종료 후 해시 불일치 0. 실제 비밀값·외부 fetch·클라우드 쓰기 0. 이전 113개와 합산하지 않음 |
| 특화 브라우저 | **7흐름 통과**. 초기 빈 2회 뒤 약 3.46초 복구, 검색/문의 중 팝업 보류, 모의 KST 경계, 320px EN 지연/503 원문 유지. 지도는 KO 약 10,021ms·EN 10,042ms에 오류 표시 후 재시도 fixture에서 지도 1개·마커 39개 생성·검색어/초점 보존 |
| 기능 보존 | 시간표·졸업 × 1440/390px **4흐름 통과**. 학과 필터·Select 취소·최대 4안 비교·페이지 이동 후 작업 복원, 졸업 취소/초기화·뒤로가기 저장 복원 |
| 전체 반응형 | KO/EN × 37경로 × 1440/390px **148화면 통과**, 번역 fixture 78batch·실패/브라우저 예외/잔여 한글/실제 Google 호출 0. 실제 DB 공개 공지 19개와 공개 목록의 제목·요약 일치. 검색 복귀 KO/EN × 320/390px 4흐름, 메뉴·검색 3폭 흐름도 통과. 이전 후보의 148뷰와 합산하지 않음 |
| 만나의집 URL 독립 | 홈 KO390·학식 EN1440에서 실제 탭 전환 2흐름 통과. 같은 origin 식당 API가 HTTP 200·`firebase-storage`·기존 활성 버전을 반환했고 10월 27일 당일 메뉴와 화면이 일치했다. 미설정 문구·옛 URL 요청·실제 Google 호출·업무 쓰기 0 |
| SEO·자산 | 8 HTML의 lang·canonical·hreflang·OG·CSP·JSON-LD 통과. 사이트 identity는 script 하나의 graph에 Organization·WebSite가 함께 있다. 사이트맵 10,710경로 중 공지 상세 KO/EN 38경로, 검사한 민감 경로 0. robots·OG 이미지·manifest의 아이콘 4개 정상 |
| 데이터 호환 경로 | 식당 API·`/data/cafeteria-menu.json`·옛 식당 경로·공지 crawl API의 실제 GET 4개가 `firebase-storage` 출처·기존 활성 버전을 반환. ETag 있는 3개는 재조회 304. 원래 ETag 없는 crawl 응답을 304 성공으로 계산하지 않음 |
| 배포 산출물 | 브라우저 80파일·2,657,492B의 선택 서버 비밀값 표현 10개/개인 경로 일치 0. 서버 trace 81개에서 로컬 QA·환경·무관한 Markdown 0. 공지 37개·졸업 JSON 5개 보존. 전체 비밀정보·권리 감사는 아님 |

빌드·서버는 `PUBLIC_DATA_BACKEND=firebase`, `SERVICE_NOTICES_SOURCE=database`, **`NEXT_PUBLIC_CAFETERIA_JSON_URL=''`**로 검증했다. 운영 플래그 변경을 뜻하지 않는다. 브라우저 번역·지도 성공은 fixture이며 실제 Google/Kakao·업무 쓰기는 0이다. 기존 실제 Google 표본·TTL 설정·Storage 왕복은 [앞선 준비 판정](RELEASE_READINESS_2026-10-27.md)의 별도 근거다.

## 운영 설정·이전 후보의 준비 상태

- Vercel `syu-campus`에서 필수 Firebase client 6개·Kakao 공개 키, 서비스 계정·관리자 UID·요청 제한 비밀·번역 키의 **이름과 Production 적용 범위**를 확인했다. Secret 값을 열지 않았다. 공개 버킷은 로컬의 검증 대상과 일치했다. 이름 존재가 실제 자격·권한·관리자 UID 값 일치의 증거는 아니다.
- Vercel의 `PUBLIC_DATA_BACKEND`, `SERVICE_NOTICES_SOURCE`는 미설정이라 첫 출시 기본값은 **pages/hybrid**다. Actions도 backend/버킷 변수 3개는 미설정이고 Firebase 서비스 계정 secret 이름만 존재한다. 준비 작업에서 이를 먼저 전환하지 않았다.
- 기존 `RATE_LIMIT_SECRET`, `PUSH_API_KEY`는 Vercel의 Config 유형으로 표시돼 Secret 분류 권고가 있다. 값·권한·적용 범위·자격을 변경하거나 회전하지 않았다. 이는 공개 브라우저 번들 노출이 확인됐다는 뜻이 아니며, 기존 운영 설정 정리는 별도 검토 대상이다.
- 16:26 KST에 운영 `/indexnow-deployment.json`의 source SHA가 현재 source main `7021df7618347d6c826f910365ce7c4c62db7e4c`와 일치했고, mirror main은 `2c8529cd6cdc9efa9cf70da7f160a3a9bbbcc128`이었다. 이전 deployment와 환경·자료 버전을 보존하는 복구 기준선이다.
- 16:27 KST에 최신 Pages `20261027062405841-40460790849.1`의 일일 9개와 기존 Firebase 14개로 **23파일·11,451,850B** 후보를 다시 준비했다. hash/schema·sourceHealth·CLI dry-run 통과, 양쪽 포인터 변화와 cloud 쓰기 0이다. Firebase 활성본은 여전히 `firebase-migration-20261026`, revision 3이다.

## 출시 실행 때 남는 순서

1. 최종 PR head·최신 main·필수 CI·복구 deployment를 대조하고 승인 후 병합한다. 새 UI를 pages/hybrid로 먼저 출시하면 코드 출시와 저장소 전환을 구분할 수 있다.
2. main CI → mirror sync → Vercel의 실제 source SHA·Production 도메인을 확인하고 팝업·관리자·기본 화면을 점검한다.
3. 최신성·현재 revision을 재대조한 뒤 승인한 후보를 활성화한다. 기존 Pages writer와 겹치지 않게 Actions backend·버킷을 맞춘다.
4. Vercel build/runtime의 Firebase 및 공지 DB 모드를 맞춰 새 배포하고 첫 실제 읽기·수집/발행·no-op·복구 근거를 확인한다. HTTP 200만으로 fallback을 정상 Firebase 연결로 판정하지 않는다.
5. 실제 관리자 인증·업로드·번역 키/캐시·Kakao 운영 도메인·설치 앱·실기기·스크린리더·운영 CWV를 확인한다. TTL 삭제·비용은 만료 후 관찰하며 인위적으로 만료 문서를 만들지 않았다.
6. 실제 완료 후 팝업을 게시 중단한다. Pages는 새 생산자·소비자·장애 복구 및 옛 주소/설치 앱 유예를 확인한 뒤 별도로 종료한다.

셔틀의 기존 공급자 403/앱 502는 코드로 우회하지 않았다. 정적 시간표·오류 복구는 유지하며 실시간 정상 복귀는 공급자 확인 항목이다. 로컬 지도 fixture 성공을 실제 Kakao 연결 성공으로 표시하지 않는다. [상세 출시·Pages 종료·복구 실행표](RELEASE_MIGRATION_RUNBOOK_2026-10-27.md)를 함께 따른다.

## 실행 근거와 한계

최종 원격 검사는 [PR #271의 최신 head Checks](https://github.com/syu-kr/campus.syu.kr/pull/271/checks)를 기준으로 한다. 준비 증거는 Git 제외 `output/playwright/firebase-goal/predeploy-20261027/`, 특화 UI는 `predeploy-20261027-state-qa/`, 보안은 `release-security-delta-20261027/`에 보존했다. 실제 자정까지 기다린 검사가 아닌 모의 시계 결과이며 실기기·운영 배포의 증거를 대신하지 않는다.

첫 보안 실행의 timeout 명령 문법 오류, enum 재현 2실패, UI 하네스의 hydration/숨김 링크/팝업 닫기 경쟁, SDK 검색 dropdown/외부 frame storage seed 오류는 원본을 남겼다. HTTP 검사의 JSON-LD 개수 기대는 실제 graph 구조에 맞춰 수정했고, 큰 XML 파싱 뒤 단발 fetch 실패는 단독 재조회 200 및 새 연결을 쓰는 최종 재검사 통과와 구분했다. 실패를 지우거나 모두 제품 결함으로 계산하지 않았다.
