# 만나의집(기숙사 식당) 식단 자동화

만나의집은 기존 SU Lounge와 별도 식당입니다. SU Lounge의 수집기·데이터·식단 표시는 그대로 사용합니다. 만나의집은 GitHub Actions에서 이미지를 분석하고, 앱은 공개 Pages JSON만 조회합니다.

```text
Actions Secrets → 원본 API → 이미지 메모리 다운로드 → SHA-256 비교
→ 변경 시 원본·확대 조각의 메뉴 열과 재료 열을 독립 전사
→ 날짜 세트 일치 확인 후 병합
→ 검증된 공개 JSON
→ 기존 일일 자료와 함께 GitHub Pages 배포
```

## 등록할 값

저장소 `Settings → Secrets and variables → Actions → Secrets → New repository secret`에서 다음 두 이름을 등록합니다. 실제 값은 공개 파일·문서·이슈·로그에 붙이지 않습니다.

| 이름 | 등록 위치 | 용도 |
| --- | --- | --- |
| `HAKSIK_API_URL` | Actions Secret | 사용자가 확인한 원본 API 전체 주소 |
| `OPENAI_API_KEY` | Actions Secret | 이미지 분석용 OpenAI 프로젝트 키 |
| `OPENAI_MODEL` | Actions Variable, 선택 | 기본값 `gpt-6.1-sol`을 다른 이미지·Structured Outputs 지원 모델로 변경 |
| `NEXT_PUBLIC_CAFETERIA_JSON_URL` | Vercel 앱 공개 환경변수 | 정상 배포한 공개 Pages JSON 주소만 지정한 뒤 앱 재배포 |

원본 주소는 Actions의 수집 단계에만 전달됩니다. Vercel 환경변수나 `NEXT_PUBLIC_` 변수에 등록하지 않습니다. `.env.example`의 빈 `HAKSIK_API_URL=`은 이름을 안내하기 위한 것이며, 실제 수집은 GitHub Actions에서만 실행합니다. 필요한 Secret이 비어 있으면 변수 이름만 포함한 오류로 중단합니다.

