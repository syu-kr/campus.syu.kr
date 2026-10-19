# 룸메이트 게시판 개발·운영 안내

2026-10-19 저장소 코드 기준이다. 기능 계약, 환경 설정, 보존 정책과 재현 가능한 검증 절차를 이 문서에서 관리한다. 운영 Firebase·Vercel 설정이나 실제 기기 상태를 이번 문서 정리에서 조회하지 않았으므로, 현재 활성화·배포·수신 성공 여부는 아래 운영 확인 항목으로 남긴다.

## 기능과 화면

학교 이메일 링크 인증 후 기숙사 룸메이트 글을 조회·작성하고 카카오 오픈채팅으로 연락한다. 이메일 소유 확인은 현재 재학·기숙사 합격·공식 방 배정을 보증하지 않는다. 별도 회원가입 화면이나 비밀번호 입력은 없지만 Firebase Authentication의 인증 사용자 자료는 생성·사용한다.

| 경로 | 기능 |
| --- | --- |
| `/campus/roommates` | 인증된 사용자의 모집 목록, 조건 필터, 다음 목록 |
| `/campus/roommates/verify` | 학교 이메일 링크 요청, 재발송, 접속 유지 선택 |
| `/campus/roommates/verify/finish` | 링크 소비, 필요 시 수신 이메일 재입력, 서버 세션 발급 |
| `/campus/roommates/new` | 모집글 작성 |
| `/campus/roommates/[postId]` | 모집글 상세·연락·신고 |
| `/campus/roommates/me` | 내 글 수정·모집 완료·삭제 |
| `/admin` | 기존 관리자 인증으로 글·신고·작성 보류 관리 |

학생 화면은 `/en` 접두사로 영어도 제공한다. 사용자가 쓴 소개글은 번역하지 않는다. 공개 안내와 약관 개정 공지는 `public/service-notices/017-roommate-board.md`에서 관리하며, 이전 018 공지 주소는 해당 공지로 리다이렉트한다. 공지 원고의 존재를 운영 공개 증거로 해석하지 않는다.

## 인증·권한·캐시 경계

