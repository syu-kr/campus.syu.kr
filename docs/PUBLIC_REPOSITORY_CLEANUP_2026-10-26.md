# 공개 저장소 파일·정보 정리 계획

후속: 아래 제작·감사 JSON3개는 원본 해시를 보존해 `data-source/curriculum/`로 이동했다. 나머지 구형 자산은 호환성 확인 전까지 보존한다. [실제 반영·검증 결과](DEPLOYMENT_REMEDIATION_2026-10-26.md)를 먼저 확인하고, 아래 목록은 조사 당시 계획으로 읽는다.

기준: 2026-10-26 / `699d653569eb59d0ccdccfd9b11e41af20e6d782`. **목록 작성만 했으며 삭제·이동·Git 이력 변경은 하지 않았다.** [전체 배포 준비 보고서](PRODUCTION_READINESS_2026-10-26.md)의 PUB-01/02 및 DOC-01에 대응한다.

## 1. 공개 범위부터 구분

| 범위 | 공개되는 것 | 정리 기준 |
| --- | --- | --- |
| Git 저장소 | 추적 소스·데이터·docs·이미지 및 과거 이력 | 개발/기여에 필요한 파일은 유지. 현재 트리 삭제만으로 과거 노출은 사라지지 않음 |
| 웹의 `public/` | 요청 가능한 정적 파일 전체 | UI에서 안 쓰는 파일도 URL로 직접 접근 가능. 웹에 필요한 데이터/이미지와 제작/감사 원본을 구분 |
| 브라우저 번들·HTML·RSC | client import·직렬화 props·`NEXT_PUBLIC_*` 등 | 서버 비밀이나 개인 상태를 포함하지 않음. repo 비공개로 바꾸어도 웹 노출은 해결되지 않음 |
| 배포 mirror | sync workflow가 복사한 소스 | 현재 workflow는 소스 대부분을 복사함. 문서를 옮긴다는 이유로 앱 다운로드가 자동 줄지는 않음 |
| Actions/릴리스/스토어 | 로그·artifact·첨부·스크린샷·APK/AAB | 실제 계정·알림·인증 URL·연락처·secret가 없는지 별도 확인 |

현재 추적 파일 864개. `public/` 72개 13,481,523B, 그중 `public/data/` 25개 11,543,056B. 문서 23개 381,720B, 폰트 98개 3,093,688B, Android 스토어 스크린샷 6개 4,035,396B다. 크기는 Git 객체 압축량·운영 요청량·Vercel 과금이 아니다.

## 2. 출시 전에 공개하지 않을 정보

| 정보/파일 유형 | 이번 확인 | 필요한 마무리 |
| --- | --- | --- |
| `.env.local`, `.env.production` 등 | 현재 추적 없음. `.env*` ignore 및 `.env.example` 예외 있음 | root 전체 압축 업로드 금지. ignored 파일도 zip에는 들어갈 수 있음 |
| 서비스 계정 private key, PEM/JKS/keystore | 현재 추적 목록 및 일부 해당 파일명 로컬 이력에서 발견하지 못함 | 전체 branch/tag/과거 객체와 백업·릴리스 파일을 전용 도구/플랫폼으로 점검 |
| GitHub/OpenAI 형식 토큰·private-key header | 현재 추적 텍스트의 제한된 패턴 검사에서 매칭 0 | 보편적 secret 무검출 증명 아님. 고엔트로피/일반 비밀번호/새 토큰 형식·이력 별도 검사 |
| 관리자 UID 목록·Meet owner/participant token·FCM token·인증 링크 | 코드가 참조하는 이름은 필요. 실제 값은 공개 금지 | 테스트 fixture와 capture·RSC·로그에서 실제 값 여부 확인, 합성 식별자 사용 |
| 실제 문의/제안·룸메이트 내용·이메일·학번·개인 시간표 | 공개 제품 데이터가 아님 | DB export·지원 캡처·테스트 녹화·HAR·추적 로그를 공개 증거에서 제외 |
| 공급자 비공개 원본 URL/헤더·쿠키·server secret | 환경 키 이름/형식만 공개 | 원본 `.env`·curl 전문·네트워크 response/request header 복사 금지 |
| PC 절대경로·개인 작업 내역 | docs의 명확한 `C:/Users`, `C:\Users` 개인 경로는 찾지 못함 | `/features/home/` 같은 정상 repo 경로를 사용자 홈 경로로 오탐하지 않음. 신규 문서도 상대 링크 사용 |

이번 민감 파일 이력 검사는 로컬 refs의 `.env.local`, `.env.production`, `*.pem`, `*.jks`, `*.keystore` 경로에 한정됐고 결과가 없었다. 전체 Git 내용 스캔이나 원격 refs 최신성 확인은 아니다.

