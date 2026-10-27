# Firebase 이전과 UI 보완 실행 기록

2026-10-26–27 KST. [실행 계획](FIREBASE_MIGRATION_RELEASE_PLAN_2026-10-26.md)을 구현하고 있다. 현재 서비스 공지 19개와 공개 자료 23개의 실제 복사·검증을 마쳤다. 로컬 구현·빌드·화면·기능·성능 검증을 마쳤고, 10월 27일 승인 후 번역 TTL 세 정책과 Google 일일 문자 한도를 적용했다. 사용자 별도 승인 후 Vercel Production 번역 키 한 개만 Secret으로 등록했다. **운영 앱 배포·main 병합·backend/source 플래그 전환은 수행하지 않았다.** 원격 CI·출시 확인과 아래 미검증 운영 항목은 남아 있으므로 운영 적용 완료로 표시하지 않는다.

검토한 원격 main `6d95a0f`에는 Node 24.22.1, 타입 24.19.2, gRPC 1.14.6과 알림 보완이 반영되어 있었다. 후보가 운영 수정을 되돌리지 않도록 기능 브랜치에 반영했다. 이전 누적 구현 보존 커밋은 `a1641aa`, 최신 main 반영 커밋은 `1105828`, UI·초점·Node 타입 보완은 `ef016a7`, 영어 홈 CLS 보완은 `ee29500`, 재시도 초점·확대 텍스트 보완은 `b4ae09d`다. M3 레이아웃·자동 번역·선택지와 main의 알림/보안 수정을 함께 유지했다. 그 통합 단계에서 main 자체나 원격 Git 소스는 변경하지 않았다.

10월 27일 추가 기능 후보 `d59a00d`·build `htH-qdrTGfa4sdnE2dBOj`, 졸업 응답 축소·새 검사 경계·현재 Pages/Firebase 차이와 PR/운영 게이트는 [배포 전 진행 상태](PRE_RELEASE_PROGRESS_2026-10-27.md)에 모았다. 아래 `b4ae09d`·`sQ87eW7dblv9HLwQme7fQ`의 전체 통합 검증은 앞선 실행 기록이다.

## 실제 변경한 데이터

| 대상 | 실제 결과 | 기존 데이터 보호 |
| --- | --- | --- |
| Storage 이미지 | 합성 PNG 1건 업로드 200, WebP 80×40/EXIF 제거, 공개 200, ETag 304 | 생성한 객체만 generation 조건으로 삭제. 기존 파일 변경 없음 |
| Storage 접근 설정 | 버킷 IAM 읽기 성공·공개 principal 역할 0개, 활성 Storage rules 조회 200·클라이언트 read/write false | 정책·IAM 변경과 익명 직접 쓰기 시험은 수행하지 않음 |
| 서비스 공지 | 원문 19개·검수 영문 18개를 `site_managed_content`에 신규 레코드 19개로 복사 | 사전 백업, 기존 레코드 0개·충돌 0개. 원본 MD 보존 |
| 공지 재검증 | 원본 게시본 일치 19개, 메타데이터 준비 19개, 재실행 create/enrich/conflicts 0·쓰기 0 | 롤백 dry-run에서 생성 대상 19개 확인. 실제 삭제/복원은 미실행 |
| 공개 snapshot | 23파일·11,430,628B, `firebase-migration-20261026`에 불변 업로드 | 기존 객체 덮어쓰기 없음. 새 활성 포인터가 없는 상태에서 최초 등록 |
| snapshot 검증 | 활성화 전 전체 파일 재조회·해시·크기·schema 확인, 별도 `--verify` 23개 성공 | 같은 자료 재발행은 changed=false/activated=false |
| 실제 snapshot 복구 | 같은 23개 자료의 시험 버전 revision 2로 전환 후 최초 버전 revision 3으로 복구 | 파일별 hash/size·출처 상태 일치, 콘텐츠 변경 없음. 시험 버전도 복구 목록에 보존 |

