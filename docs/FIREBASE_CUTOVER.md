# Firebase 데이터 전환 실행 가이드

이 문서는 전환 준비와 실행 조건이다. PR 병합·배포·운영 설정 변경·데이터 활성화·Actions 수동 실행·GitHub Pages 종료를 수행했다는 기록이 아니다. 실제 실행은 담당자가 승인한 점검 창에서 단계별로 진행한다. 작성 기준은 2026-10-30의 코드와 앞선 리허설이며, 문서 작성 중 Cloud 설정을 새로 조회하거나 변경하지 않았다.

상세 계약은 [공개 snapshot 운영](PUBLIC_DATA_FIREBASE.md), [서비스 공지 이전](SERVICE_NOTICE_MIGRATION.md), [환경 등록](ENVIRONMENT_REGISTRATION.md), [TTL·규칙](FIRESTORE_RULES.md), [콘텐츠 번역](CONTENT_TRANSLATION.md)을 따른다. 비밀값·관리자 UID·비공개 공지 백업·원본 로그는 이 문서나 공개 PR에 넣지 않는다.

## 1. 전환 대상과 유지하는 경계

| 대상 | 전환 후 역할 |
| --- | --- |
| 공개 JSON 23파일 | Storage의 불변 version 파일 + Firestore `site_public_data/current` manifest/revision |
| 서비스 공지 | Firestore `site_managed_content`, `SERVICE_NOTICES_SOURCE=database` |
| 관리자 배너·이미지 | 기존 CMS와 서버의 관리형 이미지 경로 유지. 공지 JSON snapshot에 합치지 않음 |
| 공개 콘텐츠 번역 | 서버 Google Translation + Firestore 문구 캐시/사용량, 기존 허용 필드·검증·원문 복구 유지 |
| 일일/만나의집 수집 | GitHub Actions에서 계속 실행하고 결과 저장·활성화를 Firebase로 전환 |
| 월간 참조 자료 | 기존 검토 PR을 유지하고 병합된 최신 main의 CI 성공 뒤 Firebase 발행 |
| Next.js 앱 | Vercel 호스팅 유지. Firebase는 앱 호스팅 교체 대상이 아님 |
| 사용자 선택·시간표·졸업 진행 | 기존 브라우저 저장 키·형식·검색값 유지. 이번에 서버로 이전하지 않음 |
| 실시간 교통·지도·도서관·강의 API | 기존 공급자 연결 유지. 공개 JSON snapshot으로 대체하지 않음 |

### 마지막 확인과 실행 직전 재확인

2026-10-29 리허설에서 Firebase 활성본은 `firebase-migration-20261026`, revision 3, 23파일이었다. 운영 앱은 Pages/번들 자료를 사용했고 `/api/public-data/current`는 404였다. 서비스 공지 원문 19개·검수 영문 18개는 importer에서 unchanged로 확인했다. 이 값들은 **과거 관측**이며 실행할 때 다시 읽는다.

당시 Firebase의 셔틀 참조 자료에는 이후 main에 반영된 가을 온라인 주간 변경이 없었다. 기존 Firebase 활성본이 읽힌다는 이유만으로 최신 자료까지 준비됐다고 판단하지 않는다. 옛 staging이나 과거 Pages version을 그대로 활성화하지 않는다.

기존 읽기 전용 리허설은 23파일 해시·schema, 범위 밖 보존, 불변 버전 충돌, 부분/손상 활성 거부, revision 경쟁, 메모리 rollback, DB-only 공지와 호환 URL을 검증했다. 실제 생산자 쓰기·운영 전환·실기기·실제 TTL 삭제 완료의 증거와 구분한다.

## 2. 병합 전 준비

