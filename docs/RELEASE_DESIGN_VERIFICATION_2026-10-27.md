# 2026-10-27 배포 전 디자인·접근성 검증

이 문서는 로컬 프로덕션 빌드에서 확인한 디자인·반응형·키보드 동작과 남은 검증을 구분한다. 실제 병합·배포, 실기기 검증, Google 번역 품질·요금, 관리자 운영 데이터 변경의 증거를 대신하지 않는다.

이 검증 뒤 사용자 요청으로 점검 안내를 상단형에서 팝업형으로 전환했다. 아래 수치·상단 배너 캡처는 해당 후보의 기록이며, 현재 팝업 동작과 후속 검증은 [팝업 전환 기록](BANNER_POPUP_2026-10-27.md)을 따른다.

## 판정과 검증 대상

- `baseline-ui`, `fixing-accessibility`, `playwright` 스킬의 기준을 기존 M3 토큰·컴포넌트에 적용했다. 새 UI 라이브러리는 추가하지 않았다.
- Node `24.22.1`, 로컬 Next 프로덕션 서버, Playwright Chromium headless를 사용했다. 공개 데이터 설정은 `PUBLIC_DATA_BACKEND=firebase`, `SERVICE_NOTICES_SOURCE=hybrid`였다.
- 첫 최종 후보 빌드 `-_MuZfGKpnO9GFD5DPX7z`에서 37경로 × 한국어/영어 × 1440/390px, 총 **148화면**을 확인했다. HTTP 상태·문서 언어·가로 넘침·빈 본문·브라우저 예외 검사는 모두 통과했다.
- 이 후보의 전체 하네스 결과는 **실패**였다. `/en/campus/bus-info` 두 화면에 `구리 bound`가 남아 전체 영어 검사에 실패했다. 레이아웃 148화면 통과를 전체 영어·기능 통과로 확대하지 않았다.
- 상단 배너 지연 삽입과 영문 별칭 누락을 수정한 최종 빌드 `lrmhHPNyXv66uZHVDXs1W`에서는 **148화면 전체 하네스가 통과**했다. 모바일 배너 삽입 이동도 제거했다. 실제 셔틀 API 장애·로컬 지도 실패와 실기기 미검증은 별도로 남는다.

## 이번에 발견한 문제와 조치

| ID | 위치·문제 | 사용자 영향·원인 | 조치 / 판정 |
| --- | --- | --- | --- |
| D01 | 전체 공개 페이지의 이미지 포함 상단 배너 | 576×360 이미지에 기존 16:5 `cover`를 적용하면 사진·현수막의 문맥을 잘라낸다. 큰 전체 폭 이미지도 첫 화면을 지나치게 차지한다. | `managed-banners.css`에서 상단 배너만 데스크톱 240×150 이미지/우측 문구, 모바일 112×70 이미지/제목과 하단 문구로 구성했다. `object-fit:contain`으로 전체 이미지를 보존했다. 기존 M3 색상·모서리 토큰을 사용했다. |
| D02 | 최초 서버 배너 조회가 빈 배열인 경우 | 서버 조회 예산 초과 뒤 빈 목록으로 내려오면 기존 30초 주기까지 새 공지가 보이지 않을 수 있다. | `ManagedBanners.tsx`에서 최초 목록이 비어 있을 때만 마운트 즉시 한 번 조회한다. 최초 배너가 있으면 추가 초기 조회하지 않는다. 두 경우 회귀 테스트를 추가했다. |
| D03 | 영어 버스 정보의 구리행 제목 | `formatRouteBoundLabel("구리", "en")`의 고정 별칭이 없어 `구리 bound`가 표시됐다. 구글 번역 응답 실패가 아니라 기본 표시 별칭 누락이다. | `public-content-aliases.ts`에 `구리: "Guri"`를 추가했다. 원본 한국어 값은 유지하고 EN·KO 검증을 기존 테스트에 추가했다. |
| D04 | 상단 배너가 있는 모바일 홈의 최초 표시 | `layout.tsx`의 `Suspense fallback={null}`에서 배너가 스트리밍된 뒤 본문이 약 207px 내려갔다. 캐시된 정상 조회에서도 나타날 수 있다. | `RootLayout`이 제한 시간 내 공개 배너 조회를 기다리고 `ManagedBanners`를 첫 shell에 렌더하도록 수정했다. 임의 높이 예약·정적 배너 복제·조회 제한 확대는 하지 않았다. 최초 측정 KO 0.1940, EN 0.2305의 재검증은 아래에 구분한다. |