복사한 일일 9파일은 저장소의 과거 번들이 아니라 현재 Pages의 `20261026062314696-40279428812.1` 성공본이다. manifest 검증과 기존 출처 상태를 함께 유지했다. 참조 13파일은 저장소 원본, 만나의집은 기존 공개 식단 JSON을 사용했다. 이 때문에 최초 로컬 22파일 합계와 실제 이전 크기는 다르다. 공지 감소나 과거 식단의 신규 발행을 막기 위한 선택이다.

Firestore 활성 정보는 `site_public_data/current`에 저장했다. 이 포인터 등록만으로 현재 운영 앱을 새 저장소로 바꾸지 않는다. 로컬 Git 제외 환경에만 `PUBLIC_DATA_BACKEND=firebase`, `SERVICE_NOTICES_SOURCE=database`를 지정했다. 운영 환경과 Actions 변수/secret은 별도 출시 설정이다.

## 구현한 보완

- **검색 초기 클릭:** nonce가 있는 초기 head 스크립트로 원래 검색 결과 복귀 정보를 저장한다. React는 기존 화면·초점 복원을 담당한다. 수정키·새 탭·외부 URL·다운로드·검색 아닌 화면·차단된 sessionStorage를 검증했다.
- **좁은 시간표:** 360px 미만의 빈 요약을 2열로 배치한다. 선택지·계산·최대 4안과 정상 시간표 격자는 유지한다.
- **지도 실패:** 정상/로딩 지도 크기는 유지하고 확정 실패 카드만 내용 높이로 줄인다.
- **날씨·꿀팁:** 홈 문장을 단어 단위로 균형 있게 줄바꿈하고, 꿀팁 탭의 음수 rem 여백을 제거한다. 내부 가로 스크롤은 유지한다.
- **공지 이전:** 표시 번호·원문 날짜·작성자·언어·원문/검수 해시·요약 표시를 불변 메타데이터에 보존한다. DB-only 모드, dry-run/백업/조건부 import/검증/안전한 rollback을 제공한다.
- **데이터 이전:** 파일별 허용 목록/검증, immutable Storage, 활성 revision CAS, 버전 고정 묶음·캐시·fallback·복구를 연결했다. 졸업 계산은 전달받은 참조 snapshot으로 실행한다.
- **자동화:** 일일·만나의집·롤백은 명시적 Firebase 분기를 추가한다. 월간 수집의 검토 PR은 유지하고, 승인된 최신 main의 CI 성공 뒤 참조 13파일을 발행하는 workflow 코드를 추가했다. 실제 workflow 실행은 하지 않았다.
- **검색 갱신:** 활성 snapshot과 실제 API 출처를 대조하며, 만나의집 변화와 DB 공지의 추가·수정·중단도 기존 IndexNow 계산에 반영한다. 실제 IndexNow 제출은 하지 않았다. CMS 단독 게시 직후의 별도 즉시 제출 자동화는 추가하지 않았으며 다음 기존 실행 기회에 감지한다.

만나의집은 기존 수집기가 쓰는 `cafeteria/`를 canonical 로컬 경로로 사용한다. 복원한 `data/`의 옛 파일이 새 수집본보다 우선하는 오류를 수정했다. 출처 상태 캐시도 기존 `{files:...}` 형식의 read/write를 공유하도록 고쳤다. 두 문제 모두 모의 데이터만으로 완료 처리하지 않고 실제 이전 dry-run에서 다시 검증했다.

## 번역 TTL과 운영 설정

2026-10-27 02:06 KST까지 세 번역 collection group의 `expires_at` TTL은 미설정이었다. 최초 자동 승인 차단과 승인 후 서비스 계정의 403은 당시 실패 기록이다. 이후 사용자가 콘솔 작업과 세 정책 생성을 구체적으로 승인해 `syu-campus`의 `(default)` DB에 생성했다. **12:50:36 KST 읽기 전용 API 재조회에서 세 정책 모두 GET 200·`ACTIVE`·`expirationOffset:0s`를 확인했다.** 근거는 Git 제외 `output/playwright/firebase-goal/cloud-settings-readonly-ttl-activation-check-1.json`이다. 기존 만료 문서는 자동 삭제 대상이 되며, 실제 물리 삭제 시점·삭제 비용은 아직 측정하지 않았다.