- 허용 이메일은 정확히 `@syuin.ac.kr`이다. 앞뒤 공백 제거와 소문자 정규화만 적용하며 교직원·유사 도메인·외부 주소는 거부한다. 학번 형식은 요구하지 않는다.
- Firebase 기본 이메일 링크를 사용한다. 서버가 한국어 또는 영어 완료 경로를 고정하며, 운영 origin과 해당 배포의 `VERCEL_URL` origin만 허용한다. 임의 Preview alias가 허용된다고 가정하지 않는다. 개발 모드에서만 loopback origin을 허용한다.
- 학생 인증은 이름 있는 별도 Firebase app의 `inMemoryPersistence`를 사용한다. 기존 관리자·FCM의 기본 app을 덮어쓰거나 로그아웃시키지 않는다.
- ID token은 `verifyIdToken(token, true)`와 프로젝트·이메일 인증·학생 도메인·최근 5분의 `auth_time`을 검증한다. 세션 수명은 원래 인증 시점부터 고정 30일이며 유지 선택을 해제하면 12시간이다. 방문·재발급으로 연장하지 않는다.
- 세션 쿠키는 `__Host-roommates_session`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`이며 Domain을 지정하지 않는다. DB에는 세션 토큰의 SHA-256만 저장한다. 이메일의 HMAC을 내부 작성자 키로 사용하며 원문 이메일·ID token·refresh token·OOB code·세션 토큰 원문을 게시판 문서에 저장하지 않는다.
- 보호 페이지의 쿠키 유무는 이동 경로를 정하는 힌트다. 비공개 UI는 브라우저의 세션 검증 후 마운트하며, 각 데이터 API는 별도로 서버 인증을 수행한다. 서버는 현재 Firebase 사용자와 삭제·비활성·이메일 변경·토큰 폐기를 확인한다. 인증 서비스 장애는 503으로 구분한다.
- 링크 소비 후 세션 발급만 실패하면 최근 인증 5분 안에서 세션 API만 재시도한다. 성공·취소 후 임시 auth를 제거하며 소비한 링크로 재로그인하지 않는다.
- 쿠키 기반 쓰기와 인증 요청은 정확히 같은 Origin을 요구한다. 누락·`null`·불일치는 403이다. 돌아갈 경로는 허용된 내부 룸메이트 경로로 제한한다.
- 학생의 세션 쿠키는 관리자 권한을 주지 않는다. 관리자 API는 폐기 여부를 확인한 Firebase Bearer token과 서버 전용 `ADMIN_UIDS` 검사를 사용하며 기능 중지 중에도 사고 대응이 가능하다. UID의 대소문자를 보존하고 이메일 목록으로 권한을 부여하지 않는다. 유효한 token 검증 후 UID 설정이 비어 있으면 503, 미등록 UID는 403이다.
- 한국어·영어 보호 페이지와 API는 `private, no-store`, 검색 제외와 `no-referrer` 정책을 사용한다. 공개 HTML·RSC·metadata·sitemap에 사용자 글과 연락처를 넣지 않는다.
- 최초 진입·pagehide/BFCache 복원은 새 인증 확인 전 비공개 내용을 숨긴다. 일반 탭 복귀는 같은 사용자의 입력을 유지하며, 마지막 확인 후 5분 이상일 때 백그라운드 재검증한다. 목록·상세·내 글도 5분을 최신 기준으로 사용한다. 고정 만료는 이 간격보다 우선한다.
- 로그아웃·사용자 변경·401·`FEATURE_DISABLED`는 화면 입력과 React Query 자료를 제거한다. 다른 탭에 개인정보 없는 변경 신호를 보내며 오래된 응답으로 화면을 다시 열지 못한다. 일반 503을 로그아웃이나 빈 목록으로 처리하지 않는다.

구현 근거: [서버 인증](../lib/server/roommate-auth.ts), [학생 Firebase app](../lib/firebaseRoommates.ts), [페이지 보호](../app/features/roommates/ProtectedRoommatePage.tsx), [세션 UI](../app/features/roommates/RoommateSession.tsx), [클라이언트 요청·임시 이메일](../app/features/roommates/client.ts), [응답 헤더](../next.config.js).

## 입력·조회·남용 제한

| 항목 | 현재 계약 |
| --- | --- |
| 닉네임·소개 | 닉네임 2–12자 필수, 소개 일반 텍스트 최대 300자 선택 |
| 기숙사·인실 | 브니엘·살렘 2인실, 시온 2·3인실, 에덴 2·3·4인실. 다음 모집 시즌에는 공식 공지와 대조 후 상수·테스트를 함께 갱신 |
| 모집 인원 | 1명부터 인실 정원에서 작성자 1명을 뺀 수까지 |
| 날짜 | 실제 달력 날짜, 거주 시작≤종료, 거주 종료는 오늘 이후. 한국 시간 등록일 포함 최대 30일과 거주 종료일 안에서 모집 마감 선택 |
| 수정·마감 | 최초 등록 시각과 모집 마감일을 연장하지 않음. 마감 다음 날 한국 시간 0시부터 일반 열람·연락 차단 |
| 생활습관 | 취침·기상·청소·통화·잠버릇·흡연·냉난방·물건 공유. 미기재와 상관없음을 구분. 잠버릇의 없음·잘 모름은 다른 값과 동시 선택 불가 |
| 연락 | `https://open.kakao.com/o/` 뒤 영문·숫자 코드만 허용. 서버가 연락 URL을 미리 가져오지 않음 |
| 공개 동의 | 등록·수정마다 `disclosureConsent: true` 필수. 서버가 동의 시각과 고지 버전 저장, 학생 응답에는 제외 |
| 활성 글·신규 등록 | 이메일 HMAC 작성자당 활성 글 1개, 신규 등록 하루 최대 3회 |
| 목록 | 최신 등록순, 한 응답 최대 20개, 한 요청 최대 100개 후보 확인. 조건은 AND로 결합하며 날짜는 거주 기간 겹침으로 검색 |
| 페이지 경계 | 마지막으로 검사한 Timestamp·문서 ID를 cursor로 사용. 빈 `items`여도 `nextCursor`가 있으면 검색은 계속 가능 |
| 읽기 | 목록·상세 합산 작성자당 분당 30회, IP당 분당 120회. 별도로 인증 조회 전 인스턴스별 보조 제한 적용 |
| 메일 요청 | 이메일당 최소 60초 간격·시간당 5회·하루 10회, IP당 시간당 100회 |
| 신고 | 모집 중인 타인 글만, 같은 작성자는 같은 글에 1회, 하루 최대 5회. 설명은 최대 300자 |
| 작성 보류 | 관리자 숨김 시 기본 30일. 보류 중 등록·수정 차단, 본인 완료·삭제 허용. 조기 해제·30일 연장 가능 |