- [ ] 대상 PR의 최종 head·최신 main·변경 범위·필수 CI와 별도 CodeQL 보안 결과를 확인한다. 분석 job 성공과 보안 결과 판정을 구분하고 새 High가 없는지 대조한다. 병합은 저장소 관리자가 수행한다.
- [ ] `npm run check`와 관련 emulator 통합 회귀 결과를 확인한다. 로컬/CI 자격은 운영 자격과 분리한다.
- [ ] 현재 정상 Production deployment와 source SHA, 앱 환경 복구값의 안전한 보관 위치를 기록한다. 공개 문서에는 비밀값을 복사하지 않는다.
- [ ] Pages current, Firebase current의 version/revision, 보존 버전, 서비스 공지 최신 백업을 확보한다. 이후 관리자가 편집한 데이터를 덮어쓰지 않는다.
- [ ] 실행 중인 Pages writer와 Firebase writer를 겹치지 않게 전환 순서를 정한다. 공유 concurrency 그룹과 CAS는 배포/설정 전환 계획을 대신하지 않는다.
- [ ] `RATE_LIMIT_SECRET`·`PUSH_API_KEY` 등 서버 비밀값의 저장 유형과 적용 범위를 확인한다. 과거 Config 표시만으로 브라우저 유출을 단정하거나 임의 회전하지 않는다.
- [ ] Sentry의 실제 이벤트 수신·scrubbing·IP 보존·source-fetch/TLS 설정을 운영 개인정보 정책과 대조한다. 이번 전환을 이유로 계정/IAM/관측 정책을 묶어 바꾸지 않는다.
- [ ] 점검 공지의 실제 일정·문구·이미지·언어를 검토한다. 완료 시 관리자가 게시를 중단하며 임의의 자동 종료 시간을 새로 넣지 않는다.

룸메이트 등 기존 비활성 기능은 이번 데이터 전환 때문에 켜지 않는다. 원본 Markdown·번들 JSON·Pages workflow·복구 버전은 아직 필요한 호환/복구 경계다. 이번 공개 파일 정리와 데이터 전환 완료 후의 기능 제거를 혼동하지 않는다.

## 3. 자격·버킷·번역 준비 게이트

| 위치 | 설정과 확인 |
| --- | --- |
| Vercel Production | `PUBLIC_DATA_BACKEND=firebase`, 명시한 `PUBLIC_DATA_STORAGE_BUCKET`, `SERVICE_NOTICES_SOURCE=database`를 승인 시 적용. backend는 **build/runtime 양쪽**에 같아야 함 |
| Vercel 서버 | `FIREBASE_SERVICE_ACCOUNT`의 프로젝트·Firestore 조회·대상 Storage 읽기 권한, 관리형 이미지의 `MANAGED_CONTENT_STORAGE_BUCKET` 일치 확인 |
| GitHub Actions | `PUBLIC_DATA_BACKEND`, `PUBLIC_DATA_STORAGE_BUCKET`, 필요한 `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` variables와 기존 `FIREBASE_SERVICE_ACCOUNT` secret의 프로젝트/쓰기 권한 확인 |
| 관리자 | 기존 허용 UID·요청 제한 비밀·로그인 설정을 유지. 비관리자 거부와 실제 관리자 조회를 별도 확인 |
| Preview/Development | 운영 서비스 계정·쓰기 대상·요청 제한 키를 무심코 복제하지 않고 격리된 테스트 대상을 사용 |
| 이미지 버킷 | 서버 IAM으로 필요한 읽기/쓰기만 허용. 브라우저 Storage Rules를 열거나 공개 IAM을 추가해 연결 문제를 우회하지 않음 |
| Google Translation | 서버 전용 `GOOGLE_TRANSLATION_API_KEY`, Cloud Translation Basic v2 제한, 실제 공급자 quota·청구/예산 알림 확인 |
| 번역 앱 예산 | `CONTENT_TRANSLATION_DAILY_CHARACTERS`의 실제 등록값 확인. 코드 기본 25,000자/UTC이며 Google 공급자 일일 한도와 별개 |

버킷 선택은 서버에서 `PUBLIC_DATA_STORAGE_BUCKET` → `MANAGED_CONTENT_STORAGE_BUCKET` → `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` 순이다. Actions workflow는 관리형 버킷 변수를 넘기지 않는 경로도 있으므로 **공개 데이터용 버킷을 명시**해 앱과 생산자의 대상을 일치시킨다. secret 이름의 존재만으로 값·권한 일치를 판정하지 않는다.

번역 TTL은 아래 세 collection group의 `expires_at` Timestamp를 대상으로 한다.

- `public_content_translation_fields`
- `public_content_translations`
- `public_content_translation_usage`

2026-10-29 API 관측에서 세 정책은 ACTIVE였고 표본의 만료값은 Timestamp였다. 응답에서 추가 지연 필드가 생략된 경우 이를 API가 명시적 0초를 반환한 것처럼 기록하지 않는다. 실행 직전 정책 상태·추가 지연 0 설정을 확인하고, 만료 번역의 앱 거부와 실제 비동기 물리 삭제/삭제 건수/비용을 구분한다. 이번 전환 때문에 다른 collection의 TTL·IAM·Rules를 함께 변경하지 않는다.

