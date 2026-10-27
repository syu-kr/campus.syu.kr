# M3 서비스 배포·검증·롤백 체크리스트

2026-10-27 후속: Firebase 실제 이전·Node 24 전체 검사·148뷰 및 추가 결함 보완 결과는 [이전 실행 기록](FIREBASE_MIGRATION_IMPLEMENTATION_2026-10-26.md)에 연결했다. 승인 후 번역 TTL 세 정책은 12:50:36 KST GET에서 모두 `ACTIVE`·추가 지연 0초를 확인했고, Google 일반 모델 일일 문자 한도는 콘솔에서 50,000자로 적용했다. 앱의 25,000자/UTC 예산은 유지한다. 아래 운영/CI 체크박스는 로컬 통과와 구분하며 원격 head CI는 실제 PR Checks를 따르며, 배포·실제 만료 삭제·과금·예산 알림은 아직 완료가 아니다. 서버 계정의 quota 조회 403도 콘솔 적용 확인과 구분한다. 사용자 별도 승인 후 Vercel Production의 `GOOGLE_TRANSLATION_API_KEY` 한 개를 Secret으로 저장하고 새로고침 후 등록 행을 확인했다. 배포된 앱의 설정 반영·키 유효성·실제 번역 성공은 미검증이며 재배포·backend/source 전환은 하지 않았다.

후속: 의존성/SEO/언어/공개 자료 위치 보완 및 최종 Node22의1,602테스트·74화면 검증은 [반영 보고서](DEPLOYMENT_REMEDIATION_2026-10-26.md)에 기록했다. 아래 체크박스는 최종 릴리스 후보의 CI/운영 승인 기록용이며 로컬 통과만으로 자동 완료하지 않는다.

기준일: 2026-10-26. [배포 준비 보고서](PRODUCTION_READINESS_2026-10-26.md)의 실행용 목록이다. **미완료 체크박스는 완료로 오인하지 않는다. 현재 배포 승인이 아니라 필요한 증거의 정의다.**

10월 27일 후속 기능 후보·검사 결과와 남은 P0/P1·수동/출시 후 게이트는 [배포 전 진행 상태](PRE_RELEASE_PROGRESS_2026-10-27.md)에 모았다. 아래 이전 검증 수치와 새 후보의 정확한 head 검사를 구분한다.

## 1. 릴리스 기록

| 항목 | 기록할 값 |
| --- | --- |
| 점검 소스 | 현재 보고서 기준 `699d653569eb59d0ccdccfd9b11e41af20e6d782` |
| 수정 후 후보 PR/head SHA | 기능 후보 `74b440d85484e3c4fdec18ffcbf6882d18f688aa`, 기준 main `7021df7`, React/DOM 19.3.1, 로컬 build `kFMoX6RkQftHlGpqnkV7E`. 문서 후속 commit을 포함한 실제 PR #271 head와 필수 job 4개·별도 CodeQL 보안 결과는 PR Checks에서 확인. 이전 단계 검증은 [진행 보고서](PRE_RELEASE_PROGRESS_2026-10-27.md)와 구분 |
| 병합 main SHA / CI run | 미확인 |
| 배포 mirror SHA / sync run | 미확인 |
| Vercel deployment ID / Production URL / Node | 미확인 |
| 공개 `indexnow-deployment.json.sourceSha` | 배포된 main SHA와 대조 필요 |
| 활성 공개 데이터 version/hash | 이전 후보 `firebase-migration-20261026`·revision 3, 실제 업로드 23파일 검증. 운영 앱은 아직 기존 설정이므로 배포 시 backend/version/hash 재대조 |
| 배포 책임자 / 검증자 / 롤백 담당 | 운영자가 지정 |
| 수용한 미해결 항목 | 셔틀 원본 등 항목별 영향·대체 기능·재확인 기준 기록 |
| 이전 정상 앱 SHA / 데이터 version | 배포 전에 확보 |

비밀값·테스트 계정 credential·개인 자료는 이 표에 넣지 않는다. 검증 시각은 KST로 남긴다.

## 2. 후보 확정 전 — 배포 차단 게이트