앱의 일일 제한은 UTC 날짜 경계, 시간·분 제한은 서버 구간을 기준으로 한다. 화면은 다음 가능 시각을 한국 시간으로 표시한다. Firebase 제공자 한도와 앱 제한은 별개다. 실제 요금제·메일 전달·quota는 운영 Console에서 확인하고 고정 수치를 문서의 운영 사실로 사용하지 않는다. admin의 메일 요청 합계는 사이트 요청량이며 Firebase 전체 발송량이나 잔여 quota가 아니다.

발송 timeout은 실패 안내를 하며 자동 재발송하지 않는다. 앱의 메일 플래그와 제한이 Firebase 공개 인증 API 직접 호출까지 전역 통제하지는 않는다. 사진·첨부·댓글·자체 채팅·AI 추천·과거 글 아카이브는 구현 범위에 없다.

입력 상수와 선택값은 [lib/roommates.ts](../lib/roommates.ts), 응답 타입은 [types/roommates.ts](../types/roommates.ts), 서버 저장·검색은 [roommate-posts.ts](../lib/server/roommate-posts.ts)가 기준이다.

## API와 동시성

| API | 동작 |
| --- | --- |
| `POST /api/roommates/auth/request-link` | 학생 주소·Origin·제한 검증 후 기본 메일 발송. 링크·OOB code는 반환하지 않음 |
| `GET /api/roommates/auth/session` | 최소 인증 상태·만료·세션 변경용 표식 반환. 이메일·토큰은 반환하지 않음 |
| `POST /api/roommates/auth/session` | ID token·유지 선택 검증 후 쿠키 발급 |
| `POST /api/roommates/auth/logout` | 현재 서버 세션 폐기·쿠키 제거 |
| `GET/POST /api/roommates/posts` | 인증된 목록 조회 / 신규 등록 |
| `GET /api/roommates/posts/me` | 내 최근 글과 현재 작성 보류 |
| `GET/PATCH/DELETE /api/roommates/posts/[postId]` | 상세 / 본인 수정·완료 / 본인 삭제 |
| `POST /api/roommates/posts/[postId]/reports` | 타인 글 신고 |
| `GET/PATCH /api/admin/roommate-posts` | 관리자 글·보류 조회와 조치 |
| `GET/PATCH /api/admin/roommate-reports` | 관리자 신고 조회와 상태·메모 처리 |

글 상태는 `recruiting`, `completed`, `hidden`, `deleted`이며 만료는 마감 시각으로 계산한다. 학생 PATCH는 `update` 또는 `complete`, PATCH·DELETE는 `expectedVersion`을 요구한다. 금지 필드·직접 status 지정·작성자 키 지정은 허용하지 않는다. 입력 오류 400, 미인증 401, 권한·보류 403, 비공개·종료 글 404, 버전·활성 글 충돌 409, 제한 429, 설정·인프라 장애 503을 구분한다.

활성 글 등록, 상태 변경, 신고, 관리자 조치는 Firestore 트랜잭션으로 처리한다. 동시 등록은 하나만 성공한다. 완료·삭제는 포인터가 해당 글일 때만 해제하며 늦은 이전 글 요청이 새 활성 글을 지우지 못한다. 숨김은 글 상태 변경·포인터 해제·보류를 함께 기록한다. 복구는 마감 전 `hidden → recruiting`만, 다른 활성 글이 없을 때 허용한다. 완료·삭제 글은 복구하지 않는다. 글 복구와 보류 해제는 별도 조치다.

신고 당시 닉네임·소개·기숙사·인실·연락 링크·글 version을 관리자 전용 근거로 복사한다. 중복 신고와 글 수정·삭제의 경합에서도 한 버전의 근거만 저장한다. 신고 자체로 자동 숨김하지 않는다. 신고 상태 `pending`, `reviewing`, `done`, `rejected`와 글 상태는 별도이며, 관리자 조치는 최소 감사 기록을 남긴다. [관리자 구현](../lib/server/roommate-admin.ts)을 함께 확인한다.

