# 출시 전 로컬 보안 경계 검증

이후 팝업·식당 원본 선택의 변경분 27검사와 관리자 enum 입력 오류 수정은 [배포 직전 보완·재검증](PRE_DEPLOY_FIXES_2026-10-27.md)에 기록했다. 아래 113개는 명시된 앞선 소스의 검사다.

기준: 2026-10-27 15:06 KST, 기능 후보 `924f773c355c051c8cd890ae8b806e7d82aede25`의 아래 21개 모듈. 병렬 작업의 배너 CSS/컴포넌트와 알림 workflow 변경은 이 실행의 제품 소스에 포함되지 않는다. 실행 뒤 21개 원본 SHA-256을 다시 대조했고 불일치는 0이었다.

**판정: 지정한 보안 경계의 격리 검사 113개가 모두 통과했고, 이 범위에서 새로 확정한 취약점은 없다.** 전체 저장소 보안 감사, 실제 공급자 인증, 운영 IAM/Rules 또는 새 배포 검증 완료를 뜻하지 않는다. 제품 보안 코드는 수정하지 않았다.

## 범위와 실행 조건

`security-audit`의 소스 중심 지침과 격리 원칙을 적용했다. 신규 관리자 공지·배너·이미지, 공개 영어 번역, Firebase 공개 자료 경로와 버전 전환을 대상으로 했다. 검사를 위해 실제 환경 파일·인증 토큰·서비스 계정·API 키·개인 기록을 읽거나 컨테이너로 전달하지 않았다.

- 부모 측 도구가 선택한 TypeScript 소스 21개만 `transpileModule`로 CommonJS로 변환했다. 대상 모듈의 실행은 컨테이너 안에서만 했다. 전체 저장소나 `node_modules`, 사용자 홈, Docker 소켓은 mount하지 않았다.
- 이미 설치된 `public.ecr.aws/supabase/storage-api:v1.77.5` 이미지의 Node **24.21.0**을 사용했다. 서비스 프로세스는 시작하지 않고 `node`만 실행했다. 이미지 pull·패키지 설치는 0회다. 프로젝트의 정식 Node 24.22.1 빌드/호환성 검사를 이 실행으로 대체하지 않는다.
- Docker `--network=none`, 읽기 전용 root·입력 mount, 비권한 UID/GID 1000, capability 전부 제거, `no-new-privileges`를 적용했다. 컨테이너에서 외부 네트워크 인터페이스 부재와 입력/root 쓰기 실패도 검사했다.
- CPU 1개·CPU 시간 45초, 메모리/스왑 합계 512MiB, PID 64, 열린 파일 128, 단일 파일 8MiB, 쓰기 가능한 scratch tmpfs 32MiB, 전체 실행 제한 60초를 적용했다.
- `/usr/bin/env -i` 이후 `PATH`, `HOME=/scratch`, `TMPDIR=/scratch`, `XDG_CACHE_HOME=/scratch`, `NODE_ENV=test`만 전달했다. 검사 안에서 추가한 인증·버킷·번역 설정은 명시적인 dummy 문자열이다.
- Firebase Auth·Firestore·Storage·Google·Next 응답/캐시 경계는 모의 구현이다. 이미지 디코더는 메타데이터 어댑터를 모의했고 실제 libvips에 악성 파일을 넣지 않았다. 검사 중 공급자 모의 호출은 3회, 실제 외부 호출·클라우드 쓰기는 0회다.
- 컨테이너는 실행 후 제거됐고 해당 이름의 잔존 컨테이너는 없었다. 대상 코드가 작성한 파일을 호스트 결과물로 복사하지 않았다.

재현용 로컬 준비기와 검사기는 Git 제외 경로 `output/playwright/firebase-goal/release-security-20261027-prepare.cjs`, `release-security-20261027/inputs/security-check.cjs`에 있다. 원본 해시는 같은 `inputs/source-hashes.json`에 기록했다. 실행 입력으로 만든 소스 번들은 검사 후 제거하며 준비기를 실행해 다시 만들 수 있다.

## 검사 결과