- [ ] DEP-01: 현재 실패한 npm 의존성 감사 수정, lockfile 재현, 변경 패키지의 호환성 검증.
- [ ] SEO-01: 공유 이미지 누락·홈 OG/Twitter 상속 수정, KO/EN public 경로/상세 표본 HTTP 검증.
- [ ] SEO-02: 영어 UI의 한국어 Article 언어 정합성과 hreflang 정책 확정.
- [ ] PUB-01: 공개 저장소 이력·artifact·개인정보·데이터/자산 권리 검토. 위험 항목은 비공개 관리.
- [ ] 기존 선택지·검색 조건·검증·복귀·저장소 계약 유지. UI 변경과 데이터 스키마 변경을 섞지 않음.
- [ ] 운영 범위 확정: 룸메이트는 기존 비활성 유지인지, 웹만인지 Android도 함께 출시하는지 기록. 미검증 기능을 임의 활성화하지 않음.
- [ ] 필수 환경을 Production/Preview로 구분해 등록 상태 확인. 빌드 공개값과 runtime 비밀값 구분. 환경 파일을 repo에 복사하지 않음.
- [ ] 웹/API/데이터/DB 각 롤백 대상과 담당 확보.

P1 개선 중 출시 이후로 넘길 항목은 이유·사용자 영향·보완 기한/조건을 기록한다. 불필요한 대규모 리팩터링을 출시의 선행조건으로 만들지 않는다.

## 3. 후보 소스 검사

저장소는 npm을 사용한다. 아래는 **실행할 절차**이며 이 문서의 명령이 전부 이번에 실행됐다는 뜻은 아니다. 깨끗한 환경·고정 runtime에서 수행한다. 실제 env 출력 및 셸 로그의 값 노출을 피한다.

```text
npm ci                         # npm 10.9.4, lockfile 유지
npm audit --audit-level=moderate
npm run check
```

`npm run check`에는 lint → type-check → i18n → TWA 정적 → unused → Python 검사 → 졸업/교육과정 → crawl-data dry-run → unit → build가 있다. `check` 자체에는 npm audit이 없으므로 둘 다 필요하다. Python 패키지는 `requirements.txt`와 CI 절차를 따른다. 현재 CI에는 별도 `pip-audit`도 있다.

- [ ] 최신 후보 SHA에서 전체 check·npm audit·Python audit·CodeQL·Dependency Review 결과 확인.
- [ ] 소스 수정 후 과거 CI 성공을 재사용하지 않음. 해결한 버전·테스트·실행 환경을 명시.
- [ ] 환경 없는 mock/placeholder CI 성공과 실제 API 성공을 구분.
- [ ] 개인정보 포함 없는 source map 업로드와 Sentry release 연결 확인. 업로드 토큰은 서버/빌드 비밀로만 사용.
- [ ] 빌드 산출물에서 시안 fixture·고정 시각·가짜 API·4179 시안 의존이 없는지 검사.
- [ ] Production과 같은 Node major에서 빌드/실행. Windows에서 성공한 결과만으로 Linux CI를 대체하지 않음.
- [ ] `build:analyze`의 webpack 분석 결과를 기본 Turbopack 빌드와 동일 수치로 비교하지 않음.

## 4. 배포 전 Preview 검증

Preview는 테스트용 DB/계정 또는 읽기 전용 연결을 사용한다. 운영 데이터 생성·수정·발송 검증이 필요하면 대상과 정리 범위를 먼저 구체화한다.

### 화면·기능