## 개인정보·보존·정리

사용자 고지는 [개인정보처리방침 소스](../app/privacy/page.tsx), [이용약관 소스](../app/terms/page.tsx), [개정 공지](../public/service-notices/017-roommate-board.md)가 기준이다. 현재 약관 코드는 2026-11-04 00:00 KST 전후로 시행 예정·시행 안내를 구분한다. 문서 정리가 법률 검토나 운영 설정 검증을 대신하지 않는다.

공개 동의 고지는 수신자·목적·항목·기간·거부·철회 방법을 포함한다. 서버의 현재 동의 고지 버전은 `2026-10-04`다. 가입 화면이 없다는 이유로 인증 자료가 없다고 설명하지 않는다. 카카오의 외부 대화는 수집하지 않으며 게시판 연락 링크 중단이 외부 대화 차단을 뜻하지 않는다. 룸메이트 글·신고는 AI 분류에 보내지 않는다.

| 자료 | 보존과 접근 종료 |
| --- | --- |
| 브라우저 인증 대기 이메일 | 완료·취소 시 제거, 최대 24시간 이용. 만료 값은 다음 읽기 때 삭제하므로 닫힌 브라우저에는 남을 수 있음 |
| 서버 세션 | 인증 시점부터 30일 또는 12시간. 만료 즉시 보호 API 거부, 로그아웃 즉시 폐기 |
| 글·연락·공개 동의 증빙 | 완료·삭제·만료·숨김 즉시 타인 열람 차단. 최초 완료·삭제 시각과 원래 마감 중 이른 시각부터 30일 뒤 정리. 수정·숨김으로 연장하지 않음 |
| 신고·당시 근거·관리자 메모 | 접수 후 30일. 미처리도 동일하며 정리 직전 `미처리 상태에서 보존 종료` 최소 감사 기록을 남기고 처리 완료로 바꾸지 않음 |
| 작성자 상태 | 마지막 작성자·관리자 조치 후 90일, 유효한 보류·활성 모집글이 없을 때 정리. 삭제 직전 트랜잭션에서 재확인 |
| 관리자·정리 감사 | 조치 후 365일. 신고 본문·연락 링크를 중복 저장하지 않음 |
| Firebase Auth 사용자 | 자동 미이용 계정 삭제 없음. 로그아웃·글 삭제로 계정 삭제되지 않음. 개인정보 문의에서 본인 확인 후 삭제 요청 처리, 공유 관리자·다른 기능 계정 영향 확인 |

인증용 이메일은 Firebase Auth에, 게시판 자료는 `roommate_sessions`, `roommate_posts`, `roommate_owner_state`, `roommate_reports`에 저장한다. 네 컬렉션은 [Rules](../firestore.rules)에서 모든 클라이언트 직접 읽기·쓰기를 차단하고 서버 Admin SDK만 접근한다. 국내 Firestore 저장과 국외 서버·인증 처리는 구분하며, 실제 리전·처리업체·계약이 바뀌면 개인정보 고지를 함께 검토한다.

[일일 정리 workflow](../.github/workflows/cleanup-expired-firestore.yml)는 18:30 UTC(다음 날 03:30 KST) 예정이며 실행 지연이 가능하다. `scripts/cleanup_meet_rooms.ts`가 [룸메이트 정리](../scripts/roommate-cleanup.ts)를 호출한다. 물리 삭제가 늦어도 API는 접근 기한을 먼저 검사한다.

관리형 TTL은 `roommate_sessions`, `roommate_posts`의 `expires_at`에 선택적으로 적용할 수 있다. **`roommate_reports`와 `roommate_owner_state`에는 TTL을 설정하지 않는다.** 신고 감사와 현재 보류·활성 글 재검사가 필요하다. TTL을 사용해도 예약 정리는 유지한다. 전체 절차는 [Firestore 운영 문서](./FIRESTORE_RULES.md)를 따른다.

