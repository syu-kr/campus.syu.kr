# 공개 데이터 Firebase snapshot 운영

공개 공지·학식·일정·전화번호·꿀팁·셔틀 시간표·졸업 참조 자료는 원본 JSON 형식을 유지한다. Storage에는 불변 버전 파일을, Firestore `site_public_data/current`에는 활성 manifest와 revision을 저장한다. 서비스 공지 CMS와 비공개 문의 자료는 별도다.

## 데이터와 읽기

`lib/public-data-snapshot.ts`의 고정 허용 목록은 `public/data`의 기존 22파일과 만나의집 `student-restaurant-1.json`이다. 만나의집은 최초 수집 전에는 없을 수 있다. 목록 밖 파일·경로 이동·초과 크기·잘못된 파일별 구조는 거부한다. 일일 9파일에는 기존 schema 검사도 그대로 적용한다. 졸업 참조 자료의 미확정 졸업총량 `0`을 임의의 양수로 바꾸지 않는다.

| 환경변수 | 동작 |
| --- | --- |
| `PUBLIC_DATA_BACKEND` | `firebase`를 명시하면 원격 기본 저장소를 바꾼다. 미설정/`pages`는 기존 Pages·번들 기본 경로를 유지한다. |
| `PUBLIC_DATA_STORAGE_BUCKET` | 공개 JSON용 서버 버킷. 미설정이면 `MANAGED_CONTENT_STORAGE_BUCKET`, 기존 `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` 순으로 사용한다. |
| `FIREBASE_SERVICE_ACCOUNT` | 서버 Storage/Firestore 연결. 브라우저에 전달하지 않는다. |

활성 manifest에는 파일별 경로·SHA256·byte size·출처 상태와 최근 최대 7개의 논리적 보존 버전을 둔다. Storage의 `public-data/versions/<version>/` 파일은 덮어쓰지 않는다. Admin SDK IAM을 사용하며 브라우저 DB/버킷 쓰기를 열지 않는다.

활성 정보는 프로세스에서 30초 재사용한다. 파일은 버전별로 검증 후 제한된 캐시에 재사용한다. 졸업요건의 관련 5파일과 번역 지원 3파일은 같은 manifest로 고정한다. 읽기 실패 시에는 전체 관련 묶음을 검증한 번들로 복구하며 서로 다른 버전을 섞지 않는다. 번들 JSON은 serverless tracing에도 포함한다. 관리 공지의 게시 중단을 원본 MD로 되살리는 fallback과는 별개다.

`/api/public-data/[fileName]`은 허용된 활성 자료를 JSON으로 반환하고 ETag·출처·버전을 제공한다. Firebase 모드 빌드에서는 `/data/<fileName>` 및 `/cafeteria/student-restaurant-1.json`을 이 API로 rewrite해 기존 주소를 유지한다. `/api/crawl-data/`의 기존 상태 메타데이터도 유지한다. `/api/public-data/current`는 Firebase 모드에서만 공개 manifest를 반환한다.

`PUBLIC_DATA_BACKEND`는 비밀값이 아닌 서버 설정이지만 **빌드와 실행 환경 모두에 같은 값**을 적용한다. URL rewrite는 빌드 산출물에 반영되므로 운영에서 runtime 값만 바꾸지 않고 재빌드·배포한다. 이전 상태 복구 때도 앱의 rewrite와 runtime reader가 같은 모드인지 확인한다.

만나의집 UI는 같은 출처의 API를 사용한다. 원격 Firebase 실패 시에는 검증된 번들 또는 기존 설정의 공개 식단 URL을 사용하며, 원래 HTTPS URL·주차·재료 검증을 유지한다. 지도·실시간 교통·좌석·강의의 공급자 API는 이 snapshot으로 대체하지 않는다.

만나의집의 로컬 복구 순서는 기존 `public/cafeteria/student-restaurant-1.json` 우선 → 그 파일이 `ENOENT`이고 Firebase 모드일 때만 서버 전용 사본 `data-source/fallbacks/student-restaurant-1.json` → 두 파일 모두 없으면 기존 공개 URL이다. Pages 모드는 서버 전용 사본을 읽지 않는다. 잘못된 JSON·초과 크기·`EACCES`는 다음 경로로 우회하지 않고 실패하며, 기존 식단 schema·HTTPS URL 검증과 자기 API 재귀 거부를 유지한다. 기존 `public/data` 22파일과 수집기 입력 경로는 바꾸지 않는다.