Google의 과거 콘솔 일일 50,000자 설정은 실행 직전 콘솔에서 다시 확인한다. 서버 계정의 quota 메타데이터 GET은 과거 403이었으므로 최신 설정을 서버 API로 확인했다고 쓰지 않는다. Google 일일 경계와 앱 UTC 예약 경계를 구분하고, 테스트를 위해 한도를 소진하지 않는다.

## 4. 최신 자료 staging과 읽기 전용 재검증

아래는 실행 절차다. 이 문서 작성 중 실행하지 않는다. 저장소 지정 Node/npm과 승인된 서버 환경을 사용하되 환경 파일·비밀값을 출력하지 않는다.

```text
npm run data:snapshot -- --inspect
npm run data:snapshot -- --verify
npm run migrate:service-notices -- --repository-only
npm run migrate:service-notices -- --verify
```

새 ignored staging 디렉터리 안에 다음 세 원본을 구성한다.

1. 하나의 최신 Pages current manifest로 고정한 일일 9파일. 각 byte size·SHA256·schema·sourceHealth를 대조한다.
2. 병합 완료된 정확한 main SHA의 검토된 참조 13파일. 전화번호·일정·꿀팁·셔틀 특별 기간·졸업 참조 등을 포함한다.
3. 최신성을 확인한 만나의집 1파일. 기존 Firebase 버전에서 보존한다면 원본 hash를 대조하고 수집 결과를 실수로 과거 식단으로 되돌리지 않는다.

staging은 `data/`와 `cafeteria/` 구조를 사용한다. 일일 상태 파일은 staging 부모의 `.cache/crawl-data-health.json` 경로로 준비해 해당 sourceHealth가 보존되는지 확인한다. 고정한 원본/버전/해시 목록은 비공개 실행 기록에 보관한다.

```text
npm run data:snapshot -- --dry-run --read-remote --scope all --source-dir <staging-public-root>
npm run migrate:service-notices -- --dry-run --backup <ignored-new-backup.json>
```

`<...>`는 실제 경로/버전으로 대체한다. 백업은 새 `output/` 또는 `.cache/` 파일만 허용되며 부모 폴더를 먼저 만든다. 공지 importer의 create/enrich/conflicts와 기존 편집·게시 중단 보존을 확인한다. 예상하지 않은 차이·충돌·누락이 있으면 다음 쓰기 단계로 진행하지 않는다. 실행할 merge SHA, 고정한 Pages version, Firebase current/revision, 새 snapshot version과 23파일 hash 목록을 하나의 전환 후보로 함께 승인받는다. 코드·원본 포인터·후보 hash 중 하나라도 바뀌면 이전 승인으로 다른 snapshot을 활성화하지 않고 다시 대조한다.

`--pull-current`는 원격 읽기뿐 아니라 로컬 입력 파일을 덮어쓰므로 원본 checkout 대신 격리된 생산자/staging에서 사용한다. `--dry-run`을 문자열 치환해 일괄 apply하지 않는다.

## 5. 승인된 점검 창의 순차 실행

**다음 단계는 모두 이후 운영자의 별도 실행이다. 준비 완료만으로 수행하지 않는다.**

| 순서 | 작업 | 통과 조건 |
| --- | --- | --- |
| 1 | 관리자가 PR 병합 | 최종 head 검사와 리뷰 완료. 정확한 merge SHA 기록 |
| 2 | 기존 운영 모드로 새 앱 배포 확인 | main CI → mirror sync → Vercel Production → 실제 source marker를 같은 merge SHA로 연결. 병합 성공을 배포 성공으로 계산하지 않음 |
| 3 | 점검 안내 확인 | 새 배포에서 실제 홈/공개 페이지 표시·닫기·오늘 숨김·초점 복귀·KO/EN 확인. 관리/민감 경로의 비노출 유지 |
| 4 | 최신 staging 불변 업로드 | 새 version을 사용하고 전체 size/hash/schema 검증. 업로드만으로 active가 바뀌지 않음 |
| 5 | 데이터 활성화 | 직전 current를 다시 읽고 예상 version + revision CAS를 통과한 경우만 전환 |
| 6 | Actions 생산자 설정 전환 | Firebase backend/명시한 버킷 설정. 이전 실행 종료와 새 생산자의 대상·scope 확인 |
| 7 | Vercel 소비자·공지 모드 전환 | build/runtime backend 일치, DB-only notices, 새 빌드/배포. runtime만 바꾸지 않음 |
| 8 | 운영 smoke·생산자 첫 정상 주기 | 아래 검증과 자동 발행의 보존/no-op/버전 확인. 권한 있는 실제 쓰기 테스트는 합성 대상과 정리 범위를 명시 |
| 9 | 완료 판단·점검 공지 중단 | 데이터/기능/자동화 정상과 관측 근거 확인 후 관리자가 내림. Pages는 종료 조건까지 보존 |