`npm run cleanup-expired-firestore`에는 dry-run이 없고 다른 기능의 만료 자료도 실제 삭제한다. 운영 시험·초기화 용도로 수동 실행하지 않는다. 운영에서는 정상 예약 실행의 성공·카운터·오류를 관측하고 만료·동시성 시험은 격리 환경에서 수행한다.

## 환경·배포·중지

실제 값은 비밀값 저장소에만 등록한다. 자세한 공통 설정은 [환경 등록 안내](./ENVIRONMENT_REGISTRATION.md)와 [.env.example](../.env.example)을 따른다.

| 설정 | 기준 |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_*` | 대상 환경의 공개 웹 앱 설정. `NEXT_PUBLIC_FIREBASE_PROJECT_ID`와 Admin 계정 프로젝트 일치 |
| `FIREBASE_SERVICE_ACCOUNT` | 해당 환경의 Auth 검증·Firestore 서버 권한. 운영과 Preview 계정 분리 |
| `ROOMMATES_OWNER_KEY_SECRET` | 환경별 독립 무작위 32-byte 이상 비밀값, 배포 간 안정적으로 유지. 서버는 미설정·32자 미만 거부 |
| `RATE_LIMIT_SECRET` | 공용 제한 HMAC 비밀값. owner 키와 분리하고 제한 초기화 목적으로 교체하지 않음 |
| `ROOMMATES_ENABLED` | 정확히 `true`일 때 활성, 미설정 기본 false |
| `ROOMMATES_WRITES_ENABLED` | 정확히 `true`일 때 신규 등록·내용 수정 허용, 기본 false |
| `ROOMMATES_EMAIL_ENABLED` | 정확히 `true`일 때 사이트 새 인증 메일 발송, 기본 false |
| `ADMIN_UIDS` | 해당 Firebase 프로젝트에서 소유자를 확인한 관리자 UID를 쉼표로 구분. 대소문자 보존. UID 검사 코드 배포 전에 등록하고 새 배포에 반영. Production·Preview·Development의 프로젝트·UID 분리 |

Production·Preview에 운영 서비스 계정·HMAC 키·관리자 UID 목록을 함께 복사하지 않는다. 독립 Preview Firebase 준비 여부는 재확인 대상이다. 실제 배포와 운영 Actions에는 에뮬레이터 호스트 설정이 없어야 한다. 정리 Actions는 `FIREBASE_SERVICE_ACCOUNT`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`를 사용하며 룸메이트 플래그·owner 키·`ADMIN_UIDS`는 필요하지 않다.