선택지·검색 조건·검증 규칙·저장 키·공지 원문 이동 정책은 변경하지 않았다. 시간표 격자나 일반 목록을 둥근 카드로 다시 바꾸지 않았다.

## 반응형·키보드·상태 검증

| 범위 | 실제 실행과 결과 | 한계 |
| --- | --- | --- |
| 37경로 전체 | 148화면 HTTP 200, `html lang`, 비어 있지 않은 `main`, 가로 넘침 ≤1px, 브라우저 예외 0 | 룸메이트 비활성 화면/리다이렉트와 존재하지 않는 일정 방의 오류 복구까지 확인했다. 로그인 후 실제 운영 기록은 보지 않았다. |
| 자동 영어 표시 | 공개 데이터 23파일을 현재 로컬 GET API에서 읽고, 기존 공개 필드 resolver에 연결했다. 번역은 한국어 필드만 대체하는 로컬 응답 fixture. 4건의 번역 실패→원문 유지→재시도 복구, KO→EN→KO→EN 왕복 통과 | 실제 번역 품질·외부 Google 호출 검증이 아니다. 최초 148화면의 미번역 1건은 D03이다. |
| 대표 5경로 | 홈·시간표·졸업요건·서비스공지·더보기 × KO/EN × 1440/390/320px = 30화면. 기본 및 CSS 루트 글꼴 200%에서 가로 넘침 없음, 보이는 컨트롤 이름 누락 없음, 양수 tabindex 없음, 이미지 alt 누락 없음 | CSS 루트 글꼴 200%는 OS 글자 크기나 브라우저 전체 확대 200%를 완전히 재현하지 않는다. 접근 가능한 이름은 DOM 휴리스틱 검사다. |
| 키보드 3폭 | 검색 열기 시 입력창 포커스, Tab/Shift+Tab 모달 내부 유지, Escape 복귀, 언어 Select의 End/Escape와 원래 버튼 복귀. 데스크톱 메뉴 ArrowDown 첫 항목·Escape 메뉴 복귀 | 실제 스크린리더 음성 출력은 미검증이다. |
| 검색 즉시 이동 | 320/390/1440px에서 입력 도중 메뉴 즉시 표시, 공지 요청 없이 메뉴 탐색, Enter 검색, 외부 클릭/Escape 닫기·포커스 복귀 통과 | 실제 공지 검색의 모든 결과 조합은 재실행하지 않았다. |
| 검색 복귀 지연 환경 | 320/390px × KO/EN, CPU 6배 지연, 즉시 일반 클릭으로 시간표 이동 4건. 검색어·세션 문맥·복귀 링크·결과 포커스 모두 유지 | 로컬 CPU 에뮬레이션이며 실제 저사양 기기 측정이 아니다. |
| 페이지 선택 Select | 최종 빌드의 통합·학사공지 × 1440/390px, 4건. 531/317페이지의 긴 목록 스크롤, End 마지막 항목, Escape 포커스 복귀, 숫자 typeahead, 선택 후 query/hash 유지·뒤로가기 복원, 아이콘 중앙 정렬·잘림 없음 | 로컬 DOM 반응 측정이며 실기기 터치와 느린 하드웨어를 대표하지 않는다. |
| 모션 감소 | 대표 화면의 헤더·선택 표시기에서 `prefers-reduced-motion:reduce`일 때 transition 0초, animation 없음 | 모든 CSS 애니메이션의 전수 감사를 의미하지 않는다. |
| 최종 번역 오류 복구 | 초기 HTML 5경로, JS 비활성 홈 placeholder의 비가시·포커스 제외, 약관↔홈 SPA 이동, 320px 루트200% 오류 안내 잘림 없음·재시도 뒤 status 포커스 유지·다음 Tab으로 재시도 버튼 복귀 통과 | 번역을 의도적으로 실패시킨 상태다. 새 전역 배너도 번역 대상이므로 약관에서 번역 상태가 남는 것은 정상이며, 이를 반영해 기존 하네스의 기대값을 수정했다. |
| 관리자 | 로그인/대시보드/공지·배너 편집 등 26화면, 13흐름. 320/390/1440px에서 저장, 미리보기→발행, 충돌 시 입력 유지, 이동 취소, 보관/복구, 로그아웃·권한 상실 후 private 상태 비우기 통과 | Firebase 인증·관리자 POST·미디어 업로드는 전부 fixture다. 실제 발행/삭제 요청을 보내지 않았다. |
| 실제 공개 점검 배너 | 1440/390/320px의 일반·CSS 루트200% 총 6상태. 미디어 576×360, contain, 문구 잘림 없음, 닫기 버튼 없음, `16:00–17:00` 문구 확인 | 공개 GET만 사용했다. 클라우드 발행·번역 확인은 별도 운영 증거다. |