서버 사본은 `weekStart=2026-10-26`, `updatedAt=2026-10-25T23:43:27.846Z`를 그대로 보존한 정적 장애 복구 자료이며 Weekly가 자동 갱신하지 않는다. 이 사본을 canonical `public/cafeteria/`에 바로 넣으면 Pages 모드에서도 로컬 파일이 설정된 원격 식단 조회보다 먼저 선택되므로 별도 서버 경로에 둔다. 구 `github.io` 직접 요청·기존 앱과 마지막 URL fallback의 Pages 유지 조건은 여전히 확인해야 한다. 새 경로의 실제 배포·serverless 파일 포함·운영 장애 복구 검증은 아직 완료하지 않았다.

졸업 계산 함수는 `lib/graduation-model.ts`에서 전달받은 참조 자료를 사용한다. 기존 `lib/graduation.ts`는 기존 소비자/테스트용 기본 자료 호환 경계다. 실제 졸업 페이지는 서버가 읽은 고정 묶음을 클라이언트에 전달하며 선택지·계산·저장 형식은 유지한다. 서버 초기 HTML에 참조 묶음을 전달하므로 최종 빌드에서 전송량과 첫 진입 성능을 측정한다.

## 리허설과 발행

아래 명령의 기본 dry-run은 로컬 공개 JSON만 읽고 실제 DB/Storage를 사용하지 않는다. 환경 파일을 로그로 출력하거나 저장소에 복사하지 않는다.

```text
npm run data:snapshot -- --dry-run
npm run data:snapshot -- --dry-run --read-remote
npm run data:snapshot -- --inspect
npm run data:snapshot -- --upload --version <new-version>
npm run data:snapshot -- --activate <new-version> --expected-current <current-version-or-none>
npm run data:snapshot -- --verify
```

`--source-dir <directory>`는 `data/`, `cafeteria/`를 포함한 공개 자료 루트를 지정한다. 원본 byte를 보존한 격리 사본으로 최초 이전을 리허설할 수 있다. 기존 활성 버전이 있으면 업로드만으로 공개 읽기를 바꾸지 않는다. `--activate`는 현재 버전 이름을 명시해야 하며, 조회 후 다른 발행이 발생하면 revision CAS로 거부한다.

발행은 모든 파일의 byte size·해시·schema 검사 → 조건부 immutable 업로드 → 저장본 전체 재조회/검증 → 활성 revision 전환 순서다. 부분 업로드·누락·깨진 자료는 활성화하지 않는다. 동일한 업로드의 재개는 허용하고 같은 버전 이름의 다른 내용은 거부한다. 이미 활성인 내용과 일치하면 `--publish`는 새 파일/버전/DB 쓰기를 만들지 않는다.

```text
npm run data:snapshot -- --publish --scope daily
npm run data:snapshot -- --publish --scope monthly
npm run data:snapshot -- --publish --scope reference
npm run data:snapshot -- --publish --scope student-restaurant
npm run data:snapshot -- --pull-current
```

`daily`는 공지 6종·학식·AI·공휴일 9개, `monthly`는 전화번호·학사 일정 2개, `reference`는 월간 자료를 포함한 나머지 13개다. `student-restaurant`는 만나의집만 갱신한다. 선택 범위 밖의 파일은 기존 활성 저장본에서 읽어 새 버전에 그대로 보존한다. 전체 `all` 발행은 원본 전체를 이전하는 경우에 사용하며 다른 관리자의 변경을 덮어쓸 자료가 아닌지 비교한다.

`--pull-current`는 먼저 모든 파일을 검증한 뒤 로컬 생산자 입력을 복원한다. 일반 파일은 `public/data/`, 만나의집은 수집기가 쓰는 **`public/cafeteria/`**로 복원한다. 과거 `public/data/student-restaurant-1.json`이 남아 있어도 수집기의 새 식단을 우선한다. 입력 디렉터리의 파일을 바꾸는 명령이므로 운영 수집 작업이나 격리 사본에서 사용한다.

## 자동 발행과 검토

GitHub `PUBLIC_DATA_BACKEND=firebase`와 버킷 변수·기존 서비스 계정 secret을 운영자가 등록한 뒤 사용하는 코드다. 로컬 구현 완료가 원격 설정·실행 완료를 뜻하지 않는다.