기본 모델은 복잡한 두 주 식단표에서 요일·끼니·메뉴/재료 열과 작은 한글을 구분하도록 `gpt-6.1-sol`과 `xhigh` 추론을 사용합니다. [공식 모델 문서](https://developers.openai.com/api/docs/models/gpt-6.1-sol)에서 이미지 입력·Responses API·Structured Outputs 지원을 확인할 수 있습니다. 기본 모델에는 원본 해상도 입력(`detail: original`)을 사용하고, 다른 모델로 변경하면 호환되는 `high` 입력을 사용합니다. 요청별 최대 출력 토큰은 40,000이며, 제한 시간은 480초이고 재시도는 한 번입니다. 컬러 원본과 겹침이 있는 균등 3×3 조각을 준비하고, 메뉴 열 전사와 재료 열 전사를 두 요청으로 병렬 실행합니다. 각 요청은 같은 원본과 확대 조각만 받으며 다른 응답을 교열하거나 다시 쓰지 않습니다. 두 결과의 날짜 세트가 완전히 같고 각각의 데이터 검증이 성공한 경우에만 같은 `updatedAt`으로 병합합니다. 메뉴가 모두 판독 불가이면 게시를 중단하지만, 재료가 모두 미제공이면 `null`로 유지합니다. 조각만 `sharp`로 회색조 변환한 뒤 최대 4배 nearest 확대하여 작은 글자의 색 번짐을 줄입니다. 확대 배율은 각 조각의 긴 변이 4096픽셀을 넘지 않도록 제한하며, 짧은 변은 최소 1픽셀을 유지합니다. 문자를 이진화하거나 다시 그리지 않으며 고정된 식단 위치도 가정하지 않습니다. 모든 바이트와 Base64 Data URL은 메모리에서만 처리합니다. 입력은 10MiB·16M픽셀, 원본과 확대 조각의 합은 요청별 30MiB로 제한합니다. 한 셀의 줄바꿈은 이어 읽고, 원문의 초성·중성·종성·쌍자음과 오타·비표준 표기 및 마침표·쉼표를 그대로 보존하도록 확대 조각과 대조합니다. 음식명 사전이나 메뉴별 치환 규칙은 사용하지 않습니다. 초기 실제 검증에서 열 혼합·연도 추정·특식 누락과 메뉴명 오독이 발견되어 모델과 판독 규칙을 강화했습니다. 모델 변경 후에는 수동 실행과 실제 식단 대조로 품질을 확인합니다.

AI는 이미지의 월·일·요일과 인쇄된 연도만 추출합니다. 연도가 없으면 이미지 HTTP `Last-Modified`의 연도 전후에서 수정 시각과 45일 이내이고 요일이 일치하는 날짜가 유일할 때만 확정합니다. 실행 시각은 `updatedAt`에만 사용합니다. 이미지 연도와 수정 시각이 충돌하거나 연도 근거가 없으면 게시를 중단합니다. 수정 시각은 식단 게시 시점의 근거로 사용하므로 오래된 표를 다시 올린 경우에는 운영자 확인이 필요합니다.

## GitHub Pages 설정과 실행

1. 저장소 `Settings → Pages → Build and deployment → Source`를 `GitHub Actions`로 설정합니다.
2. 새 코드가 `main`에 반영된 뒤 `Actions → Weekly Crawl - 만나의집 (기숙사 식당) → Run workflow`에서 `main`으로 실행합니다.
3. 수집·검증·Pages 배포 단계가 성공했는지 확인합니다.
4. 공개 [식단 JSON](https://syu-kr.github.io/campus.syu.kr/cafeteria/student-restaurant-1.json)을 확인합니다. 실제 첫 수집 전에는 JSON이 없으며, 예시 메뉴를 실제 데이터로 게시하지 않습니다.
5. Vercel에 `NEXT_PUBLIC_CAFETERIA_JSON_URL=https://syu-kr.github.io/campus.syu.kr/cafeteria/student-restaurant-1.json`을 등록하고 앱을 다시 배포합니다. `/campus/cafeteria` 상단의 `SU-Lounge`·`만나의 집` 버튼으로 식당을 선택하고 오늘의 메뉴와 주간 메뉴를 확인합니다.

워크플로는 예약 실행과 수동 실행만 허용하고 공식 저장소의 `main`에서만 동작합니다. PR 코드에 Secret을 전달하는 트리거가 없습니다. 저장소 쓰기 권한과 자동 커밋은 필요하지 않습니다. Pages 배포용 `pages: write`, `id-token: write`와 소스 조회용 `contents: read`만 사용합니다.

예약은 월요일 오전 07:00 KST 수집과 09:00 KST 재확인입니다. 첫 수집 뒤에 새 이미지가 올라올 수 있어 재확인하며, 변경이 없으면 AI 분석과 재배포를 생략합니다. `.github/workflows/student-restaurant.yml`의 `cron: "0 22 * * 0"`은 일요일 22:00 UTC, `cron: "0 0 * * 1"`은 월요일 00:00 UTC를 뜻합니다. 변경할 때 KST에서 9시간을 빼고 요일도 함께 변환합니다. Actions 예약은 실행 대기나 지연이 발생할 수 있습니다.

## 데이터·상태·기존 배포 보존

| 경로 | 내용 | 공개 여부 |
| --- | --- | --- |
| `public/cafeteria/student-restaurant-1.json` | `updatedAt`, `weekStart`, `days`만 포함한 최종 식단·원문 재료 | Pages에 게시 |
| `.cache/student-restaurant/state.json` | 마지막 성공 이미지 해시와 공개 JSON 검증 정보 | Pages·Git·프론트엔드에 포함하지 않음 |
| 이미지 바이트·Base64·원본 API 응답 | 실행 중 메모리에서만 처리 | 저장·배포·로그 출력하지 않음 |

이미지 경로가 같아도 바이트가 달라지면 다시 분석합니다. 이미지 해시·현재 공개 JSON·분석 버전·분석 문맥 해시가 성공 상태에 일치할 때만 AI 호출을 건너뜁니다. 문맥 해시는 이미지 수정 시각과 실제 모델을 포함하므로 같은 바이트라도 날짜 근거나 모델이 달라지면 재분석합니다. 상태가 없어졌거나 JSON이 없거나 일치하지 않으면 다시 분석하므로, 첫 실행에서 공개 파일이 없는 상태를 건너뛰지 않습니다. 분석 방식이 바뀐 경우 기존 체크포인트도 한 번 다시 분석합니다.

내부 상태는 Actions cache의 별도 파일로 복원하며, 검증과 Pages 배포가 성공한 뒤에만 저장합니다. 공개 결과가 이미 같아 배포를 생략한 경우에도 검증된 상태를 저장합니다. 분석·준비·배포 실패 실행의 상태는 다음 실행에 성공본으로 복원되지 않습니다. 캐시가 만료·삭제되면 AI 호출이 한 번 더 발생할 수 있습니다. 공개 저장소의 캐시는 다른 워크플로나 PR에서 읽을 수 있으므로 Secret 저장소로 간주하지 않습니다. 캐시에는 해시만 저장하고 주소·키·원본 응답은 넣지 않습니다.

Pages 아티팩트는 전용 출력 디렉터리에서 허용된 JSON과 기존 Pages 진입 파일만 작성합니다. 저장소나 `public/` 전체를 업로드하지 않습니다. 기존 일일 공지·SU Lounge·공휴일 등의 버전 데이터는 그대로 함께 보존하며, 일일 수집과 롤백도 만나의집 JSON을 복원·검증해 유지합니다. 만나의집 JSON이 잘못되었거나 조회가 실패하면 배포를 중단합니다. 최초 파일이 없는 404만 허용합니다.

주간·일일·롤백은 모두 `crawl-data-pages` concurrency 그룹으로 전체 실행을 직렬화합니다. 월간 전화번호·학사 일정 수집은 Pages를 배포하지 않으므로 변경하지 않습니다. 기존 `Rollback Crawl Data`는 버전형 일일 자료를 되돌리며 만나의집 JSON은 최신 정상본을 유지합니다.

## 앱 연동과 갱신

`NEXT_PUBLIC_CAFETERIA_JSON_URL`을 위의 공개 Pages JSON 주소로 지정하고 앱을 다시 배포해야 만나의집 연동이 활성화됩니다. 비어 있으면 브라우저 요청을 보내지 않고 미연동 상태를 안내합니다. 다른 Pages 프로젝트로 옮길 때도 해당 공개 JSON의 HTTPS 주소로 변경한 뒤 앱을 다시 배포합니다. 이 변수에는 원본 식단 API 주소를 넣지 않습니다. 브라우저에서는 원본 API나 OpenAI를 호출하지 않습니다.

앱은 공개 JSON을 런타임 검증하고 선택한 식당의 오늘의 메뉴를 위에, 주간 메뉴를 아래에 표시합니다. 기본 선택은 SU-Lounge입니다. 두 식당 모두 한국시간 기준 이번 주 월요일~일요일의 자료만 보여주며, 이전 주·다음 주 자료가 남아 있어도 이번 주 메뉴에 섞지 않습니다. 만나의집 JSON은 `weekStart`부터 연속된 두 주(최대 14일)를 보관하므로 이미지가 그대로여도 다음 주에는 해당 주의 메뉴가 표시됩니다. 만나의집에 이번 주 자료가 없으면 안내만 표시합니다. `[]`는 이미지에 식사 미제공이 명시된 경우이고, `null`은 읽기 어렵거나 제공 여부가 불명확한 경우입니다. 로딩·조회 실패·데이터 없음을 구분하고 이미지 추출 안내를 표시합니다. 실패한 AI 분석의 상세 상태나 원본 메타데이터는 공개 JSON에 추가하지 않습니다.

각 날짜의 기존 `breakfast`, `lunch`, `dinner` 메뉴 배열은 유지합니다. 새 수집 결과에는 `ingredients: { breakfast, lunch, dinner }`를 추가하며, 각 배열은 해당 끼니의 재료 셀을 위에서 아래로 읽은 원문 문자열입니다. 한 재료 셀의 줄바꿈만 이어 붙이고 중복이나 구두점은 유지합니다. 재료를 읽을 수 없거나 표에 없으면 해당 끼니는 `null`입니다. 예전 JSON에 `ingredients`가 없어도 앱과 배포 검증은 호환됩니다.

확인한 원본 API에는 식권 상품 설명만 있고 별도의 알레르기 필드가 없습니다. 원본 이미지의 파란 글씨는 ‘재료’이며 공식 알레르기 표시가 아닙니다. 앱은 원문 재료를 알레르기 확인 참고용으로 구분해 표시하고, 음식명이나 재료를 바탕으로 알레르기 유무를 추정하지 않습니다. 공식 알레르기 정보는 미제공 상태로 안내하며 알레르기가 있는 이용자는 식당에 확인해야 합니다.

앱은 `no-store`로 요청하고 화면이 열려 있는 동안 30분마다 재조회합니다. CSP는 같은 공개 URL 검증을 거친 HTTPS Origin만 연결 허용 목록에 추가합니다. Pages의 CDN 캐시는 앱에서 삭제할 수 없으므로, 배포 직후에는 JSON의 `updatedAt`과 날짜를 직접 확인합니다. 공개 JSON은 인증 없이 읽는 용도이며, 커스텀 호스팅을 사용할 경우 JSON 응답·CORS 허용·캐싱 설정을 함께 확인합니다.

## 로컬 Mock 검증

실제 Secret과 외부 API 없이 다음 검증을 실행합니다.

```bash
npm ci
npm run test:unit -- scripts/student-restaurant.test.ts scripts/student-restaurant-openai.test.ts lib/student-restaurant.test.ts lib/cafeteria.test.ts scripts/publish-crawl-data.test.ts scripts/student-restaurant-workflow.test.ts app/features/cafeteria/StudentRestaurantMenu.test.tsx app/features/cafeteria/CafeteriaPageClient.test.tsx proxy.test.ts
npm run type-check
npm run check:crawl-data
```

수집·이미지 호스트/경로 검증·해시 비교·AI 생략·스키마·실패 시 이전 자료 보존은 Mock으로 확인합니다. Pages 통합 테스트는 기존 자료 보존과 공개 아티팩트에서 내부 상태·원본 이미지·기타 파일이 제외되는지도 확인합니다. 실제 외부 API의 현재 응답, 이미지 품질, OpenAI 권한·비용, Pages 설정과 실제 배포 성공은 별도 운영 확인 대상입니다.

## 장애 대응

- Secret 미설정: Actions Secrets에서 필요한 이름과 값의 존재를 확인하고 수동 재실행합니다. 확인을 위해 값을 출력하지 않습니다.
- 원본 연결·응답·이미지 실패: 주소·응답을 로그에 붙이지 말고 원본 서비스를 별도로 점검한 뒤 재실행합니다. 마지막 정상 Pages 자료를 유지합니다.
- 날짜 불확실·분석 거부·스키마 실패: 기존 JSON을 유지합니다. 읽을 수 있는 원본 식단이 게시된 뒤 재실행합니다. 실행일로 누락 날짜를 채우거나 가상 메뉴를 넣지 않습니다.
- OpenAI 인증·연결 실패: 등록된 키의 권한·프로젝트 상태를 운영자가 확인한 뒤 재실행합니다. 키를 로그·이슈에 남기지 않습니다.
- Pages 준비·배포 실패: Source와 environment protection, 공식 배포 단계의 오류를 확인하고 재실행합니다. 공개 배포 전환은 완성된 아티팩트 단위이며 이전 배포를 먼저 삭제하지 않습니다.
- 캐시 상태 불일치: 공개 JSON과 상태 검증이 맞지 않으면 자동으로 다시 분석합니다. 강제 재분석이 필요하면 Actions Caches에서 `student-restaurant-state-v1-` 캐시를 삭제하고 수동 실행합니다.

## 보안 한계

주소와 키는 Secrets로 주입하고 오류는 고정된 안전한 메시지로 처리합니다. 이미지 URL은 Secret 주소의 Origin과 검증한 이미지 경로로 생성하며, 다른 호스트로 이동하는 응답을 신뢰하지 않습니다. OpenAI에는 원본과 확대 조각의 Base64 Data URL만 보내므로 원본 서버 주소가 요청에 들어가지 않습니다. 타임아웃·응답 크기·이미지 콘텐츠 타입도 검증합니다.

구현 중 읽기 전용 확인에서는 원본 HTTP 응답을 받았고 HTTPS 연결은 시간 초과되었습니다. 이것만으로 HTTPS가 영구적으로 지원되지 않는다고 단정할 수는 없습니다. 원본을 HTTP로 설정하면 API 응답과 이미지 전송은 암호화되지 않습니다. 네트워크 관찰과 변조 위험은 Secret 등록만으로 해결되지 않으며, HTTPS를 지원한다고 위장하거나 TLS 검증을 끄지 않습니다. HTTPS 지원이 확인되면 Secret에 HTTPS 주소를 등록합니다.

GitHub Secrets는 저장소 관리자, 악성 워크플로 변경, runner 또는 공급망 침해에 대한 절대적인 비밀성을 보장하지 않습니다. 워크플로 변경 검토와 저장소 접근 관리는 필요합니다. 원본 엔드포인트를 숨기는 것과 메뉴 내용·제3자 서비스의 이용 권한은 별도 문제이며, 공개 JSON에는 메뉴·재료·날짜 외의 출처 식별 정보나 이미지를 넣지 않습니다.