배너 높이는 데스크톱 약 176px, 모바일 약 175.4px였다. 1440·390px 스크린샷을 눈으로도 확인했고 사진 전체, 제목, 일정 문구가 서로 겹치지 않았다. 영어 번역의 길이 변화와 로컬 번역 실패 상태도 별도로 구분했다.

## 배너가 포함된 모바일 성능 표본

`390×1000`, 새 브라우저 context, CPU 4배 지연, 네트워크 지연 150ms·다운로드 1.6Mbps 조건에서 KO·EN 각 1회 측정했다. 요청 라우팅으로 브라우저 HTTP 캐시는 비활성화했고 서버 캐시는 초기화하지 않았다. `load` 이후 1.5초 및 추가 4.5초를 관측했다. 번역 POST와 모든 업무 쓰기는 차단했다.

| 후보 빌드 | KO | EN | 원인 |
| --- | --- | --- | --- |
| `-_MuZfGKpnO9GFD5DPX7z` | 누적 shift 0.1940 | 누적 shift 0.2305 | 두 언어에서 배너 삽입에 따른 약 0.194 이동. EN의 나머지는 의도적 번역 실패 안내 높이 변화와 날씨 문장 줄바꿈이다. |
| `lrmhHPNyXv66uZHVDXs1W` | 누적 shift 0.0001044 | 누적 shift 0.0360082 | 초기 HTML에 배너가 포함돼 약 0.194의 배너 삽입 이동이 제거됐다. EN의 실패 안내·날씨 변화는 남는다. |

이 수치는 소수 로컬 표본의 `layout-shift` 합이며, 실제 사용자의 75백분위 Core Web Vitals나 엄밀한 CLS 세션 윈도 집계가 아니다. 수치를 숨기거나 배너 이미지 로딩 성공만으로 성능 통과라 판정하지 않는다. 서버가 1초 안에 배너를 읽지 못해 빈 목록을 반환한 뒤 클라이언트에서 복구하는 경우의 이동 가능성은 별도의 한계다.

수정 후 측정은 새 프로세스에서 공개 문서를 먼저 요청하지 않고 시작했다. 여기서 cold는 **새 Node 프로세스의 첫 공개 문서 요청**을 뜻한다. `.next/cache`, Firebase·CDN 캐시는 비우지 않았으며 완전히 캐시가 없는 운영 첫 요청을 재현한 것은 아니다. 첫 KO 요청과 이어지는 EN 요청 모두 HTTP 200, 응답 HTML을 JSDOM으로 파싱한 실제 `.m3-managed-banners-site-top .m3-managed-banner` 1개·이미지 포함을 확인했다. RSC 스크립트의 문자열 존재만으로 판단하지 않았다. 런타임의 첫 `main` 관측도 KO 약 1,389ms·EN 약 1,119ms부터 y=272.39px였고, 이후 배너 때문에 `main`이 내려가는 shift는 없었다. 별도 first-paint timestamp는 수집하지 않았다.

TTFB는 각각 **580ms**, **49.3ms**였으며, 최초 KO 전체 응답 수신은 약 6.04초였다. 느린 네트워크·다른 홈 데이터 스트리밍도 포함하므로 이를 배너 DB 조회 시간으로 해석하지 않는다. 수정 전 같은 표본에 TTFB를 저장하지 않았으므로 정확한 전후 TTFB 증감은 주장하지 않는다. 첫 cold 표본 1회로 모든 서버 cold start 성공을 보장할 수 없으며, 1초 조회 예산은 그대로 유지했다.

## 소스 검사

- 배너 `ManagedBanners.test.tsx`와 `PublicContentViews.test.tsx`: 2파일 17테스트 통과.
- 별칭 `public-content-aliases.test.ts`와 셔틀 `ShuttleSection.sources.test.tsx`: 2파일 10테스트 통과.
- 최초 shell·비공개 제외 회귀 `layout.banners.test.tsx`, 기존 `layout.test.tsx`, `ManagedBanners.test.tsx`, `public-managed-content.test.ts`: 4파일 55테스트 통과. 여기에는 앞선 배너 테스트가 포함되므로 모든 숫자를 단순 합산하지 않는다.
- 전체 `tsc --noEmit --incremental false`, 변경 파일 ESLint, `git diff --check` 통과.
- 새 의존성·실제 Google 호출·관리자 운영 데이터 변경·실제 병합·배포를 이 디자인 검사에서 실행하지 않았다.