대상은 `public_content_translation_fields`, `public_content_translations`, `public_content_translation_usage` 세 그룹이며 추가 만료 지연은 0이다. 다른 그룹의 TTL은 변경하지 않았다. 번역 캐시·사용량의 앱 만료 검사와 하루 25,000자/UTC 예산은 유지한다.

Cloud Console에서 `syu-campus`의 Cloud Translation API(`translate.googleapis.com`) **`v2 and v3 general model characters per day`를 무제한에서 50,000자로 변경**했고 성공 안내와 표의 적용값을 확인했다. 새로고침 후 전체 23개 한도를 변경 전과 비교해 일일 한도 1개만 바뀌고 나머지 22개 값이 같음을 확인했다. 사용자는 현재 환경의 키가 같은 프로젝트의 ‘번역’ 키임을 확인했고, 콘솔에서 Cloud Translation API 서비스 제한을 확인했다. Google 콘솔에서 키 표시를 열지 않았고 값을 대화·로그에 출력하지 않았다. 앱의 UTC 일일 예산과 Google의 태평양 시간 기준 일일 할당량은 별개다. 실제 한도 소진 시험은 수행하지 않았고 일일 한도 변경의 효력 반영에는 최대 24시간이 걸릴 수 있다. 서버 계정의 quota 메타데이터 조회는 `AUTH_PERMISSION_DENIED` 403, API Keys lookup은 `SERVICE_DISABLED` 403으로 남아 있으므로 콘솔 확인과 구분한다. 새 IAM 권한·예산 알림·과금 설정은 변경하지 않았다.

후속으로 사용자의 ‘Production 번역 키만 등록 승인’을 받아 Vercel `syu-campus`의 Production에 `GOOGLE_TRANSLATION_API_KEY` 한 개를 Secret으로 저장하고 새로고침 후 등록 행을 확인했다. 값은 대화·로그에 출력하지 않았다. 재배포·backend/source 전환은 하지 않았으며, 배포된 앱의 설정 반영·키 유효성·실제 번역 성공은 아직 검증하지 않았다.

Storage는 미국 동부, Firestore는 서울 리전이다. 리전 차이의 영향은 전환 전후 실측에 포함한다. 버킷이나 요금제·IAM 역할을 자동 생성/변경하지 않았다.

## 현재 검증 근거

| 검사 | 현재 결과 |
| --- | --- |
| Node/npm 기준 | 최초 점검 Node 22.22.2·npm 10.9.4, 최신 main 반영 후 최종 후보 Node 24.22.1·npm 10.9.4. 기본 셸의 Node 24.18.0을 최종 근거로 사용하지 않음 |
| npm 감사 | 최신 실행 취약점 0개 |
| Python 감사 | CI 지정 requirements·pip-audit 2.10.1, 8개 해석 의존성 취약점 0개. 로컬 Python은 3.12.14로 CI 3.11과 구분 |
| 검색 복귀 회귀 | 초기 4파일 43개 및 키보드/사전 취소/KO·EN 경계 추가 테스트 성공 |
| UI 보완 단위 | 4파일 54개·타입·수정 ESLint 성공. 최종 화면 실행은 별도 기록 |
| 공지 이전 회귀 | 8파일 71개, 추가 실제 원본 게시 validator 회귀와 수정 ESLint 성공 |
| 공개 snapshot 회귀 | 16파일 249개, 후속 상태 캐시 3파일 63개·ESLint 성공 |
| 자동화·색인 | 신규 reference 7개, CMS IndexNow 3개와 기존 fingerprint 회귀 성공. 첫 fixture의 공모전 원본 누락을 보완 후 재실행 |
| 전체 타입 | 새 workflow 테스트의 입력 타입 수정 후 전체 통과. 최종 통합 검사에서 다시 확인 |
| 최초 전체 단위 | Node 22: 218파일 중 217파일, 1,921개 중 1,920개 성공. 기존 ESLint 진단 1건은 내부 10초 제한 실패, 같은 제한의 분리 실행에서 6개 모두 성공. 전체 통과로 표시하지 않음 |
| 이전 전 성능 | 동일 Node 22 최적화 서버 4경로×2폭×5회=40회, pageerror 0, 업무 쓰기 0 |
| 최종 Node 24 검사 | lint·type-check·i18n·TWA·unused·Python·졸업·교육과정·crawl dry-run 및 218파일 1,922테스트 모두 성공. 이후 헤더 14·Select 2개 focused 회귀, 타입·수정 ESLint와 새 빌드도 성공 |
| 실제 HTTP·SEO | 171 GET 성공: 23자료 해시/크기/schema·기존 URL·304/404, 공지 목록 2·상세 38, 공개 SEO 52·robots·사이트맵 필수 90 URL·OG. 이후 UI 변경 빌드에서도 대표 5 GET과 build ID 대조 |
| 기존 기능 흐름 | 빌드 L01tz의 19그룹·CPU 6배 복귀 4조건·Select 29동작 성공. 실제 강의·최대 4안·저장 복원 포함. 이후 변경은 번역 상태/홈 텍스트다. 최종 sQ87 빌드에서도 CPU 6배 KO/EN·390/320 검색 즉시 복귀 4조건을 재실행해 nonce·query/session·결과 focus·넘침을 확인했다. 스크롤은 0→0만 확인했으며 비영점 복귀와 구분 |
| 화면 | 최종 sQ87 빌드 37경로×KO/EN×1440/390=148뷰 성공. 23개 같은 Firebase version·영어 등록 필드 적용·실패 4상태·재시도·언어 왕복·개인 입력 제외 확인. 관리자 26뷰·13흐름과 추가 UI 46조건은 앞선 L01tz 빌드에서 성공했으며 이후 영향이 없는 범위와 구분 |
| 최종 성능 | 아래 전환 전후 결과 참조. 원격 실제 사용자 CWV·INP·운영 비용은 별도 |

