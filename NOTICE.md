# Notice

SYU CAMPUS는 삼육대학교 공식 서비스가 아닌 비공식 학생 편의 서비스입니다.

현재 서비스는 자체 브랜딩을 사용하며 학교의 로고·교표·사진을 사용하지 않습니다. 아래 상표의 라이선스 제외 안내는 현재 학교 로고 사용을 뜻하지 않습니다. 향후 학교 자산을 추가한다면 해당 자산의 이용 조건을 확인해야 합니다.

## License Scope

루트의 `LICENSE`에 명시된 MIT License는 이 저장소의 소스 코드에 적용됩니다. 다음 항목은 별도 권리 또는 이용 조건의 적용을 받을 수 있으며 MIT License의 적용 대상에 포함되지 않습니다.

- 삼육대학교 명칭, 로고, 심볼 및 기타 상표
- `public/data/`에 포함된 크롤링·가공·제3자 데이터
- 외부 서비스에서 제공하는 이미지, 문서 및 콘텐츠

각 데이터와 자산의 권리는 원저작권자 또는 제공처에 있습니다. 재사용자는 해당 제공처의 이용약관과 라이선스를 직접 확인해야 합니다.

## Data Sources

서비스는 삼육대학교 공개 웹페이지, 공공데이터포털, 기상청, 지방자치단체 교통 API 등 공개적으로 접근 가능한 출처를 바탕으로 정보를 제공합니다. 데이터는 지연되거나 부정확할 수 있으므로 중요한 결정 전 공식 출처를 확인하세요.

주요 저장 데이터의 출처 범주는 다음과 같습니다.

| 경로 | 출처 범주 | 재배포 근거 상태 | 비고 |
| --- | --- | --- | --- |
| `public/data/announcements-*.json` | 삼육대학교 공개 공지 페이지 | 서면 허가 미확인 | 원문 링크와 작성자 정보를 포함한 가공 데이터 |
| `public/data/cafeteria-menu.json` | 삼육대학교 공개 식단 페이지 | 서면 허가 미확인 | 메뉴 정보를 구조화한 가공 데이터 |
| `public/data/phone-numbers.json` | 삼육대학교 공개 전화번호 안내 | 서면 허가 미확인 | 공개 업무 연락처를 구조화한 가공 데이터 |
| `public/data/schedules-major.json` | 삼육대학교 공개 학사일정 | 서면 허가 미확인 | 일정 정보를 구조화한 가공 데이터 |
| `public/data/graduation-requirements-2025.json`, `public/data/curriculum-courses-2025-verified.json`, `data-source/curriculum/curriculum-courses-2025-ocr.json` | 2025학년도 삼육대학교 요람 | 서면 허가 미확인 | 참고용 구조화·OCR 가공 데이터 |
| `public/data/graduation-requirements-2026.json`, `public/data/curriculum-courses-2026-verified.json`, `public/data/curriculum-course-selection-rules-2026.json` | 2026학년도 삼육대학교 요람 | 서면 허가 미확인 | 원문 대조·선택 제한을 포함한 참고용 구조화 데이터. 원문 링크는 `public/data/graduation-sources.json` 참조 |
| `public/data/shuttle-*.json` | 삼육대학교 공개 안내 및 운영 정보 | 서면 허가 미확인 | 실제 운영 정보와 다를 수 있음 |
| `public/data/campus-tips.json` | 학교 공식 페이지 및 외부 공개 안내 | 항목별 확인 필요 | 각 항목의 원문 링크와 출처 유형 포함 |

이 서비스는 학교 공개 자료를 수집하며 별도의 이용허락을 받지 않았습니다. 학교 자료의 객관적인 사실값과 원문 문장·사진·도표·편집물은 권리 판단이 다를 수 있습니다. 공개 웹페이지에서 접근 가능하다는 사실이나 별도 허가가 없다는 사실만으로 모든 수집·재배포를 일괄 허용 또는 금지로 판단하지 않습니다. 이 저장소의 MIT License가 위 데이터·상표의 권리까지 부여하지 않으며, 재사용자는 항목별 이용 조건과 필요한 권리를 확인해야 합니다.

출처별 근거에는 원문 주소, 적용 이용 조건과 확인일, 수집·가공·번역·AI 입력·공개 저장소 및 서비스 재배포의 허용 범위, 출처 표시 방법을 기록합니다. 문의·계약·권리 증빙 원문은 비공개로 보관합니다. 위 표의 ‘미확인’은 허가나 금지를 확정한 표기가 아니며, 별도 근거를 확인한 경우에만 상태를 갱신합니다.