- [ ] 기존 목록의 37개 페이지 × desktop/mobile 기본 화면. KO/EN 주요 화면, 320/390/768/900/1440/1920 경계, 확대·가로 넘침·긴 문구.
- [ ] 메뉴 hover/click/keyboard, 선택 표시 이동, 검색 overlay·Escape/바깥 클릭·포커스 복귀, 입력 즉시 메뉴 추천·제출 후 공지 검색.
- [ ] 공지: 원문 이동·인라인 AI·페이지 Select·세 자리 번호·끝 항목·키보드·실제 URL·뒤로가기.
- [ ] 시간표: 원래 모든 필터·실제 과목·겹침 검증·최대 4안 비교·삭제·초안 복원·만료·공유·인쇄·이미지 저장.
- [ ] 졸업요건: 연도/학과/전공 등 원래 옵션·종속 초기화·검증·저장 복원·초기화 취소/확인. 판정의 학칙/요람 근거 확인.
- [ ] 도서관: 채움실과 좌석 미노출, 7개 visible room·원본 XML 순서/seat URL, 모바일 운영시간·재시도.
- [ ] 학식: 두 식당·주차/주말·식단 없음·원본 지연·실패 복구, 정상 새로고침/불필요한 내부 갱신 문구 없음.
- [ ] 버스: 노선별 다음 셔틀·정적 시간표·대중교통·실시간 새로고침·실패 fallback. 원본 장애 시 가짜 정상 없음.
- [ ] 지도: 실제 도메인 SDK·시설 검색/목록 대체·모바일 터치. 원인 미확인 오류를 쿠키 차단으로 단정하지 않음.
- [ ] 문의/제안: 선택지·8KiB/필드 검증·중복/429·입력값 유지·재시도. 성공 검증은 테스트 Firestore 접수와 관리자 확인까지.
- [ ] Meet/시간표 공유: 테스트 객체 소유자/참여자·실패·복귀·만료·삭제 및 localStorage 차단. 실제 사용자의 객체를 재료로 쓰지 않음.
- [ ] 관리자: 테스트 등록 UID 성공·미등록 403·revoked token 거부. 비활성 룸메이트는 UI와 API 모두 일치.
- [ ] 저장소 기존 키/스키마·시간표 최대 4안·초안 TTL·졸업 선택 유지. 다른 origin 사이 자동 이전을 기대하지 않음.

### 접근성·성능

- [ ] 실제 Safari/Firefox/Android/iOS에서 남은 native Select fallback·터치·가상 키보드 확인.
- [ ] Tab/Arrow/Enter/Escape, 화면 읽기, modal 이름·초점, 오류 연결, reduced motion·contrast·확대.
- [ ] 최종 후보 cold/warm 성능 표·폰트/JS bytes·레이아웃 변화·실제 조작 기록. 이전 fixture/임의 TBT와 구분.
- [ ] 초반 데이터 대기 중 검색값 보존과 뒤늦은 hydration·chunk 실패 복구.
- [ ] Preview 접근 보호/noindex, 분석 환경 분리. 보호된 Preview가 공유 bot에게 열리지 않는 현상을 운영 OG 결함으로 혼동하지 않음.

## 5. SEO·GEO·공유 자동/수동 표본

| 표본 | 기대 증거 |
| --- | --- |
| 홈 KO/EN | locale·canonical·site identity·올바른 OG URL·이미지 |
| 공개 26개 기본 경로 KO/EN | title/description·일관된 metadata·정상 문서 응답 |
| 공지 최신/과거·4 category·서비스 공지 | 제목·원문·실제 콘텐츠 언어·schema·OG·존재하지 않는 ID 처리 |
| 공지 page 2/마지막·검색·빈 검색 | page canonical, 유효 링크, 검색 noindex·복귀 |
| 공모전/꿀팁 | 구현한 URL 계약에 맞는 초기 목록·직접 진입/뒤로가기. 없는 계약을 검사 기대치로 쓰지 않음 |
| 제안/관리/개인 방/룸메이트/공유 query | 정책에 맞는 noindex/no-store·개인 내용이 metadata나 분석에 없음 |
| sitemap/robots/예전 URL/없는 URL | XML 전체 검사·private 제외·상호 alternate·308/404·배포 주소 일치 |
| 이미지/manifest/favicon | 인증 없는 200·Content-Type·실제 dimensions·승인 A안 |

- [ ] sitemap 크기/개수·대규모 감소 감지·표본 canonical·noindex 일치 확인. 50,000 URL/50MB 초과 전 분할.
- [ ] Naver/Bing/Google 소유확인 태그와 계정 소유권 확인. 공개 토큰을 비밀값으로 오인하지 않음.
- [ ] visible text와 structured data 일치. 새 `llms.txt`나 GEO 전용 schema를 필수 게이트로 추가하지 않음.
- [ ] 모든 학생 기능을 공식 학교 서비스인 것처럼 표시하지 않음. 원문/적용 시점·비공식 서비스 고지 유지.

## 6. 병합·배포 확인

