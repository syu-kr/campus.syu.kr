# Notice

SYU CAMPUS는 삼육대학교 공식 서비스가 아닌 비공식 학생 편의 서비스입니다.

## License Scope

루트의 `LICENSE`에 명시된 MIT License는 이 저장소의 소스 코드에 적용됩니다. 다음 항목은 별도 권리 또는 이용 조건의 적용을 받을 수 있으며 MIT License의 적용 대상에 포함되지 않습니다.

- 삼육대학교 명칭, 로고, 심볼 및 기타 상표
- `public/data/`에 포함된 크롤링·가공·제3자 데이터
- 외부 서비스에서 제공하는 이미지, 문서 및 콘텐츠

각 데이터와 자산의 권리는 원저작권자 또는 제공처에 있습니다. 재사용자는 해당 제공처의 이용약관과 라이선스를 직접 확인해야 합니다.

## Data Sources

서비스는 삼육대학교 공개 웹페이지, 공공데이터포털, 기상청, 지방자치단체 교통 API 등 공개적으로 접근 가능한 출처를 바탕으로 정보를 제공합니다. 데이터는 지연되거나 부정확할 수 있으므로 중요한 결정 전 공식 출처를 확인하세요.

주요 저장 데이터의 출처 범주는 다음과 같습니다.

| 경로 | 출처 범주 | 비고 |
| --- | --- | --- |
| `public/data/announcements-*.json` | 삼육대학교 공개 공지 페이지 | 원문 링크와 작성자 정보를 포함한 가공 데이터 |
| `public/data/cafeteria-menu.json` | 삼육대학교 공개 식단 페이지 | 메뉴 정보를 구조화한 가공 데이터 |
| `public/data/phone-numbers.json` | 삼육대학교 공개 전화번호 안내 | 공개 업무 연락처를 구조화한 가공 데이터 |
| `public/data/schedules-major.json` | 삼육대학교 공개 학사일정 | 일정 정보를 구조화한 가공 데이터 |
| `public/data/graduation-requirements-2025.json`, `public/data/curriculum-courses-2025-ocr.json` | 2025학년도 삼육대학교 요람 | 참고용 구조화·OCR 가공 데이터 |
| `public/data/shuttle-*.json` | 삼육대학교 공개 안내 및 운영 정보 | 실제 운영 정보와 다를 수 있음 |
| `public/data/campus-tips.json` | 학교 공식 페이지 및 외부 공개 안내 | 각 항목의 원문 링크와 출처 유형 포함 |

공개 웹페이지에서 접근할 수 있다는 사실만으로 재배포 허가가 확인되는 것은 아닙니다. 이 저장소는 위 데이터와 상표 자산에 대한 별도 재배포 라이선스 또는 서면 허가를 보증하지 않습니다. 운영자는 공개 전 제공처 이용약관과 허가 근거를 확인·보관해야 하며, 재사용자는 필요한 권리를 별도로 확인해야 합니다.

## Permission Checks

- [삼육대학교 로고·UI 안내](https://www.syu.ac.kr/about-sahmyook/symbols-ui/logo-ui/)는 로고 파일 다운로드를 제공하지만 별도 재배포 라이선스는 명시하지 않습니다. 로고·상표 사용 허가가 필요하면 페이지에 안내된 커뮤니케이션팀(`supr@syu.ac.kr`, `02-3399-3808`)에 확인하세요.
- [공공데이터포털 이용정책](https://www.data.go.kr/ugs/selectPortalPolicyView.do)에 따라 각 데이터의 공공누리 유형과 출처 표시·상업 이용·변경 허용 범위를 확인해야 합니다. 제3자 권리가 포함된 데이터는 권리자의 정당한 이용허락이 별도로 필요할 수 있습니다.

## Removal Requests

권리 침해, 출처 정정, 데이터 또는 자산 삭제 요청은 GitHub의 [Data or asset removal request](https://github.com/syu-kr/campus.syu.kr/issues/new?template=data_removal_request.yml) 양식으로 전달해 주세요. 보안 취약점은 공개 Issue에 세부 정보를 남기지 말고 `SECURITY.md`의 비공개 제보 절차를 따라 주세요. 확인 후 합리적인 범위에서 신속히 조치합니다.
