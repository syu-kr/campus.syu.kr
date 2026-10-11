# 일일 크롤링 데이터 GitHub Pages 운영

## 목적

일일 공지·행사·학과 공지·학식·공휴일·AI 메타데이터를 애플리케이션 소스와 분리해 GitHub Pages 아티팩트로 게시합니다. 공개 저장소에 포함된 GitHub Pages와 표준 `ubuntu-latest` Actions runner만 사용하므로 Google Cloud/Firebase Storage 결제 계정, bucket, service account나 GitHub larger runner가 필요하지 않습니다.

일일 갱신은 `main` 커밋, 애플리케이션 CI, 개인 배포 저장소 동기화, Vercel 배포를 발생시키지 않습니다.

## 데이터 구조

```text
GitHub Pages artifact
├── .nojekyll
├── index.html
└── crawl-data/
    ├── current.json
    └── versions/
        ├── <current-version>/
        │   ├── manifest.json
        │   └── 9개 JSON
        └── <previous-version>/
            ├── manifest.json
            └── 8~9개 JSON (공휴일 도입 전 버전 포함)
```

`current.json`은 `version`, `publishedAt`, 9개 파일의 상대 경로·크기·SHA-256, `retainedVersions`와 optional `sourceHealth`를 포함합니다. 학사·학교생활·장학·행사·학과·SW 공지 6개, 학식·공휴일·AI 메타데이터 3개입니다. 공휴일이 없는 기존 8개 파일 manifest도 조회·복원·롤백할 수 있습니다. 현재 버전과 이전 버전을 합쳐 최대 7개를 한 아티팩트에 보존합니다. 버전 경로는 immutable이고 Pages 배포 전환은 아티팩트 단위이므로 미완성 아티팩트가 노출되지 않습니다.

운영 base URL:

```text
https://syu-kr.github.io/campus.syu.kr/crawl-data
```

## 최초 활성화

1. GitHub 저장소 `Settings -> Pages`로 이동합니다.
2. `Build and deployment`의 Source를 `GitHub Actions`로 선택합니다.
3. `Actions -> Daily Crawl ... -> Run workflow`로 최초 실행합니다.
4. deploy job이 성공한 뒤 아래 응답을 확인합니다.

```bash
curl -i https://syu-kr.github.io/campus.syu.kr/crawl-data/current.json
curl -i https://campus.syu.kr/api/crawl-data/cafeteria-menu.json
```

앱 API 응답의 정상 원격 source는 다음과 같습니다.

```text
X-Crawl-Data-Source: github-pages
X-Crawl-Data-Version: <current-version>
```