### 공공 API별 확인 근거

다음은 **2026-11-04**에 공식 공공데이터포털의 개별 catalog와 현재 코드·로컬 설정을 대조한 결과입니다. API 활용 승인·호출 한도와 자료의 재사용 조건은 별개이며, 로컬 endpoint가 일치한다는 사실로 운영 배포의 환경변수까지 같다고 판단하지 않습니다.

| 자료·제공기관 | 현재 사용 경로와 연결 근거 | 공식 이용 조건 |
| --- | --- | --- |
| [한국천문연구원 특일 정보 · 15012690](https://www.data.go.kr/data/15012690/openapi.do) | `scripts/crawl_public_holidays.py`의 `SpcdeInfoService/getRestDeInfo`와 원문 주소가 공식 catalog와 일치 | [공식 catalog](https://www.data.go.kr/catalog/15012690/openapi.json): 이용허락범위 제한 없음 |
| [기상청 단기예보 조회서비스 · 15084084](https://www.data.go.kr/data/15084084/openapi.do) | `app/api/weather/route.ts`의 초단기 실황·예보 처리 및 로컬 `KMA_NCST_URL`·`KMA_FCST_URL`이 공식 `VilageFcstInfoService_2.0/getUltraSrtNcst`·`getUltraSrtFcst`와 일치. 운영 환경변수는 미확인 | [공식 catalog](https://www.data.go.kr/catalog/15084084/openapi.json): 공공누리 제1유형(출처표시), **제3자 권리 포함: 저작권 표시**. 날씨 문장과 상세 화면에 제공기관·제품 원문 링크·가공 여부를 표시. 제3자 권리의 구체적 범위·추가 조건까지 확인된 것은 아님 |
| [경기도 버스도착정보 조회 · 15080346](https://www.data.go.kr/data/15080346/openapi.do) | `lib/public-transit.ts`의 `GYEONGGI_BUS_ARRIVAL_URL` 호출과 로컬 `/6410000/busarrivalservice/v2/getBusArrivalListv2`가 공식 catalog와 일치. 운영 환경변수는 미확인 | [공식 catalog](https://www.data.go.kr/catalog/15080346/openapi.json): 이용허락범위 제한 없음. 이 조건을 서울·셔틀 등 다른 교통 출처에 확대하지 않음 |

제1유형은 출처 표시 조건 아래 상업·비상업 이용과 변경을 허용합니다. 제3자 권리가 포함된 부분은 해당 권리와 허용 범위를 따로 확인해야 합니다. [공공데이터포털 이용정책과 유형표](https://www.data.go.kr/ugs/selectPortalPolicyView.do)를 함께 적용하며 위 API의 조건을 학교 수집 자료에 적용하지 않습니다.

## Permission Checks

Google Translate 귀속 배지(`public/brand/google-translate/`)는 Google의 공식 귀속 자산입니다. 해당 폴더의 README에 출처와 이용 지침을 보존하며 Google의 상표·귀속 지침을 따릅니다.

- [삼육대학교 로고·UI 안내](https://www.syu.ac.kr/about-sahmyook/symbols-ui/logo-ui/)는 향후 학교 로고를 도입할 때의 참고 자료입니다. 현재 사용하지 않는 학교 로고의 허가를 현행 서비스의 미해결 사용 문제로 취급하지 않습니다.
- [공공데이터포털 이용정책](https://www.data.go.kr/ugs/selectPortalPolicyView.do)에 따라 각 데이터의 공공누리 유형과 출처 표시·상업 이용·변경 허용 범위를 확인해야 합니다. 제3자 권리가 포함된 데이터는 권리자의 정당한 이용허락이 별도로 필요할 수 있습니다.

## Removal Requests

권리 침해, 개인정보, 출처 정정, 데이터 또는 자산 삭제 요청은 공개 Issue에 권리 증빙이나 개인정보를 남기지 말고 `singhic@outlook.kr`로 전달해 주세요. 비민감 공개 데이터의 단순 오탈자 제보만 공개 Issue를 이용할 수 있습니다. 보안 취약점은 `SECURITY.md`의 비공개 제보 절차를 따라 주세요. 확인 후 합리적인 범위에서 신속히 조치합니다.
