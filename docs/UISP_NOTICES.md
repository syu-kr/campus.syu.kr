# 대학혁신지원사업단 공지

- 목록: `/academic/uisp-notices` (영문 `/en/academic/uisp-notices`)
- 분류: `uisp`, 상세 경로: `/announcements/uisp/uisp-<게시글 번호>`
- 원본: <http://uisp-origin.example.invalid/bbs/board.php?bo_table=notice>
- 데이터: `public/data/announcements-uisp.json`
- 수집: `python scripts/crawl_uisp_notices.py`, 기존 `npm run crawl:daily`에 포함

기존 공지 목록·홈 분류·학사 메뉴·서비스 검색·한영 화면·사이트맵·IndexNow 변경 감지에 연결한다. SW 공지와 마찬가지로 공모전 전용 집계와 일일 학사/장학 푸시에는 추가하지 않는다.

별도 의존성이나 환경변수는 필요하지 않다. 원본은 확인 시점에 HTTP만 제공하므로 이 출처의 공식 게시판 URL에만 HTTP를 허용한다. 다른 공지 출처의 HTTPS 검증은 유지한다. 게시글 번호로 ID와 URL을 구분하며, 목록의 두 자리 연도를 변환하고 말줄임 제목은 원문에서 복원한다. 현재 상단 공지는 첫 페이지를 기준으로 갱신한다. 목록에서 제공하지 않는 조회수는 표시하지 않는다.

HTTPS로 강제 전환하는 브라우저에서는 원문 링크가 열리지 않을 수 있다. 검증용 Chrome 157에서도 `HttpsUpgrades`에 따른 HTTPS 전환 후 원문 접근이 차단되었다. 원본 사이트의 HTTPS 지원이 필요하며 앱의 보안 정책을 낮추지 않는다.

목록·필수 필드·원문 제목 조회 실패나 반복 페이지는 저장 전에 실패한다. 일일 수집 실행기는 해당 출처의 이전 검증본을 보존하고 stale 상태를 기록한다. 정상 수집에서는 기존 글 구간을 만나면 종료하고 과거 글을 보존한다.

앱을 먼저 배포한 후 새 출처가 포함된 데이터 버전을 게시한다. 새 파일이 없는 기존 Pages/Firebase 버전도 읽을 수 있으며, 최초 게시 전에는 앱의 UISP 기준본을 사용한다. 이전 앱으로 되돌릴 때는 새 파일을 모르는 이전 앱의 검증 규칙에 맞는 데이터 버전도 함께 복원해야 한다.

초기 기준본은 2026-11-07에 원본 48페이지에서 수집한 714건이다. 게시일은 2019-03-27~2026-11-06이며 상단 공지는 4건이다. 새 AI 요약 생성과 실제 서비스 배포는 이 기준본 수집에 포함되지 않는다.

수집기 회귀 검사는 `python scripts/check_uisp_notices.py`이며 기존 `npm run check:python`에도 연결되어 있다.
