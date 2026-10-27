# 배포 전 진행 상태와 남은 작업

기준: 2026-10-27 KST. 이번 범위는 **병합·배포 없이 릴리스 후보를 검증하고 정리하는 작업**이다. 기존 선택지·검색 조건·검증·목록 복귀·저장 계약과 비활성 기능을 유지한다. [전체 이전 실행 기록](FIREBASE_MIGRATION_IMPLEMENTATION_2026-10-26.md), [출시 체크리스트](RELEASE_CHECKLIST_2026-10-26.md)에서 과거 실행과 운영 절차를 확인한다.

## 현재 판정

| 항목 | 확인한 상태 | 남은 확인 |
| --- | --- | --- |
| 기능 소스·빌드 | 졸업 보완 기능 커밋 `d59a00dd7bb418724e409fd07f4a43cdd7ffaed4`, 최종 로컬 build `htH-qdrTGfa4sdnE2dBOj`. 빌드 뒤 기능 파일이 같은 상태임을 대조 | 문서 후속 commit을 포함한 실제 PR head는 PR Checks에서 확인 |
| 신규 의존성 감사 | Node 24.22.1·npm 10.9.4의 npm 감사 취약점 0, Python 3.12.14의 8개 해석 의존성 감사 취약점 0 | CI Python 3.11·Dependency Review와 구분 |
| 소스 검사·빌드 | lint·type-check·i18n·TWA 정적·unused·Python·졸업·교육과정·crawl dry-run의 9단계와 최적화 빌드 성공 | 전체 단위 검사 첫 실행의 timeout 1건과 Linux CI를 아래와 같이 별도 판정 |
| 단위 검사 경계 | 전체 220파일·1,935테스트 중 1,934성공·1실패. 이후 원래 제한의 focused 2파일 15테스트 성공 | 첫 전체 실행을 통과로 바꾸지 않음. 최종 PR head의 Linux 전체 검사 확인 |
| 졸업 자료·화면 | 참조 JSON 직렬화 46.11%·한국어 raw HTML 44.85% 감소. KO/EN×1440/390px의 저장·취소/복귀·검수 과목 선택·재방문·SEO 표본 성공 | 실제 사용자 속도·번역 품질·실기기 검증과 구분 |
| 공개 데이터 | 활성 Firebase 23파일 검증 성공. 현재 Pages 일일 9파일과 차이를 확인하고 기존 CLI의 읽기 dry-run 성공 | 기존 활성 version/revision 유지. 출시 직전 최신성 재확인과 승인된 자료 반영 필요 |
| 원격 PR·CI | 원격 점검 당시의 미게시 결과는 아래 시각 있는 기록으로 보존 | 게시한 PR의 최신 head에서 필수 검사 4개를 읽어 판정. 이 문서의 정적 대기/성공 표기를 근거로 쓰지 않음 |
| 병합·배포 | 미실행. 사용자 별도 승인 후 Vercel Production 번역 키 한 개만 등록. 운영 앱·Actions 변수/secret·backend/source 플래그는 변경하지 않음 | 별도 출시 승인과 운영 확인 단계 |

이 표는 이번 후속 검증의 완료 범위와 남은 게이트를 구분한다. 문서의 정적 기록으로 원격 CI의 실시간 결과를 대신하지 않으며 과거 성공 수치와 새 후보의 검사를 섞지 않는다. 신규 실행 근거는 Git에서 제외되는 `output/playwright/firebase-goal/pre-release-20261027-*`에 보존한다.

## 이미 확보한 근거

- 서비스 공지 원문 19개·검수 영문 18개, 공개 자료 23파일의 Firebase 복사·동등성·반복 no-op 검증과 snapshot 시험 전환/복구를 마쳤다. 원본 MD·유효 fallback은 보존한다.
- 앞선 기능 후보의 Node 24 전체 218파일·1,922테스트, 37경로×KO/EN×1440/390px의 148뷰와 별도 기능·SEO 검증은 [이전 실행 기록](FIREBASE_MIGRATION_IMPLEMENTATION_2026-10-26.md)에 있다. 이번 추가 코드의 새 검증을 대신하지 않는다.
- 번역 TTL의 `public_content_translation_fields`, `public_content_translations`, `public_content_translation_usage`는 `expires_at`·추가 지연 0초다. 12:50:36 KST API GET 200·`ACTIVE` 및 콘솔 제공 중 상태를 확인했다.
- Google Translation 일반 모델의 프로젝트 일일 문자 한도를 무제한에서 50,000자로 적용했다. 새로고침 후 23개 한도를 비교해 나머지 22개는 동일했다. 앱의 25,000자/UTC 예산은 유지한다.
- 서버 계정의 quota 메타데이터 조회 403은 유지한다. 콘솔에서 완료한 한도 설정과 앱 번역 성공을 이 읽기 권한과 혼동하지 않으며, 이를 없애기 위한 새 IAM 권한은 부여하지 않는다.