## 최종 재검증

제품 소스 `918e0c6`, 최종 빌드 `lrmhHPNyXv66uZHVDXs1W`에서 첫 cold SSR·모바일 성능을 위와 같이 확인했다. 설정은 동일하게 Firebase 공개 데이터·서비스공지 hybrid다. 최종 **148화면 재순회와 4개 번역 실패 복구, 언어 왕복을 모두 통과**해 하네스 exit 0 / `complete:true`를 확인했다. 번역 fixture 116batch, 공개 필드 resolver 오류 0, 최종 잔여 한글 0, 브라우저 예외 0, Google 호출 0이었다. 사적 입력은 번역 payload에 포함되지 않았고 실제 업무 쓰기는 보내지 않았다.

페이지네이션 4흐름과 320px 번역 오류·포커스/JS 비활성·SPA 검사는 최종 빌드에서 통과했다. 추가 30대표 화면·관리자 26화면/13흐름·검색 검사의 근거는 앞선 후보 빌드로 구분한다. 최종 순회 중 추가 배포 변경은 없었다. 이후 제거한 미사용 `ManagedBannerPlacement.tsx`는 최종 빌드에서 이미 참조되지 않았던 파일이다.

### 실제 API·외부 기능과 화면 판정의 차이

최종 순회에서는 번역 fixture와 분리해 실제 로컬 GET 응답을 기록했다. 문서 HTTP 200·레이아웃 정상은 외부 제공자의 정상 작동을 보장하지 않는다.

| 기능 | 관측 결과 | 판정 |
| --- | --- | --- |
| 셔틀 실시간 위치 | `/api/bus/shuttle` HTTP 502 4회(KO/EN × 두 폭). “실시간 위치 정보를 불러오지 못했습니다. 잠시 후 다시 확인하거나 아래 시간표를 확인해주세요.” 표시 | 기존 원본 장애가 남는다. 오류 복구 안내와 정적 시간표 표시를 확인했으며 실시간 위치 정상으로 판정하지 않는다. |
| 존재하지 않는 일정 방 | `/api/meet/rooms/unavailable` HTTP 404 4회 | `unavailable`은 검증에 사용하는 존재하지 않는 방 ID다. 의도된 오류 복구 검사이며 실제 운영 일정 방을 만들거나 수정하지 않았다. |
| 캠퍼스 지도 | “지도를 불러오지 못했습니다”, “외부 지도에 연결하지 못했어요. 건물 검색과 시설 목록은 계속 이용할 수 있습니다.” 표시 | 로컬 4183에서 외부 지도 표시 미확인. SDK 허용 origin·쿠키·네트워크 중 실제 원인은 이번 검증으로 확정하지 않았다. 시설 목록 대체 UI와 지도 자체 성공을 구분한다. |
| 강의·도서관·날씨 | `/api/lecture/timetable`, `/api/library/reading-rooms`, `/api/weather` GET 200 관측 | 해당 로컬 응답을 확인한 범위다. 제공자 데이터의 최신성·모든 분기 정상까지 보장하지 않는다. |
| 공개 배너·미디어 | `/api/banners`와 공개 이미지 GET 200 관측 | 공개 표시 성공이다. 관리자 업로드 권한·실제 수정 흐름은 별도 운영 검증이 필요하다. |
| 자동 번역 | UI 하네스는 로컬 fixture 성공/503 실패를 주입했다. Google 호출 0 | 실제 Google 동작·할당량·캐시 비용 판정은 별도의 실연동 증거를 따른다. |

## 남은 수동 확인

1. 실제 iOS Safari·Android Chrome에서 키보드/IME, 주소창 높이 변화, Select·검색 모달 스크롤, 뒤로가기, 터치 타깃을 확인한다. 데스크톱 Firefox·Safari도 미검증이다.
2. 실제 브라우저 확대 200%, OS 글꼴 확대, VoiceOver/TalkBack/NVDA에서 이름·순서·상태 안내를 확인한다. 이번 검사는 WCAG 전체 적합 인증이나 모든 색상 조합의 대비 감사를 대신하지 않는다.
3. 배포 SHA를 확인한 뒤 모바일 홈 최초 진입·새로고침에서 배너와 이미지가 첫 화면에 보이고, 영어 일정의 숫자가 바뀌지 않으며, 점검 완료 후 관리자가 배너를 내릴 수 있는지 확인한다.
4. 실제 번역 성공/할당량 초과·지도 쿠키 차단·원본 셔틀 장애·느린 이동통신·PWA 캐시 갱신을 배포 후 확인한다. 로컬 fixture 성공만으로 외부 제공자 정상 여부를 단정하지 않는다.
5. 실사용 성능, Google 번역 청구·캐시 재사용량, Firebase TTL 삭제 지연·Storage 권한은 운영 관측 자료와 별도로 판단한다.

