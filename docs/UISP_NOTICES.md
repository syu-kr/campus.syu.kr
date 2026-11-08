# 대학혁신지원사업단 공지

- 목록: `/academic/uisp-notices` (영문 `/en/academic/uisp-notices`)
- 분류: `uisp`, 상세 경로: `/announcements/uisp/uisp-<게시글 번호>`
- 원본: <http://uisp-origin.example.invalid/bbs/board.php?bo_table=notice>
- 데이터: `public/data/announcements-uisp.json`
- 수집: `python scripts/crawl_uisp_notices.py`, 기존 `npm run crawl:daily`에 포함

기존 공지 목록·홈 분류·학사 메뉴·서비스 검색·한영 화면·사이트맵·IndexNow 변경 감지에 연결한다. SW 공지와 마찬가지로 공모전 전용 집계와 일일 학사/장학 푸시에는 추가하지 않는다.

별도 의존성은 필요하지 않다. 원본은 확인 시점에 HTTP만 제공하므로 이 출처의 공식 게시판 URL에만 HTTP를 허용한다. 다른 공지 출처의 HTTPS 검증은 유지한다. 게시글 번호로 ID와 URL을 구분하며, 목록의 두 자리 연도를 변환하고 말줄임 제목은 원문에서 복원한다. 현재 상단 공지는 첫 페이지를 기준으로 갱신한다. 목록에서 제공하지 않는 조회수는 표시하지 않는다.

HTTPS로 강제 전환하는 브라우저에서는 원문 링크가 열리지 않을 수 있다. 검증용 Chrome 157에서도 `HttpsUpgrades`에 따른 HTTPS 전환 후 원문 접근이 차단되었다. 원본 사이트의 HTTPS 지원이 필요하며 앱의 보안 정책을 낮추지 않는다.

목록·필수 필드·원문 제목 조회 실패나 반복 페이지는 저장 전에 실패한다. 일일 수집 실행기는 해당 출처의 이전 검증본을 보존하고 stale 상태를 기록한다. 정상 수집에서는 기존 글 구간을 만나면 종료하고 과거 글을 보존한다.

1. 저장소 변수 `PUBLIC_UISP_ENABLED`를 비워 둔 채 앱을 배포한다. 최초 게시 전에는 앱에 포함된 UISP 기준본을 사용한다. 변수의 기본값은 비활성이며 일일 수집과 새 UISP AI 요약을 시작하지 않는다.
2. 운영의 `/indexnow-deployment.json`에서 배포한 소스 SHA를 확인하고, `/api/public-data/current` 및 한영 UISP 목록이 정상 응답하는지 확인한다. 이후 저장소 변수 `PUBLIC_UISP_ENABLED=true`로 일일 수집을 활성화한다. UISP 수집에 처음 성공한 실행에서 새 파일과 상태를 게시한다.
3. 첫 전체 수집의 UISP `fresh` 로그, 운영 manifest의 UISP 파일과 `sourceHealth`, 운영 공지 목록을 확인한다. 식단·참조 자료 게시가 먼저 실행되어도 UISP 파일을 최초 도입하지 않는다.

이전 앱으로 되돌릴 경우 변수를 먼저 비활성화하고 진행 중인 수집이 끝난 뒤, UISP가 없는 호환 데이터 버전을 먼저 활성화한다. 운영 manifest를 확인한 뒤 앱을 되돌린다. 데이터 버전 보존 목록은 최대 7개이므로 최초 활성화 직전에 호환 버전을 기록한다. 변수만 끄면 이미 게시된 UISP 파일은 보존된다.

초기 기준본은 2026-11-07에 원본 48페이지에서 수집한 714건이다. 게시일은 2019-03-27~2026-11-06이며 상단 공지는 4건이다. 새 AI 요약 생성과 실제 서비스 배포는 이 기준본 수집에 포함되지 않는다.

수집기 회귀 검사는 `python scripts/check_uisp_notices.py`이며 기존 `npm run check:python`에도 연결되어 있다. 관련 파일을 변경하는 PR에서는 Linux에서 원본을 읽는 별도 검증도 실행한다. 이 검증은 작업 디렉터리에만 쓰고 데이터 게시 자격 증명을 사용하지 않는다.