## 이번 추가 보완의 검증 결과

전체 검사 첫 실행에서는 기존 `eslint-root-glob.test.ts`의 ESLint 자식 프로세스가 원래 10초 제한을 넘었다. 220파일·1,935테스트 중 1,934성공·1실패 원결과를 보존했다. 분리한 첫 6테스트와 동일 원본을 사용한 60초 진단도 실패했고, 이후 단계별 진단 5.728초·원본 4.337초 실행은 성공했다. 최종적으로 **원래 제한을 그대로 둔** ESLint 6개와 신규 졸업 9개, 2파일 15테스트가 성공했다. 제품 코드나 테스트 timeout을 늘려 통과시키지 않았다. 간헐 지연의 원인은 확정하지 않았으며 Linux의 정확한 PR head 전체 검사로 다시 판정한다.

졸업 기능의 앞선 focused 4파일 53테스트와 위 15개는 중복 범위가 있어 합산하지 않는다. 최종 Chromium QA는 KO/EN×1440/390px의 4개 context에서 다음을 확인했다.

- 초기 화면·2024년 저장값 복원, 초기화 취소·Escape 초점 복귀, 확인 후 초기화.
- 2026년 검수 과목 ‘인성과사회’ 2학점 선택과 reload 후 저장값 복원.
- 초기/최종 가로 넘침·pageerror·native confirm 각각 0. 검수 과목 대표는 HTML에 있고 미검수 과목 대표는 전달되지 않음.
- 4개 SEO 표본의 lang·canonical·title·OG title/image와 JSON-LD 2개씩 파싱 성공. 한국어 raw HTML 628,733B, 영어 711,496B.

QA의 영어 번역 POST 8개는 클라이언트에서 외부 공급자 호출 전에 차단했고 그 외 업무 변경 요청도 없었다. 이 결과를 실제 Google 번역 품질·속도 성공으로 계산하지 않는다. 소유 QA 서버는 정상 종료했다.

### 응답 크기와 cold/warm 성능

전후 각각 4경로×5쌍, 40 HTML 응답·20개 소유 서버 프로세스로 측정했다. 합계 80응답·40프로세스에서 HTTP 200·대상 build 일치를 확인했고 모두 정상 종료했다.

| 측정 대상 | 전→후 | 판정 |
| --- | --- | --- |
| 졸업 참조 JSON 직렬화 | 990,894→533,987B | 456,907B·46.11% 감소. 네트워크 압축 전송량 아님 |
| 졸업 raw HTML | 1,139,982→628,733B | 511,249B·44.85% 감소 |
| 졸업 전체 HTML 중앙값 | cold 2,693→2,928ms, warm 84→69ms | cold 지연 잔존. 크기 감소를 속도 향상으로 바꾸어 표현하지 않음 |
| 홈 전체 HTML 중앙값 | cold 4,815→5,217ms, warm 53→53ms | 첫 서버의 약 5초 위험 유지 |

이번 비교에서 제안 회귀 기준인 **20% 이상이면서 200ms 이상 악화**를 동시에 넘은 항목은 없었다. 전측정 초기에 focused 검사와 중첩한 구간이 있었고 provider/OS cache도 초기화하지 않았다. 후측정에는 큰 검사·CI·빌드를 겹치지 않았지만 소량의 읽기 전용 자산 검사는 있었다. 이 조건에서 Firebase나 축소 코드의 인과적 속도 효과를 단정하지 않는다. 실제 LCP·INP·운영 과금은 별도다.

### 빌드 산출물의 제한 검사

브라우저 JS는 73파일·2,392,313B로 확인했다. 검사한 서버 민감 값의 10개 표현 exact 일치와 선택한 시안/개인 PC 경로 패턴 일치는 0이었다. 서버 NFT 83개·항목 89,762개에서 검사 대상 민감 경로 일치도 0이었다. 대표 3개 trace에는 fallback JSON 22개씩과 졸업 관련 5개가 포함돼 기존 장애 복구 경로를 유지했다. 이는 한 페이지 전송량이나 전체 secret·개인정보·권리 감사가 아니다.

## 공개 데이터 최신성 — 전환 전 P0