## 재현 자료와 실패 보존

Ignored 로컬 증거 경로는 `output/playwright/firebase-goal/release-design-20261027/`이다. 원본 JSON·스크린샷에는 공개 조회 결과와 fixture 상태만 기록했고 비밀값은 기록하지 않았다.

- `auto-translation-release-candidate.json`: 실행 도중 새 배너가 발행되어 기존 fixture resolver가 배너를 모르는 상태의 실패 기록. 공급자 제품 장애로 판정하지 않았다.
- `auto-translation-final.json`: 배너 공개 GET projection을 하네스에 반영한 148화면. 별칭 누락 D03 때문에 `complete:false`이며 원본을 유지한다.
- `auto-translation-ssr-final.json`: 최종 빌드 148화면·번역 복구·언어 왕복 `complete:true`. 실제 GET 502/404도 같은 파일에 남아 있으며 화면·fixture 성공에서 제외해 숨기지 않았다.
- `accessibility/results.json`: 30대표 화면·3키보드 흐름·실제 배너 6상태.
- `admin/fixture-browser.json`: 26관리자 화면·13흐름.
- `flows/search-compact-results.json`, `flows/early-search-regression.json`: 검색·복귀 검사.
- `flows/evidence-4183.json`: 최종 빌드의 긴 페이지 선택 Select·URL·뒤로가기 검사.
- `zoom/scope-zoom-focus-before-banner-expectation.json`: 배너가 없던 시절의 “약관에서는 번역 상태가 없어야 한다”는 기대값으로 실패한 원본. 새 전역 배너의 번역 상태를 제품 결함으로 판정하지 않았다.
- `zoom/scope-zoom-focus.json`: 전역 배너 번역 여부에 맞춘 기대값으로 재실행한 초기 HTML·JS 비활성·SPA·320px 오류 안내·포커스 결과.
- `cls/diagnostic.json`: 배너 스트리밍 문제의 최초 성능 표본.
- `cls-ssr/diagnostic.json`: 수정 후 첫 cold·warm HTML의 배너 포함, TTFB와 화면 이동량.

로컬 자료는 public 저장소에 올릴 필요가 없으며, 이 보고서가 검증 범위·발견·한계를 요약한다.

검증자가 시작한 4183 서버는 종료 표식으로 정리했으며 SIGTERM 종료와 포트 비어 있음을 확인했다. 종료 근거는 인접한 `release-design-20261027-ssr-qa-server/qa-server-report.json`에 있다. 다른 로컬 서버는 종료하지 않았다.

### 37개 경로 목록

각 경로의 한국어·`/en` 버전을 1440px와 390px에서 확인했다.

| 영역 | 경로 |
| --- | --- |
| 홈 | `/` |
| 통합 공지 | `/announcements`, `/announcements/academic/academic-758bcf11b6d7` |
| 학사 | `/academic`, `/academic/announcements`, `/academic/scholarship`, `/academic/sw-notices`, `/academic/schedule`, `/academic/competitions`, `/academic/timetable`, `/academic/graduation` |
| 캠퍼스 | `/campus`, `/campus/announcements`, `/campus/cafeteria`, `/campus/bus-info`, `/campus/library`, `/campus/map`, `/campus/phone`, `/campus/gym`, `/campus/health-center`, `/campus/campus-tips`, `/campus/campus-tips/suggest` |
| 룸메이트 | `/campus/roommates`, `/campus/roommates/unavailable`, `/campus/roommates/new`, `/campus/roommates/me`, `/campus/roommates/verify`, `/campus/roommates/verify/finish` |
| 더보기 | `/more`, `/more/meet`, `/more/meet/unavailable`, `/more/privacy` |
| 서비스 공지·정책·관리자 | `/service/notices`, `/service/notices/017-roommate-board`, `/terms`, `/privacy`, `/admin` |

공지 상세는 현재 발행된 스냅샷의 실제 ID를 사용했다. 이전 fixture의 과거 공지 URL 유효성이나 모든 과거 상세 링크의 마이그레이션 성공을 이 결과로 보장하지 않는다.