위 focused 숫자는 서로 중복되므로 합산해 전체 테스트 수라고 표현하지 않는다. 리소스 경합을 피하기 위해 전체 단위 검사와 빌드는 순차 실행한다.

## 통합 검증에서 추가로 고친 결함

최종 실행 빌드는 Node 24.22.1의 `sQ87eW7dblv9HLwQme7fQ`, 기능 소스는 `b4ae09d`다. 최초 실행 결과를 지우고 재검증 결과로 바꾸지 않았다.

- 320px·글자 크기 200%에서 날씨와 검색 버튼이 헤더 너비를 넘었다. 모바일 헤더가 필요한 경우 줄바꿈하고 ResizeObserver가 실제 높이를 `--header-height`에 반영하도록 고쳤다. 검색 버튼을 줄이거나 글자를 잘라 해결하지 않았다. 헤더 관련 단위 14개와 46개 UI 표본이 통과했다.
- 데스크톱 학과 Select를 Escape로 닫으면 초점이 BODY에 남는 현상이 반복 재현됐다. 공통 Select의 공식 `finalFocus`에 trigger ref를 명시했다. 별도 회귀 2개와 브라우저 29동작에서 Escape·선택·밖 클릭·부모 모달 종료 후 복귀, 값 보존을 확인했다. [Base UI Select API](https://base-ui.com/react/components/select)
- EN 학식·버스에 번역 안내가 생기면 `:first-child` 탭 selector가 빠져 기존 73px 위치로 돌아가고 안내와 54–57px 겹쳤다. 탭 자체의 segmented 자식으로 selector를 고정하고 두 페이지의 번역 안내를 일반 문서 흐름으로 배치했다. 실제 compiled CSS의 768/1440px 오류 안내·탭 이동·URL/query/hash 보존, 확대 2조건에서 겹침과 가로 넘침이 0이었다. 번역과 선택 로직은 유지했다.

최초 공모전 EN 모바일 번역 적용 검사와 Select 항목 높이 검사는 초기 상태에서 실패한 기록을 보존했다. 번역은 실제 hydration·잔여 공개 한글 상태를 확인하도록 검증기를 보강하고, 항목은 애니메이션이 끝난 뒤 검사했다. 지속 결함이 재현되지 않은 항목을 확정 제품 버그로 세지 않았다. 그와 달리 반복 재현된 Escape 초점 문제는 실제 코드를 수정했다.

- 영어 홈의 늦은 번역 안내 삽입은 CLS 약 0.0893, 오류·재시도 높이 변화는 약 0.0297을 만들어 합계 약 0.119였다. 홈에서만 최초 HTML에 숨김 안내 자리를 확보하고 `usePathname`으로 실제 클라이언트 이동을 따라가게 했다. SSR 범위 5건과 홈↔약관 Link 왕복을 검사했다. 서버 layout의 초기 경로에 값을 고정하는 중간 구현은 수정했으며 중단한 화면 순회를 성공 숫자로 세지 않았다.

- 번역 재시도 버튼이 로딩 중 사라져 키보드 초점이 BODY로 빠지는 문제를 실제 브라우저와 실패 단위 테스트로 재현했다. 유지되는 상태 문단에 M3 초점을 옮긴 뒤 재시도하게 고쳤다. 재실패 후 문단 초점 유지·Tab으로 재시도 버튼 복귀가 통과했다.

- 320px·글자 크기 200%에서 홈 링크 카드와 PWA 설명의 긴 영어 단어가 넘쳤다. 두 텍스트 영역에만 `overflow-wrap:anywhere`를 적용해 격자·문구·URL을 유지하며 가로 넘침 33px→0을 확인했다. 번역/홈 관련 2파일 20테스트와 타입·수정 ESLint·빌드가 통과했다.

JavaScript를 끈 768px 비교에서는 기본 헤더 높이 64px와 실제 테두리 포함 65px의 1px 차이가 남았다. 정상 hydration 후에는 실제 높이로 보정된다. 이 선택적 비교 실패는 전체 성공 숫자에 포함하지 않는다. 실제 Safari·OS 글자 크기·키보드·스크린리더와 구분한다.

최종 browser JS 73파일·2,392,313B는 모든 분할 chunk의 압축 전 합계이며 한 페이지 전송량이 아니다. 세 대표 서버 trace에 fallback JSON 22개가 포함되고 env/output/cache 파일이 없는 것을 확인했다. 설정된 서버 비밀값 4개와 선택 시안/로컬 경로 패턴은 browser JS에서 발견되지 않았다. 이 제한된 점검을 전체 비밀값/개인정보 감사라고 표현하지 않는다.

## 전환 전후 성능 측정

Node 24.22.1·최적화 서버에서 4경로×1440/390px×5회, 전후 각각 40회 측정했다. 최종 후측정과 영어 홈 10회는 모두 sQ87 빌드다. 390px는 CPU 4배 지연·150ms·1.6Mbps이며 다른 검증 브라우저·빌드를 종료하고 실행했다. 도구 routing이 HTTP cache를 끄고 매번 별도 context를 사용한다. 서버 cache는 reset하지 않았고 후측정은 전체 QA 후 warmed 상태다. 전측정 첫 홈의 Pages timeout/fallback도 기록돼 출처/cache 조건이 완전히 같지는 않다. 아래 값은 관측 비교이며 Firebase 자체의 인과적 향상률이 아니다.

| 폭·경로 | LCP 중앙값 ms 전→후 | TTFB 중앙값 ms 전→후 | 전송 KiB 전→후 | 요청 수 전→후 |
| --- | ---: | ---: | ---: | ---: |
| 390 / | 7592→1036 | 84→21 | 695.4→740.1 | 35→57 |
| 390 /service/notices | 2388→984 | 68→25 | 686.3→697.7 | 34→44 |
| 390 /service/notices/019-manna-house-menu | 2392→924 | 125→65 | 764.9→776.2 | 37→47 |
| 390 /academic/graduation | 2064→1012 | 51→61 | 717.0→728.6 | 34→43 |
| 1440 / | 584→172 | 58→33 | 742.8→744.2 | 59→60 |
| 1440 /service/notices | 264→144 | 44→26 | 695.8→697.7 | 43→44 |
| 1440 /service/notices/019-manna-house-menu | 320→168 | 83→54 | 774.5→776.3 | 46→47 |
| 1440 /academic/graduation | 272→188 | 39→58 | 726.0→728.6 | 42→43 |

후측정 40회의 pageerror·넘침·업무 쓰기 0, CLS 최대 0.0372. 중앙값이 20%이면서 200ms 이상 악화되는 이번 임시 지연 기준 초과는 0이다. 졸업 TTFB는 약 10–18ms 증가했다. 모바일 홈은 약 45.8KB(+6.4%)·22요청(35→57)이 늘었고 다른 모바일 경로도 9–10요청이 늘었다. 전송량·요청 수는 개선 완료라고 표현하지 않으며 폰트·prefetch·리소스 정착과 실제 사용자 조건에서 추가 확인할 항목이다.

영어 홈의 최종 10회는 실제 번역 POST를 10건 차단한 실패 상태 표본이다. 390px LCP/TTFB 중앙값 1,052/35.5ms, 1440px 180/34.7ms, pageerror/넘침 0. CLS 최대 0.05001로 최초 0.11911보다 낮았다. 별도 3회 확장 관찰도 0.050006/0.048270/0.048243이었다. 남은 이동은 오류 안내 높이와 날씨 문장 줄 수 변화다. 실제 Google 성공 지연·번역 품질·field CWV/INP를 증명하는 수치가 아니다.

### 별도 서버의 첫/반복 요청

포트 4182의 새 Node 20개에서 4경로×5쌍, 첫·반복 HTML 40건을 측정했다. 설정 확인 GET만 먼저 보내며 두 source flag는 각 프로세스에 명시했다. 40건 모두 200·동일 build ID이며 각 소유 PID와 종료를 검증했다. readiness 60시도는 별도이며 총 네트워크 요청이 40건이라는 뜻이 아니다.

| 경로 | 첫 요청 헤더/전체 HTML ms | 반복 요청 헤더/전체 HTML ms | 첫 요청 비압축 HTML B |
| --- | ---: | ---: | ---: |
| / | 550 / 4248 | 43 / 45 | 138640 |
| /service/notices | 599 / 601 | 40 / 42 | 65933 |
| /service/notices/019-manna-house-menu | 730 / 732 | 69 / 70 | 53565 |
| /academic/graduation | 2718 / 2724 | 79 / 92 | 1139982 |

헤더 도착만 보면 홈 첫 요청 약 0.55초지만 전체 HTML은 약 4.25초다. 졸업 첫 전체 HTML 약 2.72초와 비압축 1,139,982B도 운영 관찰·최적화 검토 항목으로 남긴다. 이는 캐시가 빈 서버 프로세스의 위험이며 운영 LCP 통과나 Firebase 단독 원인으로 단정할 수 없다. 사전 cold-before가 없어 동일 조건 전환 전 회귀 비교도 아니다. 압축을 끈 Node HTML 수신이며 JS/폰트·브라우저 렌더링·OS/provider cache 초기화는 포함하지 않는다. 서버 프로세스의 명시 flag만으로 개별 SSR fetch의 fallback 미사용을 증명하지 않으며 23개 API의 실제 Firebase source/hash 검사는 별도 근거다.

Firestore 과금 읽기 수·Storage 청구 다운로드·공급자 quota/비용은 직접 계측하지 않았다. 반복 발행 쓰기 0, ETag 304와 앱 cache 회귀는 확인했지만 운영 비용 실측을 대체하지 않는다. 소유 서버 20개는 모두 SIGTERM으로 종료했고 강제 종료 0·4182 listener 0을 확인했다.

## 원본 보존과 공개 저장소

원본 MD·공개 JSON은 복구와 credential 없는 CI의 고정 자료로 보존한다. 로컬 DB-only 공지 19개의 동등성과 23개 공개 자료의 실제 Firebase API 출처·해시를 검증했다. 공개 JSON은 원격 장애 시 유효한 fallback으로 읽는 경로를 의도적으로 유지한다. 원본 파일을 삭제해 이전 성공처럼 보이게 하지 않는다. 실제 배포 이후 정상 수집 주기와 복구를 확인하기 전까지 유효한 fallback·과거 설치 앱 자산을 제거하지 않는다.

사전 점검에서는 후보 텍스트 780파일의 제한된 비밀값/개인 PC 경로 패턴, 민감 경로 추적과 상대 문서 링크 누락이 0이었다. 로컬 refs 1,224커밋의 선택 토큰·개인키 패턴 경로도 0이었다. 이는 전체 secret/개인정보/권리 감사나 원격 최신성 증거는 아니다. 구형 이미지 17개·1,800,686B는 과거 설치/알림 호환을 확인하지 못해 삭제하지 않았다.

백업·인증 관련 임시 파일·시험 원본·전체 브라우저 자료는 Git에서 제외되는 `output/` 또는 `.cache/`에 둔다. 공개 문서에 관리자 UID·토큰·서비스 계정 키·개인 자료를 기록하지 않는다.

## 실행 자료와 다음 판정

로컬 `output/playwright/firebase-goal/`의 `storage-settings.json`, `translation-settings.json`, `cloud-settings-read.json`, 공지 백업, `snapshot-dry-run.json`, `snapshot-upload.json`, `snapshot-verify.json`, `snapshot-repeat.json`, `performance-before.json` 및 이후 통합 로그가 근거다. 공지 백업에는 초안이 포함될 수 있으므로 공개/커밋하지 않는다.

최종 후보의 로컬 전체 검사·DB-only 동등성·37경로 KO/EN·느린 기기 검색·키보드/저장 복원·SEO/사이트맵 검증을 마쳤다. 성능 결과와 운영 설정의 남은 경계는 위 실행 근거 및 후속 판정에 따른다. 실제 PR/head CI, main 병합, 배포 및 운영 도메인 검증은 그 이후 별도 단계이며 로컬 통과와 구분한다. 현행 main CI는 자동 Vercel 동기화로 이어질 수 있어 배포 승인 전 squash merge를 하지 않는다.


## 현재 완료 범위와 남은 출시 게이트

승인한 reference 자동 발행 workflow는 코드와 회귀까지 준비했다. 같은 저장소·성공한 main push CI·최신 main 확인·Firebase opt-in·공유 동시성·CAS·무변경 no-op 조건을 유지한다. 이전 구현 단계에서는 workflow 실행·원격 secret/변수 등록·PR/main 병합·배포를 하지 않았다. 이후 별도 승인으로 Vercel Production 번역 키 한 개만 등록했으며 Actions secret/변수·backend/source 전환과 배포는 하지 않았다. 로컬 후보 준비와 운영 적용 완료를 구분한다. 운영 적용은 완료로 표시하지 않는다.

1. 번역 TTL 세 정책은 승인 후 생성했고 12:50:36 KST GET에서 모두 `ACTIVE`·추가 지연 0초를 확인했다. 실제 만료 문서 삭제 시점·청구량은 아직 확인하지 않았다. 서비스 계정 권한은 넓히지 않았다.
2. Google 일일 일반 모델 문자 한도 50,000자 적용과 해당 키의 Cloud Translation API 서비스 제한은 콘솔에서 확인했다. 서버 계정의 quota 조회 403은 남아 있으며 예산 알림·실제 과금·한도 소진 동작은 미검증이다. 앱의 하루 25,000자/UTC 예산은 유지한다.
3. 원격 정확한 PR/head CI·Linux/Python 3.11·CodeQL/Dependency Review·실기기/Safari/IME·운영 도메인·다음 수집 발행 주기는 로컬 검사로 대체하지 않는다. 배포 승인 이후의 source SHA→mirror→Vercel→운영 확인도 미실행이다.
4. 첫 서버 프로세스의 홈 전체 HTML 지연과 졸업 HTML 크기, 늘어난 모바일 요청 수는 운영 성능·비용 관찰 및 최적화 검토 항목이다. 실제 사용자의 CWV/INP와 청구량은 아직 확인하지 않았다.

앞선 통합 검증의 로컬 소스는 b4ae09d, 실행 build는 sQ87eW7dblv9HLwQme7fQ다. 이후 기능 후보와 새 검사·실제 데이터 최신성 판정은 [배포 전 진행 상태](PRE_RELEASE_PROGRESS_2026-10-27.md)를 따른다. 상세 근거는 Git 제외 output/playwright/firebase-goal/의 validation-node24-results.json, final-build-artifacts-after-cls.json, english-cls-final/final-verification.json, flows/latest-search-return/early-search-regression-latest.json, performance-comparison-final.json, cold-warm-performance.json 및 cloud-settings-read.json에 있다. 백업/초안/인증 관련 원시 자료를 공개 저장소로 옮기지 않았다.