비밀 발견 시 우선 폐기·회전하고 필요한 환경을 갱신한다. Git 이력 rewrite는 협업자·fork·mirror·서명/감사 영향이 있으므로 별도 계획과 승인을 거친다. 실제 credential을 보고서/Issue에 재현하지 않는다. GitHub는 전체 Git 이력·여러 협업 표면의 secret scanning을 제공한다. [공식 안내](https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning)

### 공개 값과 비밀값을 혼동하지 않기

Google/Naver/Bing 소유확인 meta, `public/indexnow-key.txt`, Firebase 웹 구성과 VAPID 공개키, Kakao JavaScript 키, Sentry DSN, `assetlinks.json`의 인증서 fingerprint, 앱 ID·운영 도메인은 공개 소비자가 필요한 값일 수 있다. 이를 “키”라는 이유만으로 삭제하지 않는다. 서버 secret과 구분하고, 공개키에 필요한 제한 및 서버 권한 검증을 확인한다. 실제 관리자 UID·private key·인증 토큰은 이 예외에 속하지 않는다.

## 3. 정리 후보: 구형 웹 이미지 17개

현재 추적 텍스트에서 `/images/...` 리터럴 참조를 찾지 못한 후보들이다. 합계 **1,800,686B(약 1.80MB)**. 동적 문자열·외부 사이트·푸시 payload·이전 설치 앱·브라우저 캐시의 사용 여부까지 증명한 것은 아니다.

| 파일 (`public/images/` 아래) | 크기 B | 권장 처리 |
| --- | ---: | --- |
| `syu-campus-brand-badge-v1.png` | 1,051,062 | 가장 큰 후보. 외부 문서/공유 참조와 권리 확인 후 archive 또는 삭제 검토 |
| `syu-campus-app-icon-512.png` | 291,187 | 이전 설치/manifest/알림 사용 확인 후 유예 삭제 |
| `syu-campus-maskable-icon-512.png` | 291,187 | 위와 동일 |
| `syu-campus-app-icon-192.png` | 41,486 | 위와 동일 |
| `syu-campus-apple-touch-icon-180.png` | 37,264 | 기존 홈 화면 아이콘 확인 후 유예 삭제 |
| `syu-kr-logo.png` | 27,653 | 사용처/원저작권 확인 후 유지 또는 정리 |
| `syu-campus-app-icon-512-m3.png` | 14,065 | 중간 U 로고. 새 smile URL 전환·롤백 기간 후 정리 |
| `syu-campus-maskable-icon-512-m3.png` | 13,224 | 위와 동일 |
| `syu-campus-monochrome-icon-512.png` | 10,009 | 이전 설치 호환 확인 |
| `syu-campus-monochrome-icon-512-m3.png` | 7,936 | 중간 시안, 호환 확인 |
| `syu-campus-favicon-48.png` | 3,960 | 과거 공유/브라우저 요청 확인 |
| `syu-campus-app-icon-192-m3.png` | 3,815 | 중간 시안, 호환 확인 |
| `syu-campus-apple-touch-icon-180-m3.png` | 3,515 | 중간 시안, 호환 확인 |
| `syu-campus-notification-badge-96.png` | 1,584 | 발송된 notification의 기존 URL을 고려 |
| `favicon.ico` | 1,150 | `/favicon.ico` 자동 요청 위치와 `/images/favicon.ico`의 실제 사용을 구분 |
| `syu-campus-favicon-48-m3.png` | 1,090 | 중간 시안, 호환 확인 |
| `syu-campus-mark.svg` | 499 | 초기 마크. 새 BrandMark/문서 원본과 사용처 비교 |

현재 사용하는 `*-m3-smile.png`, `syu-campus-notification-badge-96-smile.png` 7개, 승인 A안 SVG 원본과 Android 실제 리소스는 유지한다. `next.config.js`에 `/images` 5일 immutable 캐시와 Next/Image 긴 TTL이 있으므로 같은 URL 내용을 바꾸지 말고 새 경로 전략을 유지한다.

정리 시 확인 순서는 코드/문서/manifest/서비스워커/알림 생성 → 배포 mirror → Android/스토어 → 외부 공개 링크 → 캐시/롤백 기간이다. 이미 다운로드하지 않는 구형 파일을 지워도 현재 첫 화면 LCP가 그 크기만큼 개선되지는 않는다.

## 4. public에서 이동할 수 있는 제작·감사 데이터