1. 최신 원격 main과 PR head를 다시 확인하고, 충돌/필수 check/보호 규칙을 검증한다. 이전 조사 때의 SHA를 병합 근거로 재사용하지 않는다.
2. 승인된 PR을 병합한 후 **main의 새 SHA**에 대한 CI를 확인한다. PR head의 CI와 병합 결과를 구분한다.
3. `sync-to-vercel-repo`가 해당 source SHA에서 성공했는지 확인한다. mirror의 새 commit과 Vercel deployment를 연결한다.
4. 운영 `indexnow-deployment.json.sourceSha`와 실제 응답·사용 자산을 대조한다. Ready 표시나 HTTP 200만으로 새 구현이라고 판정하지 않는다.
5. 배포된 domain/HTTPS·Kakao/외부 API·CSP·canonical·OG·robots·sitemap·정적 자산·Sentry release를 읽기 전용으로 확인한다.
6. 공개 페이지 기능 smoke 후 필요한 테스트 대상의 쓰기/수신 검증을 승인 범위에서 수행한다. 이전 실제 사용자 데이터는 수정하지 않는다.
7. 해당 앱 SHA·Pages version에 맞게 기존 IndexNow 흐름의 처리 결과를 확인한다. 수신/색인/검색 노출을 별개로 기록한다.

## 7. 운영 관찰

다음 시간은 운영자가 실행할 권장 일정이며 자동 예약한 작업이 아니다.

| 시점 | 확인 |
| --- | --- |
| 직후 | 주요 URL/API 정상·새 bundle·SSR/hydration/chunk 오류·CSP 차단·로그인·외부 링크·도메인 |
| 당일 | 5xx/429·느린 API·cold TTFB·쿼터/비용·문의 접수·데이터 시각·crawler/IndexNow 결과 |
| 다음 정상 수집 주기 | 일일/월간/만나 식단 작업·성공본/실패 fallback·만료 정리·중복 알림 방지 |
| 며칠 뒤 | GSC/Naver/Bing의 처리·대표 URL canonical/색인·Kakao/X 미리보기 캐시 |
| 충분한 방문 표본 이후 | 모바일/desktop p75 CWV·사용자 오류/검색 복귀·폰트/Select 조작 지연 |

Sentry 오류 수신과 GA/RUM은 운영 project에서 확인하되 검색어·인증 URL·개인 방 식별자가 전송되지 않게 한다. synthetic 오류가 로컬에 보이는 것과 서버에서 이벤트를 수신한 것은 다르다.

## 8. 롤백 계획

| 조건 | 대응 | 확인할 증거 |
| --- | --- | --- |
| 새 배포에서 핵심 페이지/로그인/API의 재현 가능한 회귀 | 운영 담당이 이전 정상 앱 배포로 복구 | 이전 앱 SHA·원본/mirror/Vercel 연결, 주요 smoke |
| 원격 수집 데이터 schema/누락/잘못된 주차 | 기존 Pages 버전 롤백 절차 | manifest/hash/active version, 정상본 재확인 |
| env 설정 오류 | 설정을 이전 정상 상태로 복원하고 필요시 재빌드 | 공개 build-time 값·runtime 비밀의 적용 범위 구분 |
| DB schema/TTL/정리 오류 | 쓰기/cleanup을 제한하고 복구 범위 확인 | backup·updateTime/권한·실제 영향. 앱 rollback만으로 복구됐다고 하지 않음 |
| 푸시 중복/부분 발송 | 발송 중지·lock/진행 범위 조사 | 이미 발송된 것은 되돌릴 수 없음. lock 삭제 후 무조건 재발송 금지 |
| stale PWA/구버전 Android | 호환 asset URL 유지·SW 업데이트 확인 | 설치 기기·기존 탭·notification click. 앱 저장소를 일괄 초기화하지 않음 |

사용자 불편이 확인되면 실행 가능한 범위에서 빠르게 복구하되, 원본 셔틀 서버의 기존 장애를 새 UI 회귀라고 단정하지 않는다. 보안/개인정보 노출이 확인되면 필요한 credential 폐기와 확산 제한을 우선하고 비공개로 영향 기록을 관리한다.

## 9. 출시 결과 기록 양식

```text
배포 시각(KST):
main source SHA / mirror SHA / deployment ID:
Production Node / Pages version:
전체 check / dependency audit / CI:
실제 HTTP·UI·API 확인 범위:
쓰기·발송·기기 검증 범위:
SEO·OG·sitemap 확인:
성능 조건·실측 / 아직 없는 field data:
미해결·수용 항목과 담당:
롤백 대상·조건:
최종 판단: 배포 보류 / 제한 공개 / 정식 공개
```

체크하지 않은 항목은 “정상일 것”으로 채우지 않는다. 공개 범위를 제한해 출시한다면 비활성 기능·외부 장애·운영 조건을 명시한다.