| 경계 | 사례 수 | 확인한 동작 | 주요 소스 |
| --- | ---: | --- | --- |
| 실행 격리 | 3 | 빈 allowlist 환경, root/입력 쓰기 거부, 외부 인터페이스 없음 | 로컬 검사기·Docker 실행 옵션 |
| 관리자 인증 | 6 | 익명 401, 모의 revoked token 401, 유효하지만 미허용 UID 403, 정확한 UID 허용, allowlist 없음 503, 대소문자 우회 거부. `verifyIdToken(token, true)` 호출 확인 | `lib/server/admin-auth.ts:26` |
| HTTP·요청 제한 | 8 | cross-origin 403, JSON 외 형식 415, 선언/stream 크기 초과 413, 잘못된 JSON 400, 정상 JSON 보존. 운영 secret 미설정 503과 제한 횟수 초과 429, 식별자 HMAC 키 확인 | `lib/server/http.ts:129`, `lib/rate-limit.ts` |
| 관리자 콘텐츠 | 20 | script/data/HTTP/프로토콜 상대/역슬래시 URL 거부, 업로드 이미지 경로 한정, 필수 alt, 잘못된 날짜/기간/수정 번호 거부. 저장과 게시 분리, 오래된 revision 409, 보관 상태 게시 차단, 공개 응답에 초안 제목 미포함 | `lib/server/managed-content.ts:29`, `:143`, `:205` |
| 이미지 입구 | 9 | 0B/5MiB 초과 거부, SVG·HTML·GIF signature 거부, signature/decoded format 불일치·2,500만 픽셀 초과·다중 프레임 거부. 경로 이동 ID 및 저장 MIME 불일치 거부 | `lib/server/managed-media.ts:43`, `:68` |
| 공지 파일 경로 | 21 | `../`, 절대경로, 역슬래시, 인코딩, query/hash, NUL, 비허용 문자를 KO/EN 양쪽에서 거부하고 파일 읽기 0회. 정상 slug는 각 고정 root 안의 `.md` 경로 | `lib/service-notice-repository.ts:77` |
| 번역 입력·캐시·예산 | 14 | 임의 raw text·비공개 종류·경로·잘못된 대상/분류/필드 수 거부. 없는 필드는 공급자 전 거부. 한글 필드만 예약, 숫자 보존, 재요청 추가 예약 0, 만료 캐시 재사용 거부, 예산 초과 전 호출 차단, 실패 시 예약 유지·lease 제거, 순수 영문 호출 0 | `lib/server/content-translation.ts:24`, `:98`, `:130` |
| 공개 snapshot | 12 | allowlist 밖 파일·경로 탈출·잘못된 hash/크기·중복 보존 버전 거부. 저장 bytes의 hash와 파일별 schema 검사, 객체 경로 제한, immutable 생성 precondition 0, stale CAS 차단·정상 revision 증가 | `lib/public-data-snapshot.ts:34`, `lib/server/public-data-storage.ts:39`, `:66` |
| 실제 공개 콘텐츠 선택 함수 | 12 | `hybrid`/`database` 모두 게시본만 상세·번역에 사용. 저장한 비공개 초안 제목/본문 미포함, 게시 중단 뒤 목록·상세·번역에서 제거. 배너 초안·미래 예약 배너·비공개 종류 거부, URL을 ID로 보내도 fetch 목적지로 사용하지 않음 | `lib/serviceNotices.ts`, `lib/server/content-translation-sources.ts:112`, `lib/server/public-managed-content.ts` |
| 실제 route 함수 | 8 | admin 익명/미허용 POST는 쓰기 없이 401/403·private no-store, 익명 이미지 업로드 401, 번역 batch 13개/raw text 거부·미설정 상태에 비밀값 미포함, 공개 파일 경로 404, ETag 재조회 304 | `app/api/admin/content/route.ts`, `app/api/admin/content/media/route.ts`, `app/api/content-translation/route.ts`, `app/api/public-data/[fileName]/route.ts` |
| **합계** | **113** | **PASS 113 / FAIL 0** | |

여기서 route 검사는 실제 route 함수를 실행하되 Next/Firebase 어댑터를 모의한 검사다. 배포된 HTTP 서버·Firebase token 발급/취소·서비스 계정 권한이 검증됐다고 확대하지 않는다. Firestore 트랜잭션 모의는 stale revision·예산 분기의 동작을 확인하며 실제 분산 동시성/부하 시험을 대신하지 않는다.

### 최초 실패와 재검사

첫 컨테이너 실행은 새 로컬 검사기의 닫는 괄호가 하나 많아 Node 구문 분석 단계에서 `SyntaxError`로 종료됐다. 대상 제품 검사는 실행되지 않았다. 검사기만 수정한 뒤 첫 범위 101개가 통과했다. 이어 실제 공개 콘텐츠 선택 함수를 추가로 연결해, 초안·게시 중단·미래 예약 상태의 번역 노출을 12개 더 확인했다. 최종 113개가 통과했으며, 두 실행의 중복 사례를 합산하지 않는다.

## 소스로 추가 확인한 사항