- 일일/만나의집 작업은 Firebase 모드에서 현재 자료 복원 후 해당 scope만 발행한다. Pages 모드는 기존 준비·배포 경로를 유지한다.
- 만나의집 원문 이미지 성공 캐시는 Firebase 발행 또는 검증된 no-op가 성공한 뒤, Pages 모드에서는 배포 또는 준비 단계의 검증된 no-op가 성공한 뒤에만 저장한다. 분석만 끝나고 게시가 실패한 결과를 성공본으로 캐시하지 않는다. 첫 정규 Weekly는 복원한 version/revision을 고정하고 나머지 22파일의 bytes·SHA256·size와 일일 sourceHealth 9개 보존, cache 적중/새 분석/no-op, Pages 단계 skipped, 공개 source/version·식단 원문/날짜/재료를 확인한다. 상세 판정은 [전환 가이드](FIREBASE_CUTOVER.md)의 첫 정규 Weekly 관측을 따른다.
- 월간 수집은 기존 검토 PR을 유지한다. **Publish Reference Data**는 같은 저장소의 최신 main push에 대한 CI 성공과 Firebase 명시 조건을 확인한 후 승인된 참조 자료를 발행한다. 자료가 같으면 manifest의 SHA와 로컬 13파일을 대조하고 추가 Storage 다운로드·업로드·활성 쓰기를 하지 않는다. no-op는 유효한 검증 결과이며 실제 변경 자료의 Reference 쓰기 증거와 구분한다. 실제 검토 자료 변경 후 발행은 별도로 관측하되 이를 위해 비용이나 자료 변경을 강제하지 않는다.
- 자동화는 `public-data-firebase` 동시 실행 그룹과 revision CAS를 함께 사용한다. 재실행/오래된 CI가 최신 참조 자료를 되돌리지 않도록 발행 직전 main SHA도 대조한다.
- IndexNow는 실제 앱 source SHA, 활성 Firebase version 및 응답의 `firebase-storage` 헤더를 확인한다. 만나의집 변경도 홈·학식 fingerprint에 포함한다. IndexNow 수신과 실제 검색 색인은 별도다.
- 알림 `dry_run=true`는 문구 생성 뒤 FCM·Firestore 기록만 생략하므로 OpenAI 비용이 생길 수 있다. 외부 호출 없는 검증은 의존성 주입 회귀를 사용하고 실제 수동 실행은 비용·원격 읽기·발송 범위를 따로 정한다.

Firebase 정상 경로는 Pages를 조회하지 않고 IndexNow의 자료 수집도 Firebase 경로에서 반환한다. Pages 종료 전에는 로컬 식단이 없을 때의 조건부 만나의집 fallback·이전 `github.io` 클라이언트/외부 링크·복구 경로와 운영 관찰 정책을 별도로 확인한다.

## 복구와 보존

```text
npm run data:snapshot -- --rollback <retained-version> --expected-current <current-version>
```

현재 manifest에 보존된 버전만 복구할 수 있으며, 대상의 모든 파일을 다시 검증하고 revision CAS로 전환한다. 원본의 게시 시각을 현재 시각으로 바꾸지 않는다. 앱은 30초 활성 캐시와 공개 응답 캐시를 거쳐 새 버전을 반영한다. 앱 코드·환경·데이터 버전 복구를 따로 기록한다.

물리적인 오래된 객체 자동 삭제는 포함하지 않았다. 논리적 복구 목록은 최대 7개이며 발행 횟수에 따라 교체되므로 보존 기간을 보장하지 않는다. 과거 Storage 객체가 남아 있어도 현재 retained 목록 밖이면 공식 rollback 대상이 아니다. raw 파일·manifest를 검증한 로컬 current 아카이브는 보존 자료이며 실제 운영 rollback 실행 증거가 아니다. 활성/복구 버전과 사용 앱을 확인한 뒤 별도 정리한다. 최초 전환의 실제 대조와 롤백 증거가 확보되기 전에는 원본 public 파일을 삭제하지 않는다.

검증에는 원본 22파일 dry-run, 불변 업로드 재개/충돌, 부분·손상 자료 활성 거부, revision 경쟁, 범위 밖 파일 보존, 수집기 식단 경로 회귀, 기존 졸업 계산·저장·번역·IndexNow 테스트를 사용한다. 실제 버킷/데이터 전환, 리전 간 성능, 최종 빌드 tracing과 운영 자동화 실행 증거는 릴리스 기록에 별도로 남긴다.