4–5단계에서 실행할 수 있는 CLI는 다음과 같다. 실행 직전 current가 달라졌으면 기존 예상값으로 강행하지 않는다.

```text
npm run data:snapshot -- --upload --scope all --source-dir <staging-public-root> --version <new-version>
npm run data:snapshot -- --activate <new-version> --expected-current <current-version-or-none>
npm run data:snapshot -- --verify
```

공지 `--verify`가 이미 정상이고 운영 편집이 보존됐다면 불필요한 재이전을 하지 않는다. 필요한 경우에만 최신 새 백업을 만든 공식 importer `--apply --backup <ignored-new-backup.json>`을 사용하고, conflict 시 중단한다.

GitHub variable을 Firebase로 바꾸면 이후 자동 주기에 실제 쓰기가 가능해지고, 최신 main CI 완료는 **Publish Reference Data**를 자동 유발할 수 있다. 앱 배포와 저장소 설정을 바꾸는 순서를 정한 뒤 적용한다. 승인 없이 시험 삼아 toggle하지 않는다.

## 6. Actions 저장·발행 경로

| Workflow | Firebase 모드의 입력/발행 | 남는 역할 |
| --- | --- | --- |
| `crawl-daily.yml` | active 복원 → 수집/검증 → `data:snapshot --publish --scope daily` | 일일 9파일만 갱신, 나머지 보존 |
| `student-restaurant.yml` | active 복원 → 식단 수집 → `--publish --scope student-restaurant` | 만나의집만 갱신. 성공한 발행/배포 이후 분석 캐시 저장 |
| `crawl-monthly.yml` | `public/data/phone-*.json`, `schedules-*.json` 검토 PR 생성 | Firebase에 직접 쓰지 않음. 검토·병합 경계 유지 |
| `publish-reference-data.yml` | 같은 저장소의 최신 main push CI 성공 → `--publish --scope reference` | 참조 13파일. 같은 자료는 no-op, 오래된 CI는 skip |
| `daily-announcement-notification.yml` | 공용 reader가 Firebase 자료 읽기 | FCM 발송은 별도 기능. 수동 검증은 먼저 `dry_run=true` |
| `indexnow.yml` | 실제 배포 source SHA·active version·Firebase 출처 검증 | 검색 제출은 별도 외부 작업. 먼저 send=false 검증 |
| `rollback-crawl-data.yml` | 예상 current를 요구하는 retained version rollback | 앱/환경/서비스 공지 rollback을 대신하지 않음 |

Actions 자체·소스 저장소·월간 검토 PR·내부 분석 캐시·IndexNow 상태 artifact를 Firebase로 무조건 옮기지 않는다. 전환 대상은 공개 서비스 데이터의 저장/활성화/읽기다. 기존 `public-data-firebase` 공유 concurrency 그룹과 revision CAS를 유지한다.

## 7. 전환 후 판정