- 공개 목록은 `draft.kind`와 공개 필드만 projection한다. 초안 본문 전체를 Next 공유 캐시에 올리지 않는다. 관리 조회·변경 응답은 `private, no-store`다.
- 자동 번역 종류는 서버의 고정 분기에서 공개 자료를 조회한다. 사용자가 본문·비공개 문의 내용·임의 fetch URL을 번역 API에 넘기는 계약이 없다. 배너는 현재 공개 여부를, 서비스 공지는 게시 중단 여부를 다시 확인한다.
- 번역 키는 서버의 Google 공식 endpoint 요청 헤더에만 사용한다. 공급자 redirect를 따르지 않고 응답 byte 상한·12초 timeout을 둔다. HTML 전체가 아니라 허용된 필드의 text를 보낸다.
- `expires_at`은 Firestore Timestamp로 저장한다. 캐시 유효성은 애플리케이션의 `expiresAt`으로 별도 판단하므로 TTL의 물리 삭제가 늦어져도 만료 번역을 재사용하지 않는다. TTL 정책이 실제 활성인지, 언제 삭제됐는지는 이 모의 실행의 판정 대상이 아니다.
- 이미지 저장은 새 UUID WebP 경로와 `ifGenerationMatch: 0`을 사용한다. 공개 응답은 `image/webp`·`nosniff`이며 허용 ID만 읽는다. 크기·원본 signature·디코더 metadata 경계를 두고 출력도 2MiB로 제한한다.
- 공개 JSON의 활성 전환은 파일 전체 확인 뒤 revision 비교를 수행한다. 클라이언트가 공개 API로 활성 포인터나 arbitrary Storage 경로를 지정하는 계약은 없다.
- 저장소의 `firestore.rules`는 새 컬렉션을 포함한 나머지 경로를 catch-all `allow read, write: if false`로 닫는다. 이 소스 확인만으로 현재 배포된 Rules/IAM 상태를 증명하지 않는다.

## 출시·배포 후 남은 보안 확인

| 우선순위 | 확인 | 통과 기준 |
| --- | --- | --- |
| 출시 전 | Production의 Firebase 프로젝트·버킷·관리자 UID·rate-limit secret과 Actions 계정 대상 | 이름 존재만이 아니라 대상 동등성과 필요한 읽기/쓰기 권한 확인. 운영 계정을 Preview에 복사하지 않음 |
| 배포 직후 | 실제 관리자 인증·권한 거부 | 허용 관리자의 조회 성공, 비로그인 401. 별도 테스트 계정 사용이 승인된 경우 미허용 UID 403. 토큰을 로그/문서에 남기지 않음 |
| 배포 직후 | 이미지 저장과 공개 경로 | 승인한 비민감 이미지의 업로드·WebP/EXIF 제거·이미지 GET/304, 손상 없는 표시. 로컬 모의 디코더 결과와 구분 |
| 배포 직후 | 번역 키·사용량·실제 캐시 | 공개 문구의 실제 번역 성공, 반복 요청 추가 사용량 0, API 응답/브라우저 bundle에 서버 키 없음. 한도 소진 시험 대신 정상 소량 표본 사용 |
| 배포 직후 | 운영 호스트·프록시·CSP | 실제 HTTPS/Origin/forwarded host 처리, 이미지·지도·인증 허용 도메인 확인. `Origin` 없는 호출이 허용된다는 사실은 admin Bearer 인증을 대체하지 않음 |
| 운영 관찰 | TTL·수집 발행·복구 | TTL 실제 삭제/지연·사용량, 다음 정상 snapshot 발행·버전 일치와 승인된 복구 절차 확인 |
| 운영 정책 | 공개 이미지의 보존·삭제 | 업로드 이미지 URL은 공개 배포용이고 1년 immutable cache를 사용한다. 배너 게시 중단만으로 이미 알려진 이미지 URL이나 내려받은 캐시가 삭제되지 않는다. 민감 자료 업로드를 피하고 삭제가 필요하면 객체·캐시·원문을 함께 관리 |
| 별도 범위 | 기타 기능의 전면 보안 감사 | 룸메이트·일정잡기·알림·메일·모든 외부 공급자와 실제 네이티브 이미지 디코더의 공격 재현은 이번 범위에 포함하지 않음 |

이 결과 때문에 IAM 권한을 넓히거나 실제 한도를 소진하거나 운영 데이터를 공격 대상으로 삼을 필요는 없다. 이번 검사는 새 기능의 명시한 신뢰 경계를 확인한 근거이며, 운영 연결 상태는 [현재 출시 준비 판정](RELEASE_READINESS_2026-10-27.md)과 별도 출시 실행 기록을 함께 사용한다.