읽기 전용 `--verify`로 Firebase 활성 `firebase-migration-20261026`·revision 3의 23파일을 검증했고 활성 포인터는 바꾸지 않았다. 그러나 최신 Pages 성공본 `20261026235322659-40422689760.1`는 Firebase 활성본 발행보다 약 9시간 50분 뒤의 자료였다. 일일 9파일의 해시는 일치 0개였고 출처 상태도 9개 모두 달랐다. 따라서 파일 무결성 통과와 최신성 통과는 다르다.

Git 제외 staging에 최신 Pages의 일일 9파일을 크기 상한·SHA·schema 검증 후 준비했다. 이 사본과 기존 CLI의 `--dry-run --read-remote --scope daily`를 사용한 결과는 **23파일·11,450,989B 성공**이다. 일일 9파일은 Pages와, 변경하지 않는 14파일은 Firebase와, 일일 출처 상태 9개는 Pages와 일치했다. 조회 전후 Pages·Firebase 포인터도 각각 동일했다.

이 과정의 upload·publish·activate는 0회다. 사본을 준비했다고 실제 활성 데이터가 최신화된 것은 아니며 이 사본을 영구적인 최신본으로 취급하지 않는다. 출시 직전에 두 포인터·manifest/hash·출처 상태를 다시 읽고, 승인된 자료 반영/출시 단계에서 변경 범위를 확인한 뒤 처리한다. backend/source 플래그를 먼저 전환해 묵은 snapshot을 최신인 것처럼 서비스하지 않는다.

## 원격 검증과 배포 경계

2026-10-27 12:58–13:02 KST 읽기 점검에서 `syu-kr/campus.syu.kr`의 원격 main은 `6d95a0f227f26150573d65162425f8f6423ca674`였다. 추가 보완 전 후보 `65c530a041b1b1ad292bc6a4f94c993b1c7e0b89`는 원격 commit 조회에서 미발견, 브랜치 ref 미발견, PR 검색 0건, Actions 0건이었다.

13:31 KST origin fetch에서도 main은 같은 SHA였다. 기능 후보 `d59a00d` 기준 main 대비 뒤처진 커밋은 0개, 추가 커밋은 17개였다. 이 역시 출시 직전 최신성 재확인을 대신하지 않는다.