배포 전 Firebase 이메일 링크 제공자·허용 도메인·템플릿·실제 요금제·발송 한도·Admin 권한을 확인한다. [이메일 링크 안내](https://firebase.google.com/docs/auth/web/email-link-auth)와 [제공자 한도](https://firebase.google.com/docs/auth/limits)를 참고하되 API 접수 성공을 실제 수신으로 판정하지 않는다.

관련 복합 인덱스의 기준은 [firestore.indexes.json](../firestore.indexes.json)이다. 다음 정의를 컬렉션 그룹·COLLECTION scope·필드 순서까지 대조하고 실제 쿼리 성공을 확인한다. 같은 필드의 다른 컬렉션 인덱스를 대신 대조하지 않는다.

| 컬렉션 그룹 | 필드 순서 |
| --- | --- |
| `roommate_posts` | `status` ASC, `created_at` DESC |
| `roommate_posts` | `status` ASC, `recruit_until` ASC |
| `roommate_reports` | `status` ASC, `expires_at` ASC |
| `api_rate_limits` | `metric` ASC, `window_start` ASC |
| `api_rate_limits` | `metric` ASC, `window_start` ASC, `count` ASC (사이트 메일 요청 합계) |

운영 Rules·인덱스는 승인된 대상 프로젝트를 명시해 배포하고 기존 정의 삭제 제안을 검토한다. 인덱스 생성 요청 성공이나 에뮬레이터 통과는 READY의 증거가 아니다. 현재 배포 상태는 Console/API로 다시 읽는다. 프로덕션 공개는 해당 소스 SHA의 main CI→저장소 동기화→Vercel Production 준비 완료→운영 HTTPS 실동작까지 구분해 확인한다. 플래그가 활성인 공개 환경은 운영자 전용 시험 환경이 아니다.

| 상황 | 변경 후 새 배포 | 유지되는 범위 |
| --- | --- | --- |
| 전체 기능 중지 | `ROOMMATES_ENABLED=false` | 로그아웃·관리자 조치. 학생 조회·새 세션·메일 요청 차단 |
| 쓰기 중지 | 전체 활성, `ROOMMATES_WRITES_ENABLED=false` | 조회·본인 완료/삭제·신고·인증·로그아웃 |
| 메일 중지 | 전체 활성, `ROOMMATES_EMAIL_ENABLED=false` | 기존 유효 세션·이미 받은 유효 링크 완료·로그아웃 |
| 개별 신고 | admin 숨김·삭제·보류 | 다른 글 운영과 신고 처리 |

플래그는 admin의 즉시 스위치가 아니며 재배포가 필요하다. 전체·메일 중지로 재인증할 수 없어 삭제가 어려운 사용자를 위한 개인정보 문의 경로를 유지한다. 현재 공지 원고는 공개 완료 안내이므로 기능 활성화와 같은 출시 단계에서 반영한다. 별도 비활성 코드 배포가 필요하면 공지도 준비 안내로 맞춘다. 롤백 시 비공개 Rules·기존 자료·정리 경로를 보존하고 실제 응답으로 중지 상태를 확인한다. owner 키 교체는 기존 글·세션·보류 연결을 바꾸므로 일반 배포·롤백 조치로 사용하지 않는다. 유출 대응이 필요하면 데이터 이전·세션 폐기·사용자 안내를 별도 설계한다.

## 재현 가능한 검증

이 문서 정리는 코드·테스트·환경 예시 대조이며 테스트 재실행이나 운영 검증 결과를 추가한 작업이 아니다. 과거 커밋의 테스트 수·CI 성공·배포 조회는 현행 코드의 성공으로 재사용하지 않는다. 검사 명령과 실제 실행 결과는 해당 변경의 검증 기록에 남긴다.

```sh
npm run type-check
npm run check:i18n
npm run lint
npm run test:unit -- lib/roommates.test.ts lib/server/roommate-auth.test.ts lib/server/roommate-posts.test.ts lib/server/roommate-admin.test.ts scripts/roommate-cleanup.test.ts app/features/roommates
```

변경 범위에 맞춰 API·privacy·Firebase 분리 테스트도 포함하고, 최종 저장소 검사는 `npm run check`를 사용한다. `npm run check`에 에뮬레이터 통합 검사는 포함되지 않는다.

별도 터미널에서 Firebase CLI·Java가 준비된 **로컬 demo 프로젝트**만 사용한다.

```sh
firebase emulators:start --only auth,firestore --project demo-syu-roommates --config firebase.roommates.emulators.json
```

```sh
npm run test:roommates:integration
npm run test:roommates:browser
```

통합 설정은 `demo-syu-roommates`, Auth `127.0.0.1:9098`, Firestore `127.0.0.1:8188`을 강제한다. 환경 파일·운영 서비스 계정을 읽지 않으며 외부 fetch를 차단한다. 브라우저 도구는 `http://127.0.0.1:3031/_roommate_test`에서 합성 학생 두 명의 실제 세션·DB 흐름을 제공한다. 운영에 배포하는 경로나 실제 메일 수신 증거가 아니다. 테스트 도구가 DB를 초기화하므로 운영 credential을 주입하지 않는다. 에뮬레이터는 실제 메일 전달·운영 복합 인덱스·실기기 저장소 공유를 검증하지 못한다.

| 회귀 영역 | 필수 확인 |
| --- | --- |
| 인증·발송 | 정확한 도메인, 외부·위조·다른 프로젝트 token, 최근 인증·고정 수명, 실패·quota 구분, Origin 거부, 학생/admin 분리 |
| 링크 완료 | 정상·만료·재사용·불일치, 다른 브라우저 재입력, 소비 후 세션 재시도·5분 경계·취소 경합 |
| 비공개 UI | 최초·BFCache 인증 전 숨김, 빠른 탭 전환 입력 유지, 만료 우선, 로그아웃/401/중지/사용자 교체 즉시 제거, 오래된 응답 무시 |
| 글·필터 | 입력·동의·version, 동시 등록 하나, 타인 변경 거부, 100개 후보·빈 cursor·동일 시각·필터 복원, 완료/만료 연락 차단 |
| 신고·관리자 | 자기·중복 신고 차단, 신고/수정/삭제 경합의 한 버전 근거, 보류 유지·복구 조건·개별 해제·권한 분리 |
| 보존·정리 | 최초 기한 불변, 미처리 신고 감사, 90일 owner 재검사, 유효 보류·활성 글·Auth 사용자 보존 |
| 개인정보·관측 | HTML/RSC·API·SW 비공개, GA 제외, Sentry·요청 로그의 이메일/OOB/token/cookie 비노출 |

## 운영·실기기 재확인 항목

이전 기록에는 학교 메일 수신과 PC 인증·재방문·로그아웃 확인이 있으나, 현행 배포·메일·실기기 결과로 갱신한 것은 아니다. 다음 미확인 항목은 공개 문서 통합 후에도 유지한다. 각 시험은 `통과 / 실패 / 미실행`과 환경·시각·안전한 오류 코드로 기록한다.

- [ ] 해당 SHA의 Production 배포·공지·한국어/영어 메뉴·실제 HTTPS 경로가 일치하는지 확인.
- [ ] Production/Preview/Actions 프로젝트·계정 분리·owner 키 유지, 제공자·허용 도메인·요금제·quota·Rules·관련 인덱스 READY와 admin 합계 쿼리 확인. `ADMIN_UIDS`의 대상 프로젝트·계정 소유자·환경 범위와 새 배포 반영, 기존 관리자 접근도 확인.
- [ ] 실제 학교 메일 요청부터 도착까지 시간·받은편지함/스팸 위치·60초 이후 재발송, 만료·재사용·불일치·다른 브라우저/수신 기기 확인.
- [ ] 실제 Android Chrome·iPhone Safari에서 메일 앱→완료 브라우저, 한글/날짜 입력·키보드·모달·뒤로가기·재방문·로그아웃 확인. PC viewport와 구분.
- [ ] 실제 카카오 인앱·설치 웹앱·별도 TWA의 저장소 공유 여부와 일반 브라우저 전환 확인. 인증 링크를 대화로 전달하지 않고 공개 게시판 주소만 사용.
- [ ] 서로 다른 학교 이메일의 학생 A/B와 별도 관리자 권한으로 등록→타인 조회/연락→신고→숨김·복구·보류 해제→완료/삭제와 권한 거부 확인. 같은 이메일의 다른 브라우저는 다른 학생을 대신하지 못함.
- [ ] 기존 admin 로그인·FCM 유지, 인증 폐기·장애 안내는 동의한 전용 시험 계정이나 독립 테스트 Firebase에서 확인. 개인 운영 계정을 임의 폐기하지 않음.
- [ ] 운영의 로그아웃·다른 탭·뒤로가기·SW 오프라인에서 이전 글과 연락처가 노출되지 않는지, HTML/RSC·GA·Sentry·배포 요청 로그에 민감값이 없는지 실제 저장 결과 확인.
- [ ] 세 플래그 각각 환경 변경→새 배포→중지 범위→복구 확인. 전체 이용자에게 미치는 범위와 시험 시각 기록.
- [ ] 정상 예약 정리 workflow의 소스 SHA·카운터·실패와 담당자의 신고 확인 주기·미처리 보존 종료 대응 확인. 운영 정리를 시험 목적으로 수동 실행하지 않음.
- [ ] 실제 12시간/30일 세션, 모집 마감·보류·신고·감사 보존 경과는 실제 기간 경과와 격리 시간 경계 시험을 구분. Auth 자료 삭제 요청과 문의 경로 확인.

시험 글은 목적을 표시하고 본인 소유의 시험 오픈채팅을 사용한다. 종료 후 글 완료/삭제·시험 보류 해제를 수행하되 정책상 남는 신고 근거·감사 자료를 전체 삭제로 초기화하지 않는다. 공개 기록에는 query 없는 경로·HTTP 상태·오류 코드·개인정보를 가린 캡처만 남긴다. 실제 이메일·인증 링크·OOB code·token·cookie·HMAC 키·서비스 계정·HAR 원문을 첨부하지 않는다.