| 파일 | 근거·소비자 | 처리 방향 |
| --- | --- | --- |
| `public/data/curriculum-courses-2025-ocr.json` (426,769B) | audit/build/check curriculum scripts가 참조 | 앱 runtime 사용처 전체 재확인 후 `data-source` 또는 검증용 repo 경로 이동 검토. script 경로/테스트 함께 수정 |
| `public/data/curriculum-course-verifications.json` (519,262B) | verified 생성·quality audit·check에 필요 | 검증 출처 유지. 웹 정적 접근 필요성이 없으면 public 밖으로 이동 |
| `public/data/curriculum-courses-2025-audit.json` | 생성/감사 산출물, IndexNow 관련 테스트가 경로를 고려 | build/check/reproduction 의존을 확인하고 public 밖 이동 검토 |
| `public/data/announcement-ai-metadata.json` (3,767,544B) | 서버 공지 요약·일일 발행 계약의 일부 | 큰 파일이라는 이유로 삭제 금지. 필드 최소화/공개 허용·fallback 필요성을 검토 |
| `announcements-events.json`, `announcements-departments.json` | 공모전 분류·AI 생성·IndexNow·크롤러 계약에서 사용 | 전체 공지에서 바로 안 보인다는 이유로 삭제 금지 |
| verified curriculum·graduation rules·sources·holidays·shuttle JSON | 앱 계산·스케줄·실패 fallback 및 원본 검증에 필요 | 사용하는 연도/입학연도와 규칙을 보존. 파일 연도가 지났다는 이유로 삭제 금지 |

`public/data/`의 모든 데이터를 API 뒤로 이동하는 대규모 변경은 이 정리의 기본안이 아니다. 실제 runtime 소비자를 확인한 제작 산출물부터 좁게 이동한다. `.next` 파일 추적·Vercel serverless file tracing·cron 작업 디렉터리가 달라지면 빌드와 운영 크롤러가 깨질 수 있다.

## 5. 문서 통합·기여자용 안내

| 현재 파일 | 문제 | 권장 위치/완료 기준 |
| --- | --- | --- |
| `docs/MAINTENANCE.md` | 홈 4조회·학식/셔틀 제거 등 M3 이전 설명 | 현행 기능·남은 운영 게이트만 유지. 과거 수치 비교는 PERFORMANCE로 연결 |
| `PERFORMANCE.md` | 과거 fixture 결과와 현행 판단 혼동 가능 | 과거 시점/빌드/조건 명시. 최종 후보 새 측정 섹션. 수치·실패·한계 삭제 금지 |
| `docs/DESIGN_UX_AUDIT_2026-10-18.md` | 175KB의 누적 실험·중간 상태 | 현행 UX 가이드에 필요한 결정·회귀·미해결 항목 추출, 나머지는 역사 기록으로 명확히 표시/보관 |
| `M3_SERVICE_IMPLEMENTATION...`, `M3_UI_FOLLOWUP...`, `M3_UI_STATUS_FOLLOWUP...` | 초기 상태가 후속 변경과 다름 | 최종 운영 가이드 한 곳과 날짜별 구현 근거 분리. 최신 Select·로고·7개 열람실 상태 반영 |
| `M3_ACADEMIC_API_MAPPING.md`, `m3-campus-api-integration.md` | 기능별 연결/미검증 정보가 나뉨 | API 운영 표로 연결하고 저장/발송/실기기 미검증 경계를 유지 |
| `docs/UI_DESIGN_GUIDE.md` | 공통 토큰·상태·컴포넌트의 현행 여부 점검 필요 | M3 공통 컴포넌트/정상 격자 예외/포커스/모션·reduced motion·화면별 폭 문서 |
| `docs/SEARCH_INDEXING_GUIDE.md` | 기존 SEO 지침과 현행 OG/언어/FAQ 변화 반영 필요 | 검증된 사실·공식 기준·검색 콘솔 절차 유지. FAQ 리치 결과 보장 등 오래된 기대 제거 |
| `README.md`, `docs/README.md`, `DEVELOPMENT.md`, `CONTRIBUTING.md` | 새 독자가 현행 진입점을 찾을 수 있어야 함 | npm 버전·환경 예제·설치·read-only 검사·쓰기 명령 구분·운영 경계 연결 |
| `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` | 도구별 중복 가능 | 공통 기여 규칙은 한 곳으로 연결. Next가 재생성하는 AGENTS 블록은 무조건 삭제하지 않음 |
| `docs/design/pea-logo/green-*.svg` | 미선택 B안 | 디자인 결정 기록으로 보관할 가치 평가. 제품 배포 payload가 아니므로 성능 이유로 삭제하지 않음 |
| `docs/design/pea-logo/blue-*.svg` | 승인 A안 원본 | 유지. 재생성·픽셀 검증·권리 근거에 필요 |

새 보고서 3개도 영구적인 중복 운영 가이드가 되지 않도록 한다. 출시 종료 시 완료/수용/미완료 상태를 확정하고, 반복 사용하는 절차는 기존 운영 가이드로 합친 뒤 이번 보고서는 날짜별 근거로 남긴다.

## 6. 유지할 파일 — 삭제하면 기능/검증/권리가 깨짐

