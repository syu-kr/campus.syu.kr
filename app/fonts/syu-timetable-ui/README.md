# SYU Timetable UI

시간표의 1023px 이하 화면에 사용하는 Pretendard v1.3.9 기반 variable subset이다. 글자 형태와 굵기를 유지하면서 초기 UI에 필요한 파일만 받는다. 다른 페이지와 데스크톱에는 기존 Pretendard가 적용되며, 이 파일에 없는 강의명·기호도 기존 92개 subset으로 표시한다. 기존 폰트 파일은 변경하지 않았다.

- 독립 파생 폰트명: `SYU Timetable UI` / `SyuTimetableUI`.
- 문자 목록: [characters.txt](characters.txt). 2026-10-18 한국어·영어 390px 기본 화면, ASCII, 날씨·로딩 상태의 245개 문자에 2026-10-26 시간표의 빈 결과·공유·이전 정보 안내에 필요한 35개 문자를 더한 280개다. 강의 목록은 포함하지 않는다.
- 원본: [공식 Pretendard v1.3.9 variable WOFF2](https://raw.githubusercontent.com/orioncactus/pretendard/v1.3.9/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2).
- 원본 SHA-256: `9599f12fd42fc0bce1cd50b47a0c022e108d7aa64dd0d1bb0ed44f3282d900b4`.
- 생성 도구: FontTools 4.61.1, Brotli 1.2.0. 앱의 개발·실행 의존성에 추가하지 않는다.
- 원본 저작권과 SIL Open Font License는 [LICENSE.txt](LICENSE.txt)에 보존했다. 파생 폰트의 primary name에서 원본 Reserved Font Name을 사용하지 않는다.

## 재생성

저장소 루트에서 별도 도구 폴더를 사용한다. 아래 `python`은 해당 도구를 설치한 Python 실행 파일로 바꿀 수 있다.

```powershell
python -m pip install --target .cache/timetable-font-tools fonttools==4.61.1 brotli==1.2.0
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/orioncactus/pretendard/v1.3.9/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2' -OutFile .cache/timetable-font-tools/PretendardVariable.woff2
$env:PYTHONPATH = (Resolve-Path .cache/timetable-font-tools).Path
python scripts/build_timetable_ui_font.py --source .cache/timetable-font-tools/PretendardVariable.woff2
python scripts/build_timetable_ui_font.py --source .cache/timetable-font-tools/PretendardVariable.woff2 --check
```

생성기는 원본 hash, 문자 cmap, line metrics, 400·600·700에서 모든 대상 글자의 outline과 advance, `tnum`·`pnum`·`zero` 보존을 검사한다. `layout_features=["*"]`로 적용 가능한 OpenType 기능을 유지한다. 원본 head timestamp와 실제 `wght` 축 45/400/930을 보존하며, CSS 굵기 범위는 기존 선언과 동일한 45–920이다. 고정 도구 버전에서 `--check`는 font binary와 CSS의 byte 재현성도 확인한다.

문구가 바뀌면 문자 목록과 생성물을 함께 갱신한다. 빌드 후 모바일 ko/en의 실제 폰트 요청·조작 시간, 데스크톱의 기존 폰트 유지, 다른 경로로 이동한 뒤 font-family 복구를 확인한다. 파일 크기 감소가 조작 시간의 동일한 비율 개선을 보장하지는 않는다.
