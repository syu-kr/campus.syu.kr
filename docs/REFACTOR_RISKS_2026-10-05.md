# 오류 가능성·운영 확인 목록 — 2026-10-05

이 파일은 `REFACTOR_AUDIT_2026-10-05.md`에 따른 코드 수정 이후 남는 조건과 검증 한계를 구분해 기록한다. 코드의 단위 검사와 실제 운영 설정·실단말 검증을 서로 대체하지 않는다.

## 배포 전 확인할 항목

| 항목 | 오류 가능 조건과 영향 | 확인·대응 |
| --- | --- | --- |
| R13 Firestore sum 인덱스 | 운영 인덱스가 준비되지 않으면 관리자 글 목록의 메일 요청 집계가 실패할 수 있다. | `2026-10-05T09:16:32.355Z`에 운영 인덱스 `CICAgNi47oMK`의 READY 상태·실제 sum 질의 성공·기존 인덱스 보존을 확인했다(`.cache/refactor-index-proof.json`). 향후 인덱스/질의 변경 시 다시 확인한다. mock 및 emulator 검사만으로 운영 인덱스 준비를 판단하지 않는다. [Firestore 집계 안내](https://firebase.google.com/docs/firestore/query-data/aggregation-queries) |
| R02 IP 공유·분산 경계 | 같은 학교 NAT/IP의 요청이 분당 120회를 넘으면 정당한 사용자도 잠시 429를 받을 수 있다. 사전 제한은 프로세스 단위여서 다른 인스턴스에 걸친 총량을 통제하지 못한다. | 429와 DB/Auth 조회량을 관찰해 한도를 조정한다. 검증 뒤 기존 소유자·공유 제한은 계속 적용한다. |
| R03 플랫폼 입력 경계 | canonical `/api/*`는 locale proxy matcher에서 제외해 Next의 사전 clone/finalize를 피한다. `/en/api/*`의 기존 rewrite 경로나 호스팅 프록시가 별도로 버퍼링하는 요청까지 helper의 상한이 제어하지는 않는다. 느린 업로드의 시간 제한도 바이트 제한과 다른 조건이다. | 실제 호출은 canonical API를 사용한다. 배포 플랫폼의 body/time 제한과 localized API 경계를 함께 확인한다. byte 상한을 플랫폼 전체 메모리 상한으로 설명하지 않는다. |
| R04 정리 작업의 동시 갱신 | 조회 후 문서가 갱신되면 updateTime 전제조건이 실패해 삭제 배치가 중단된다. 갱신 문서를 보호하는 실패이며 해당 배치의 다른 만료 문서도 남는다. | 작업 실패 알림과 로그를 확인하고 다시 실행한다. 배포 후 실제 갱신 경쟁 빈도가 높으면 건별 전제조건 처리 또는 기존 transaction 재검증을 적용한다. |
| R07 브라우저 저장소 차단 | 현재 화면에서는 수정 토큰을 보존하더라도 새로고침·탭 종료 뒤 저장하지 못한 토큰을 복구할 수 없다. | 저장소 경고를 표시한다. 영구 보존 실패와 서버 저장 성공을 구분하고 같은 화면의 수정 기능을 유지한다. |
| R12 env 형식 | 기존 자작 파서가 수락하던 따옴표 없는 여러 줄 JSON은 표준 env 형식이 아니므로 오류가 된다. | 서비스 계정은 한 줄 JSON 또는 따옴표로 감싼 여러 줄 JSON으로 등록한다. 실제 로컬 설정은 표준 파서로 JSON이 해석됨을 값 출력 없이 확인했다. 기존 환경변수 우선순위를 유지한다. |
| R09/R16 지도 SDK | mock lifecycle 회귀가 실제 Kakao SDK·운영 도메인 제한·네트워크 상태까지 검증하지는 않는다. | 운영/프리뷰에서 마커 선택 후 시각·위치 갱신과 페이지 이동을 확인한다. SDK 다운로드·도메인 설정 실패는 별도 운영 조건이다. |
| Pages의 큰 JSON 캐시 | 로컬 production 실행에서 공지 JSON 2,227,542 bytes와 AI metadata 6,835,666 bytes가 Next Data Cache 2 MB 상한을 초과해 저장 경고가 발생했다. 데이터 로딩 자체는 성공했지만 새 인스턴스/프로세스에서는 재다운로드 비용이 생길 수 있다. | 기존 version별 프로세스 cache는 유지된다. cold start의 네트워크 시간·전송량을 확인해 데이터 분할이나 큰 파일의 force-cache 적용 범위를 조정한다. 이 경고를 요청 실패로 간주하지 않는다. |

## 감사의 조건부 항목

1. **관리자 인증:** 현재 코드는 검증된 ID token의 이메일 allowlist를 사용한다. 로컬 allowlist의 1개 계정은 운영 Firebase Auth에 등록되어 활성 상태지만 이메일은 미검증이었다. Vercel GUI의 `ADMIN_EMAILS` All Environments 등록은 확인했고, 사용자 선택에 따라 변수 값의 일치 비교는 하지 않았다. 따라서 로컬 계정 확인을 운영 allowlist 전체의 검증으로 확대하지 않는다. 기존 테스트도 미검증 이메일을 허용한다. 계정 소유자와 로그인·메일 확인 절차를 확인한 뒤 `email_verified`/등록 UID 요구 정책을 정한다. 즉시 이메일 검증을 강제하면 기존 관리자가 잠길 수 있어 정책은 변경하지 않았다.
2. **AI 원문 redirect:** 최초 URL뿐 아니라 모든 redirect hop이 학교 allowlist를 통과하도록 강화했다. 상대 주소와 학교 HTTP→HTTPS 전환을 유지하고 외부·자격증명 포함·비표준 포트·과도한 redirect를 차단한다. 11개 격리 회귀 검사를 통과했다. 실제 학교 open redirect의 존재나 운영 SSRF 성공을 확인한 것은 아니다.
3. **공유 페이지 읽기 총량:** 기존 process-local 제한은 인스턴스·재배포 간 총량 제한이 아니다. 트래픽·비용 근거와 플랫폼 방어를 확인한 뒤 공용 제한을 결정한다. 새로운 공유 저장소는 도입하지 않는다.
4. **금·토 알림:** 감사에서 버그로 제외한 기존 정책을 유지한다. 월요일 소급 알림은 발송 범위·문구·중복 방지 정책을 정할 별도 변경이다.

## S01 Firebase 공개 API 키

키 공개 여부와 관리자/데이터 접근 권한은 구분한다. 원 감사의 운영 읽기 검증 결과와 상세 영향 분석은 감사 문서 S01에 있다. 이번 코드 브랜치에서는 키 순환·폐기·API allowlist·가입 정책·App Check 강제·secret-scanning 알림 상태를 변경하지 않는다.

- 현재 코드 사용 API 네 가지(Auth Identity Toolkit, Token Service, Installations, FCM Registration)를 기준으로 다른 앱·운영 소비 여부를 확인한 뒤 미사용 API 허용 범위를 정리한다.
- 제공자 Auth 요청/실패/메일 quota·비용을 관찰하고 관리자 allowlist 계정의 경계를 확인한다. 기존 DAU/MAU 수치가 남용 부재의 증거는 아니다.
- 서버 메일 요청과 브라우저가 같은 키를 사용한다. 같은 키에 referrer 제한을 즉시 적용하면 Referer 없는 서버 메일 요청이 실패할 수 있다. 필요 시 용도를 분리한 뒤 관리자 로그인·refresh, 학생 메일 링크 완료, 신규 알림 구독을 검증한다.
- NEXT_PUBLIC 키 교체는 재빌드·재배포와 열린 탭/기존 서비스워커 전환 검사가 필요하다. 실제 폐기 전에 알림을 revoked로 종료하지 않는다.

## 실행 환경·검증 범위

| 항목 | 확인한 범위 / 남은 조건 |
| --- | --- |
| 전체 코드 검사 | Node 22.13.0/npm 10.9.4의 `npm run check` 종료 코드 0, 전체 단위 111개 파일/716개 테스트·type-check·production build 통과(`.cache/refactor-prepr-check.log`). 실제 emulator 통합 16개 및 Java 17 Android 빌드 통과. |
| CI 버전 차이 | 최신 전체 검사에서 CI의 Node 22.13.0/npm 10.9.4를 사용했다. 로컬 Python 3.13.14와 기존 설치 requests 2.32.5/beautifulsoup4 4.14.3은 CI Python 3.11·requirements의 2.34.2/4.15.0과 다르다. Android는 JBR Java 17.0.14로 통과했으나 CI는 Temurin Java 17이다. 원격 CI 환경 검사는 별도로 필요하다. |
| 원본 PDF | 교육과정 데이터 검사는 통과했으나 원본 PDF 3개가 없어 해당 해시 검사를 생략했다. 출처 파일의 무결성 확인은 별도다. |
| Android | Java 17.0.14/Gradle 8.11.1의 offline lintDebug/assembleDebug/bundleRelease 종료 코드 0, 30초·80개 작업(7 실행/73 up-to-date), debug APK/release AAB 생성·lint 오류 0. lint 경고 33개(아이콘 11, 방향 1, unused attribute 12, unused resource 9)가 남는다. Java 17 재실행에는 앞선 Java 22의 source/target 8 지원 중단 예정 경고가 없었다. 실제 단말의 TWA 연결·서명/스토어 배포를 확인한 것은 아니다. |
| production 브라우저/HTTP | 로컬 빌드를 실행해 실제 요청 상한·KO/EN HTML nonce·한국어/영어 검색/모달·페이지 이동·언어 전환을 확인했다. 추가 알림 카드 수정 후 영어 Contact 첫 마우스 클릭, 모달 종료 뒤 카드의 static 배치·Footer 앞 DOM 순서도 확인했다. 공개 provider 설정은 placeholder이고 날씨 설정을 비워 실패/재시도 UI를 확인했다. 지도 실 SDK·실 날씨·메일·푸시 연결 검증은 별도다. |
| Vercel 환경변수 | GUI에서 `ADMIN_EMAILS`의 All Environments 등록과 `FIREBASE_SERVICE_ACCOUNT`/`FIREBASE_ADMIN_SDK_KEY`의 Production·Preview 등록을 확인했다. 사용자 선택에 따라 값 비교는 하지 않았다. 로컬 allowlist 계정 상태는 위에서 별도로 확인했고, 운영 allowlist 일치·Preview 데이터 격리는 확인하지 않았다. |
| 외부 네트워크/업로드·경고 | 앞선 샌드박스의 Pages 요청 EACCES에서 기존 번들 fallback을 사용했고 Sentry auth token 부재로 source map 업로드를 생략했다. 운영 upstream 최신성·Sentry 업로드 성공은 검증하지 않았다. 최신 Node 22 전체 검사에는 punycode 사용 중단 경고와 jsdom의 문서 navigation 미구현 메시지가 있으나 검사와 빌드는 종료 코드 0이다. |
| loopback 영어 경로 | 마지막 브라우저 검사에서 기존 127→localhost 정규화로 인한 영어 cookie redirect 반복을 재현하고 제한된 Host 복원으로 수정했다. 실제 Next adapter 및 startup 주소와 동일한 127.0.0.1의 HTTP/브라우저 검사를 통과했다. 다른 startup hostname과 주소창 alias 조합까지 포괄 검증한 것은 아니다. |

## 검증 중 발견해 추가 수정한 화면 문제

**데스크톱 알림 카드가 Footer 문의 클릭을 가리던 문제를 추가 수정했다.** 영어 production 화면에서 첫 pointerdown/keydown 중 표시되는 fixed 카드가 문의 클릭을 막는 상황을 확인했다. 카드 표시를 완료된 click/keyup 뒤로 옮기고 Footer 앞 흐름에 배치해 겹침을 제거했다. 관련 집중 회귀 13개를 통과했다.

수정 후 Chrome의 로컬 production 영어 화면에서 Footer Contact의 첫 마우스 클릭으로 카드와 문의 모달이 정상 표시되는 것을 확인했다. 모달 종료 후 카드의 position이 static이고 DOM에서 Footer보다 앞에 있음도 확인했다. 실제 문의 메일 전송·알림 권한 승인·푸시 발송은 실행하지 않았다.

최종 R09 리뷰에서는 닫힌 정보창을 위치 갱신이 다시 열고 지도를 이동시키는 회귀를 재현해 수정했다. native `InfoWindow.getMap()` 상태를 확인해 사용자의 닫힘을 보존하며, marker/list 재선택 시 정상 선택 복원이 이어진다. 두 선택 경로에서 닫힘 후 refresh의 open/panTo/setCenter/setBounds 추가 호출 0과 재선택 후 복원을 SDK mock으로 확인했다. 실제 SDK 브라우저 검증은 위 운영 확인 조건에 포함된다.

R13 운영 인덱스 배포와 READY·실제 sum 질의 확인은 수행했다. 애플리케이션 운영 배포·학생 실계정 메일/푸시 발송·사용자 데이터 변경·클라우드 키 제한/계정 정책 변경은 수행하지 않았다. 해당 항목들은 위 코드 검사 성공으로 대체할 수 없다.