- [ ] `/api/public-data/current`가 승인한 active version을 반환하고 23파일의 byte/schema/hash가 일치한다.
- [ ] `/api/public-data/<fileName>`, 기존 `/data/<fileName>`, `/cafeteria/student-restaurant-1.json`이 같은 Firebase version을 읽는다. HTTP 200인 `bundled-fallback`을 Firebase 성공으로 세지 않는다.
- [ ] 공개 응답의 출처·버전·ETag/304와 갱신을 확인한다. 30초 active 캐시, 공개 캐시/SWR와 영구 오설정을 구분한다.
- [ ] 일일 발행은 일일 9파일 밖을, 만나의집 발행은 나머지 22파일을 보존한다. 참조 발행은 검토된 main과 일치하고 재실행은 no-op다.
- [ ] 서비스 공지의 KO/EN 번호·게시일·작성자·제목·요약·본문·링크·원문 언어·페이지 복귀·404·게시 중단을 유지한다. 중단 공지가 Markdown으로 되살아나면 실패다.
- [ ] 홈/목록/상세의 SSR, lang/canonical/hreflang/OG/sitemap가 같은 데이터와 언어 정책을 따른다.
- [ ] 이미지 공개 조회·실제 디코딩·허용 형식·크기·ETag, 관리자 합성 이미지 업로드/정리를 확인한다. 전환 전 실제 쓰기 미검증과 구분한다.
- [ ] English 공개 한글 필드의 실제 번역·반복 캐시·숫자/날짜 보존·원문 복구·한도 오류·귀속을 확인한다. 개인 입력/공유 토큰은 번역하지 않는다.
- [ ] TTL ACTIVE뿐 아니라 만료 Timestamp·앱 만료 거부·비동기 삭제/비용을 관측한다. 실제 테스트를 위해 운영 cache/usage를 무차별 삭제하지 않는다.
- [ ] 기존 선택지·검색 조건·최대 4시간표·localStorage·닫기/오늘 숨김·초점 복귀·오류 복구를 확인한다. 셔틀 특별 기간은 별도 선택지와 자동 선택을 유지한다.
- [ ] Kakao 운영 도메인·쿠키/CSP, Firebase 실제 로그인·비관리자 거부·관리자 쓰기, 합성 문의/공유/Meet의 오류와 복구를 확인한다. 셔틀 공급자 오류를 정적 시간표 실패와 섞지 않는다.
- [ ] iOS Safari·Android·키보드/스크린리더·확대·설치 앱을 확인한다. Android 스토어의 새 출시는 별도 빌드·서명·실기기 검증 범위다.
- [ ] 학사 용어·미검수 졸업 선택지·공개 데이터/이미지 재배포 근거와 삭제 요청 처리 경로를 검토한다.
- [ ] 운영 cold/warm 응답·이미지 LCP·INP·읽기/다운로드·번역 비용을 관측한다. 초기 JS/폰트 비용·간헐적인 공개 snapshot fallback의 추가 분석은 별도 보류 작업이며 로컬 통과를 운영 CWV 합격으로 확대하지 않는다.
- [ ] 첫 정상 수집 주기, 수동 dry-run 알림/IndexNow, 오류 관측과 실기기 검증을 마친다. 운영 발송·유료 호출이 있는 단계는 별도로 범위를 정한다.

## 8. 복구와 Pages 종료

앱 source/deployment, build/runtime 환경, public data active version, 서비스 공지는 각각 다른 복구 대상이다. 이전 앱으로 되돌리는 것만으로 DB나 manifest를 되돌렸다고 판단하지 않는다. 앱 복구 후보에 의존성 보안 수정이 포함됐는지도 확인한다.

```text
npm run data:snapshot -- --rollback <verified-retained-version> --expected-current <current-version>
npm run migrate:service-notices -- --rollback <private-backup.json>
```

첫 명령은 원격 active를 변경하는 실제 쓰기다. 두 번째는 공지 rollback 계획만 읽고, 검토 후 `--apply`를 명시해야 쓴다. 공지 importer는 이후 관리자 편집을 덮어쓰지 않으며 새 충돌은 강행하지 않는다. 복구 후 앱과 데이터의 source/version·언어·기능을 다시 확인한다.

Pages 종료는 아래 조건을 모두 충족한 다음 별도 정리 PR과 승인된 운영 작업으로 진행한다.

1. 일일·만나의집·참조 첫 Firebase 생산자 주기가 실제 성공하고 보존·재실행/no-op가 확인됐다.
2. Vercel 소비자·공지 DB-only·알림·IndexNow가 Firebase를 읽고, 예전 앱/설치 앱/공유 링크의 구주소 의존도 확인됐다.
3. 최신 원본·검증된 보존 버전·앱/환경 복구 경로가 확보됐으며 허용한 관찰 기간 동안 운영 지표가 정상이다.
4. `github.io`, Pages current/versions, `NEXT_PUBLIC_CAFETERIA_JSON_URL`, 외부 공지/README 링크·fallback·rewrite의 남은 의존을 `rg`로 확인하고 호환 정책을 결정했다.
5. 그 후 Pages configure/upload/deploy 단계·`pages: write`/`id-token: write` 등 불필요 권한과 설정을 정리하고 Pages를 종료한다. Actions 수집·월간 검토·Firebase 발행 자체는 유지한다.

공지 Markdown·번들 JSON의 제거는 DB 검증뿐 아니라 CI/빌드·서버 장애 복구·이전 앱 호환 의존이 모두 해소된 다음 판단한다. 논리적 retained 목록은 7개지만 과거 Storage 객체의 자동 물리 삭제는 구현돼 있지 않으므로 활성/복구/구앱 의존을 확인한 별도 정책으로 정리한다.