기존 main의 [CI 40249317038](https://github.com/syu-kr/campus.syu.kr/actions/runs/40249317038)와 [CodeQL 40249316979](https://github.com/syu-kr/campus.syu.kr/actions/runs/40249316979)는 성공했다. 이는 현 후보 검증 결과가 아니다. [활성 main 규칙](https://github.com/syu-kr/campus.syu.kr/rules/17611548)은 최신 base, 리뷰 대화 해결과 다음 필수 검사를 요구한다.

| 필수 검사 | 실행 환경·범위 | 판정 기준 |
| --- | --- | --- |
| Audit and Check | Ubuntu·Node 24.22.1·npm 10.9.4·Python 3.11, npm/pip 감사와 전체 check | 최종 PR head에서 성공 |
| Android TWA | Java 17·Gradle, lint·debug build·release bundle·Digital Asset Links 검사 | 웹 중심 출시여도 저장소 필수 검사로 확인. 스토어 출시 성공과 구분 |
| Analyze JavaScript and TypeScript | 저장소 CodeQL workflow | 최종 PR head에서 성공 |
| Dependency Review | base→head 의존성 변경 | 최종 PR head에서 성공 |

legacy commit status가 비어 있는 경우 check-run 결과와 별도로 해석한다. 과거 SHA의 성공·빈 status 배열·현재 main의 성공을 후보의 통과로 표시하지 않는다.

배포 경계는 원격 workflow와 실제 Vercel 설정을 함께 읽어 확인했다.

- 원본 저장소의 feature push 자체는 추적 workflow에서 운영 쓰기·배포를 실행하지 않는다. main 대상 PR은 CI·CodeQL·Dependency Review만 실행하며 Firebase/Google/업무 secret을 명시 주입하지 않는다.
- Vercel sync는 main의 push/manual CI 성공에만 연결되므로 PR CI 완료만으로 mirror에 push하지 않는다. 신규 reference 발행도 같은 저장소·최신 main push·Firebase opt-in 조건이다.
- 원본 저장소의 webhook은 0개, environments는 `copilot`·`github-pages`였다. 최근 30개 deployment는 main의 Pages였으며 확인한 다른 feature PR에 Vercel check/status는 없었다.
- Vercel 콘솔의 `syu-campus` 프로젝트에서 Connected Git Repository는 개인 mirror `singhic/syu-campus`였고 Deploy Hooks는 없었다. Production 화면의 mirror commit은 `35e0e65`로 표시됐다. 이는 신규 후보 배포 확인이 아니며 source SHA→mirror SHA 매핑·최종 deployment 확인은 출시 단계에 남긴다.
- 이번 범위에서 feature 후보 게시·draft PR·원격 검사는 병합·배포와 분리한다. main push·merge·sync 수동 실행·workflow dispatch·backend/source 전환은 실행하지 않는다. 직접 mirror push도 하지 않는다.

## 운영 환경 이름의 사전 확인

최초 읽기 점검에서는 Vercel 프로젝트의 환경 변수 검색을 제출한 뒤 해당 이름의 `No Results`가 표시될 때까지 확인했다. Shared Variables 연결은 0개였다. 당시에는 이름 존재 여부만 확인했으며 값을 열람·등록하지 않았다. 후속으로 사용자의 ‘Production 번역 키만 등록 승인’을 받아 Vercel `syu-campus`의 Production에 `GOOGLE_TRANSLATION_API_KEY` 한 개를 Secret으로 저장하고 새로고침 후 등록 행을 확인했다. 값은 대화·로그에 출력하지 않았다. 재배포·backend/source 전환은 하지 않았으며, 배포된 앱의 설정 반영·키 유효성·실제 번역 성공은 아직 검증하지 않았다.

| 이름 | 현재 확인 | 출시 전 필요한 일 |
| --- | --- | --- |
| `GOOGLE_TRANSLATION_API_KEY` | 최초 Project/Shared에는 이름 없음. 후속 사용자 승인 후 Production Secret으로 한 개 등록하고 새로고침 후 행 확인 | 새 배포의 설정 반영·키 유효성·실제 공개 문구 번역은 미검증. 실패 시 원문 복구 동작 유지 |
| `PUBLIC_DATA_BACKEND` | 이름 없음. 기본은 `pages` | Firebase 전환 시 `firebase`를 build/runtime 모두에 반영하고 새로 빌드. 값 등록만으로 현재 앱이 전환됐다고 표시하지 않음 |
| `SERVICE_NOTICES_SOURCE` | 이름 없음. 기본은 `hybrid` | DB-only 대조·게시 중단/복귀 흐름을 확인한 뒤 `database` 전환을 출시 설정에 포함 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | All Environments 등록 행 존재 | 값의 대상·권한은 별도 확인. 현재 이름 존재만으로 프로젝트 동등성이나 성공 연결을 단정하지 않음 |
| `PUBLIC_DATA_STORAGE_BUCKET`, `MANAGED_CONTENT_STORAGE_BUCKET` | 이름 없음 | 선택 override이므로 누락 자체는 결함이 아님. 기존 bucket fallback이 적합하면 추가 불필요 |
| `ADMIN_UIDS`, `RATE_LIMIT_SECRET`, `FIREBASE_SERVICE_ACCOUNT` | 이름 존재 | 실제 값의 유효성·허용 UID 동등성은 미확인. 운영/테스트 인증 조회와 권한 거부를 해당 환경에서 확인 |
| `CONTENT_TRANSLATION_DAILY_CHARACTERS` | 별도 변경 없음 | 앱의 기본 25,000자/UTC 예약 한도 유지. Google 50,000자 한도와 별개 |

위 표는 배포된 앱의 설정 반영이나 값/키 유효성·실제 번역 성공을 뜻하지 않는다. 번역 키 한 개 등록은 완료했고 source/backend 두 플래그는 아직 전환하지 않았다. 다른 환경이나 변수는 자동 등록하지 않는다. GitHub Actions 쪽의 backend·bucket 변수 및 기존 서비스 계정 secret 등록 상태도 Vercel의 이름 존재와 별도로 확인한다. 비밀값·관리자 식별자·원시 환경 자료는 공개 문서에 넣지 않는다.

## 남은 작업과 완료 기준

| 우선순위 | 작업 | 현재 진행 범위·완료 기준 |
| --- | --- | --- |
| P0 | 최종 후보의 원격 전체 검사 | 로컬 9단계·빌드·수정 화면 검증은 완료. 전체 단위 첫 실행의 timeout은 focused 성공과 분리해 남기고 Linux의 정확한 head 전체 검사로 판정. 코드가 바뀌면 영향 범위를 다시 확인 |
| P0 | 원격 PR 검증 | 최종 기능/문서 커밋·원본 feature 브랜치 게시·draft PR 이후 위 4개 check를 정확한 head에 대조. main 최신성·충돌·미해결 리뷰는 출시 직전 재확인 |
| P0 | 운영 환경 전환 준비 | Production/Preview와 Actions의 대상 프로젝트·bucket·공개 build-time 값·서버 비밀·backend/source 플래그를 항목별로 확인. 승인한 Production 번역 키 한 개 외 추가 등록·플래그 전환은 미실행 |
| P0 | 데이터 최신성·복구 계획 | 현재 Firebase 검증은 성공했으나 Pages 일일 9파일·출처 상태가 모두 달랐다. 읽기 dry-run과 검증 사본 준비만 완료. 출시 직전 재확인 후 승인된 자료 반영·복구 범위를 확정. 발행·포인터 전환은 미실행 |
| P0 | 공개 저장소 확인 | 새 빌드의 제한된 민감 값·경로/시안 패턴 검사와 fallback tracing 확인 완료. 최종 diff·기여/라이선스/개인정보 검토는 별도이며 제한 패턴 무검출을 전체 감사로 표현하지 않음 |
| P1 | 성능 잔여 위험 | 졸업 JSON·raw HTML 축소는 확인. 홈 cold 약 5초·졸업 cold 지연·모바일 요청 수의 운영 위험은 유지. 관측 비교와 실제 사용자 LCP/INP·과금을 구분 |
| P1 | 영어 학사 용어 품질 | 실제 공개 문구의 용어 표본 검토. 전체 화면 mock 번역 성공과 실제 번역 품질을 구분하며 개인 입력은 번역하지 않음 |
| 수동 | 실기기·브라우저 | Safari/Firefox·Android/iOS 가상 키보드·IME·스크린리더·OS 확대, 기존 설치 PWA의 저장/공유/알림 복귀 확인. 자동 Chromium 결과로 대체하지 않음 |
| 수동 | 실제 외부 연동·권리 | 출시 도메인의 지도·쿠키/CSP·허용 도메인·로그인·문의 접수/관리자 확인·공유와 발송 검증의 대상/정리 범위 확정. 제3자 데이터·자산 권리 및 삭제 대응은 운영자가 확인 |
| 승인 후 | 병합·배포 | 출시 승인 뒤 main 새 SHA의 CI→mirror→Vercel→운영 sourceSha/API/SEO/OG/사이트맵을 연결. 이번에는 수행하지 않음 |
| 출시 후 | 운영 관찰 | 다음 정상 수집·발행/복구 주기, TTL 실제 삭제·청구량·번역 예약량/429·Sentry 수신·실제 CWV/INP 확인 |

TTL 실제 삭제 시험·한도 소진·과금 실험을 수행하지 않았다는 이유로 파괴적인 추가 시험이나 광범위 IAM 확대를 선행조건으로 만들지 않는다. 예산 알림·비용 관찰은 운영자가 별도로 확인할 항목이다. 기존 셔틀 공급자 장애는 정적 시간표·재시도 동작과 분리해 남긴다.

## 환경·데이터 전환 전에 확인할 순서

1. [환경 등록 계약](ENVIRONMENT_REGISTRATION.md)의 Production/Preview·Actions 표를 대조한다. `PUBLIC_DATA_BACKEND`는 build/runtime에 같은 값이 필요하며 로컬 env가 운영에 자동 반영되지 않는다. Preview에는 운영 서비스 계정을 복사하지 않는다.
2. [공개 데이터 운영](PUBLIC_DATA_FIREBASE.md)에서 읽기 전용 `--inspect`·`--verify`와 쓰기 명령을 구분한다. 이전 후보 `firebase-migration-20261026`·revision 3을 영구적인 최신 자료라고 가정하지 않고 출시 시점의 version/hash를 확인한다.
3. 이전 정상 앱의 source/mirror/deployment, 활성/복구 데이터 version과 환경값의 복구 대상을 확보한다. 원본 공개 자료·옛 앱 자산은 [공개 저장소 정리 계획](PUBLIC_REPOSITORY_CLEANUP_2026-10-26.md)의 호환성 확인 전 삭제하지 않는다.
4. 별도 승인한 출시 시점에 [출시 체크리스트](RELEASE_CHECKLIST_2026-10-26.md)의 순서로 진행한다. 앱 rollback만으로 DB·데이터 활성 버전·환경이 복구됐다고 표시하지 않는다.

코드·데이터·원격 설정·배포 증거가 모두 필요한 전체 출시 완료와 이번 로컬/PR 준비 완료는 별개다. 운영 환경이나 외부 검증이 남아 있으면 항목과 근거를 남기고 전체 출시를 완료로 표시하지 않는다.