Pages 활성화와 배포에는 별도 Secret/Variable이 필요하지 않습니다. 워크플로가 제공하는 `GITHUB_TOKEN`의 job별 최소 권한만 사용합니다.
공휴일 API 수집에는 기존 시내버스 키인 Actions Secret `PUBLIC_DATA_SERVICE_KEY`와 수집 활성화 Variable `PUBLIC_HOLIDAYS_ENABLED=true`가 필요합니다. 호환되는 앱을 먼저 배포한 후 활성화하는 순서는 [환경변수 등록 가이드](ENVIRONMENT_REGISTRATION.md#공휴일-데이터-활성화)를 따릅니다.
배포용 Actions 아티팩트 보존 기간은 1일이며, 롤백에 필요한 최근 7개 데이터 버전은 현재 Pages deployment 안에 포함합니다.

## 일일 게시 순서

1. Pages에 `current.json`이 있으면 그 버전의 8~9개 파일과 기존 출처 상태를 복원합니다. 기존 버전에 공휴일 파일이 없으면 배포에 포함된 공휴일 기준본을 유지합니다.
2. `npm run crawl:daily`로 7개 출처를 독립 실행하고 공휴일 활성화 시 8개 출처를 실행합니다. AI는 `npm run crawl:daily -- --ai-only`로 실행합니다. 학과 공지 자식 실행 제한은 15분, 나머지 자식은 5분입니다. 수집·준비 job은 70분, 별도 배포 job은 10분입니다. Daily Crawl은 잠금 파일의 최소 Node 요구사항을 만족하는 22.22.2를 사용합니다.
3. 성공 출처는 새 자료를 사용합니다. 종료 실패·불완전 경고·잘못된 출력은 해당 출처 전체를 이전 검증본의 정확한 바이트로 복원합니다. 학과 경고도 학과 출처 전체를 보존합니다. 기준본 검증·복원·상태 저장 실패는 게시를 중단합니다.
4. 결과 JSON을 검증하고 크기·SHA-256 및 출처 상태 manifest를 만듭니다. 내용과 상태가 모두 같으면 배포를 건너뜁니다.
5. 내용 또는 상태가 바뀌면 새 버전과 이전 최대 6개 버전을 포함한 아티팩트를 준비합니다. 모든 출처가 실패해도 검증본과 실패 상태를 게시할 수 있습니다.
6. `actions/deploy-pages`가 완성된 아티팩트를 한 번에 배포합니다.

준비나 배포가 실패하면 이전 Pages deployment가 그대로 유지됩니다. 런타임은 Pages 조회, JSON 파싱, 크기 또는 SHA-256 검증이 실패할 때 배포에 포함된 `public/data/*.json`을 사용합니다.

## 출처 상태 확인

`.cache/crawl-data-health.json`과 manifest의 `sourceHealth`는 파일별 `status` (`fresh`/`stale`), `lastAttemptAt`, optional `lastSuccessAt`·`errorCode`를 보존합니다. 오류 코드는 `CRAWLER_FAILED`, `INVALID_DATA`, `INCOMPLETE_SOURCE`입니다. 게시 시각으로 과거 정상 수집 시각을 추정하지 않습니다. 기존 manifest에 상태가 없으면 이전 성공 시각은 알 수 없습니다.

`/api/crawl-data/status`에서 상태를 조회합니다. 정상 응답은 60초 캐시이며 조회 실패는 503·no-store입니다. 공지·공모전·학식 화면은 관련 출처의 지연 또는 상태 조회 실패를 안내합니다. 자료 API의 기존 JSON 구조는 유지합니다.

식단 전용 실행은 공휴일을 포함한 다른 출처 상태를, AI 비활성화는 기존 AI 자료와 상태를 유지합니다. 재시도 뒤 복구되어도 알려진 학과 경고가 있으면 보수적으로 이전본을 유지할 수 있습니다. 경고 문구가 변경되면 실행기의 불완전 수집 판정을 함께 점검합니다.

## 공휴일 갱신과 운행 안내

전체 실행에서 한국천문연구원 특일정보 API의 `getRestDeInfo`를 하루 한 번 조회하여 한국 시간 기준 올해·다음 해를 함께 저장합니다. 페이지 누락, 잘못된 응답 또는 어느 한 해의 조회 실패가 있으면 기존 `public-holidays.json`을 보존하고 출처 상태를 `stale`로 기록합니다. 파일에는 날짜·공휴일명·출처 링크·실제 수집 성공 시각만 저장하며 API 키는 포함하지 않습니다.

임시공휴일 지정 등 빠른 갱신이 필요하면 `Daily Crawl ... -> Run workflow`에서 `crawl_scope=holidays`를 선택합니다. 로컬에서는 `PUBLIC_HOLIDAYS_ENABLED=true`를 설정하고 `npm run crawl:daily -- --holidays-only`를 실행합니다. 이 실행은 공지·학식·AI 자료와 상태를 보존합니다. 수집 활성화가 꺼져 있으면 공휴일 전용 실행은 중단되며, 전체 실행의 manifest에는 공휴일 출처 상태를 넣지 않아 이전 앱과의 호환성을 유지합니다.

달력·홈·셔틀은 같은 데이터를 사용합니다. 조회 실패·bundled fallback·3일 초과 갱신 지연·대상 연도 누락으로 비공휴일 여부를 확인할 수 없으면 정보 미확인 안내를 표시하고 셔틀 출발 예측은 제공하지 않습니다. 기존에 확인된 공휴일 이름은 유지하며, 공휴일에는 셔틀 기본 운휴와 운행일 시간표를 안내합니다. 학교 출처와 확인 시각이 있는 `closedDates`/`serviceExceptions`는 날짜별 운휴·예외 운행에 우선 적용합니다.

## 롤백

1. 운영 `current.json`의 `retainedVersions`에서 목표 버전을 고릅니다.
2. `Actions -> Rollback Crawl Data -> Run workflow`를 엽니다.
3. `version`에 목표 버전을 입력해 실행합니다.
4. 배포 후 `current.json`과 앱 API의 `X-Crawl-Data-Version`을 확인합니다.

보존 버전과 롤백에는 당시 `sourceHealth`도 함께 유지됩니다. 롤백 게시 시각을 새 정상 수집 시각으로 표시하지 않습니다.

공휴일 도입 전 앱으로 되돌릴 때는 데이터 형식도 먼저 호환되게 되돌립니다. `PUBLIC_HOLIDAYS_ENABLED=false`로 설정한 뒤 현재 publisher로 공휴일 health 키가 없는 데이터를 발행하거나 해당 키가 없는 보존 버전으로 Pages를 롤백하고, 그 다음 앱을 되돌립니다. 변수만 끄면 이미 발행된 `current.json`은 바뀌지 않습니다. 공휴일 수집 장애만 발생한 경우에는 마지막 검증 자료와 `stale` 상태를 유지하며 앱을 롤백할 필요가 없습니다.

로컬에서 같은 아티팩트를 검사하려면 존재하지 않는 출력 경로를 지정합니다.

```bash
npm run rollback:crawl-data -- <version> <output-directory>
```

보존된 7개보다 오래된 버전은 Pages에 남지 않으므로 롤백할 수 없습니다. 장기 보존이 필요하면 비용과 운영 책임을 별도로 승인받기 전에는 확대하지 않습니다.

## 장애 확인

- `Restore current crawl data snapshot` 실패: Pages 응답 상태와 manifest/파일 무결성을 확인합니다. 네트워크·응답 본문 읽기 실패와 HTTP 502·503·504는 총 3회 시도하며 1초·2초 뒤 재시도합니다. 재시도 소진, 다른 HTTP 오류 또는 manifest/JSON/크기/SHA-256 검증 실패는 게시를 중단합니다. 복원 실패를 숨기고 bundled 기준본으로 새 버전을 게시하지 않습니다.
- `Run independent daily crawlers with validated fallback` 경고: 실패 출처와 `/api/crawl-data/status`의 오류 코드·최근 정상 시각을 확인합니다. job 성공만으로 모든 출처가 최신이라고 판단하지 않습니다. 실패한 실행 출처는 Actions warning을 남기며, 자식 시작·종료 로그에는 경과시간, 종료 코드·신호, 시간 제한을 기록합니다. `SIGTERM`과 제한에 도달한 경과시간은 자식 시간 제한을 확인하는 근거입니다.
- 학과 공지는 교육과정 페이지를 한 번 조회해 학과명·단과대학 링크를 함께 해석하고, 단과대학·학과·공지 페이지 진행 로그를 즉시 출력합니다. 학과 수, 검색어, 페이지 범위는 시간 제한을 맞추기 위해 줄이지 않습니다. 15분을 초과하면 검증본과 `stale` 상태를 보존하고 로그의 마지막 진행 단계부터 조사합니다.
- `Prepare versioned Pages artifact` 실패: 생성된 9개 JSON의 파싱 오류 또는 이전 스냅샷 경고를 확인합니다.
- `Deploy crawl data to GitHub Pages` 실패: Pages Source가 `GitHub Actions`인지, environment protection이 배포를 막는지 확인합니다.
- 앱 API가 `bundled-fallback`: Pages `current.json`, 해당 버전 파일, 응답 헤더와 서버 로그를 확인합니다.

일일 데이터 장애 때문에 애플리케이션 배포를 재실행하지 않습니다. 데이터 워크플로만 재실행하거나 보존 버전으로 롤백합니다.