- `package-lock.json`, `package.json`, `requirements.txt`, config·rules·index·workflow·코드·회귀 테스트·합성 fixtures.
- `vendor/brace-expansion-compat`, `vendor/eslint-root-glob`: package override/의존이 있으므로 일반 vendored 잔해로 분류하지 않는다.
- `public/indexnow-key.txt`, `public/robots.txt`, `public/manifest.json`, `public/.well-known/assetlinks.json`.
- `public/service-notices/*.md`: 실제 공지 페이지·sitemap·약관 이전 본문/고지와 연결된다. “옛 공지”라는 이유로 삭제하지 않는다.
- `LICENSE`, `NOTICE.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, 폰트 LICENSE·글리프/생성 설명. 학교/제3자 데이터는 루트 MIT와 권리 범위가 다르다.
- `twa-android/gradle/wrapper/gradle-wrapper.jar`: 재현 빌드 입력이다. 바이너리라는 이유만으로 삭제 금지. 서명 키/APK/AAB와 구분한다.
- 국가/언어·서비스 설명·복구 문구·개인정보처리방침의 필수 내용. “화면이 길다”는 이유로 제거하지 않는다.

## 7. 이미 Git에서 제외된 로컬 산출물

`.next/`, `node_modules/`, `output/`, `.playwright-mcp/`, `.cache/`, `.venv/`, 환경 파일, 로그, Android keystore/build artifact가 ignore되어 있다. 현재 `campus-m3-preview.html`은 추적 목록에 없으며 이전 시안 서버 전체가 이 프로젝트에 함께 배포된다고 볼 근거는 없다.

공개 PR에 원본 HAR·trace·HTML·스크린샷·DB export를 추가하지 않는다. 필요한 증거는 개인정보를 제거한 요약·재현 조건으로 남긴다. 로컬 디스크 정리를 요청받더라도 env·현재 작업·복구 증거를 먼저 확인하며, 공개 저장소 정리와 로컬 파일 삭제를 같은 작업으로 취급하지 않는다.

## 8. 라이선스·공개 데이터 검토

[NOTICE.md](../NOTICE.md)는 여러 학교 데이터의 서면 재배포 허가를 미확인으로 기록한다. 이를 “공개 사이트에서 가져왔으니 문제없음”으로 바꾸지 않는다. 학교 공지·전화번호·식단·요람 가공본·지도·브랜드 각각의 출처, 허용 범위, 유지/삭제 요청 경로와 실제 재배포 대상을 검토한다. 이번 문서는 권리 허가나 법률 준수의 확인서가 아니다.

- 공개 업무 연락처와 실제 사용자가 제출한 개인정보를 구분한다.
- 공지 본문/첨부에 개인 연락처·명단 등이 있을 수 있으므로 수집/배포 최소화·삭제 반영 절차를 확인한다. 현재 모든 공지의 개인정보 전수 검사는 하지 않았다.
- 화면 출처·비공식 서비스 고지·삭제 요청 연락처를 유지한다.
- 운영 검증 과정의 메일 주소·키·식별자는 공개 보고서에 넣지 않는다. 공개 연락 창구는 의도된 운영 정보인지 확인한다.
- Android store screenshot 6개는 M3 전 UI다. 스토어 출시 시 실제 화면으로 교체하고 개인정보를 가린다. 현재 원본을 검토 없이 삭제하지 않는다.

## 9. 실행 순서와 완료 기준

1. **재현 가능한 목록:** 최신 후보 SHA·추적 파일·크기·referencer 목록 확보. 전체 이력·원격 refs·artifact 보안 점검 결과는 비공개 보관.
2. **즉시 조치 대상:** 확인된 비밀/개인정보가 있다면 노출 회수·credential 회전부터 진행. 현 단계에서 발견되지 않은 비밀을 있다고 가정해 임의 회전하지 않는다.
3. **공개 불필요 산출물:** public 밖 이동 후보의 runtime/script/CI/IndexNow/file tracing 소비자 확인, 좁은 단위로 경로 수정·검증.
4. **구형 자산:** 기존 설치/알림/외부 참조와 rollback 기간 확인 후 제거. 삭제 후보 목록과 실제 승인 삭제 목록을 분리.
5. **문서:** 현행 설치/기여/운영 문서 연결, 과거 기록의 시점 표시, 링크 깨짐·개인 경로·민감값 점검.
6. **회귀:** `check:unused`, 전체 타입, 관련 테스트, `check:twa`, curriculum/check·최적화 빌드. 제거한 asset 요청 404 회귀·로고/공유/기존 설치 확인.
7. **PR 검토:** 삭제 이유·기능 영향·권리/정보 경계·복구 방법을 명시. 파일 수/용량 감소와 첫 화면 성능 개선을 별도 보고.

전체 Git 이력 정리·원격 브랜치 삭제·기존 앱 자산의 즉시 제거는 이 문서 작업의 승인 범위에 포함하지 않는다.
