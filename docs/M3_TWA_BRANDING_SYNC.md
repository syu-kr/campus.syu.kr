# M3 A 로고의 Android TWA 동기화

2026-10-25 기준으로 `public/images/*-m3.png`와 `public/manifest.json`을 원본으로 사용했다. `twa-android/twa-manifest.json`의 아이콘·마스커블·모노크롬·바로가기 URL을 새 M3 PNG 경로로 바꾸고, 테마색 `#2459d4`와 배경색 `#f6f8fc`를 Android Gradle 설정과 함께 맞췄다. `app/src/main/res/raw/web_app_manifest.json`은 공개 웹 매니페스트와 같은 내용으로 동기화했다.

기존 Android 리소스 40개와 `store_icon.png` 1개를 갱신했다. 런처 5개, 마스커블 5개, 바로가기 20개, 스플래시 5개, 알림 5개는 각각 기존 PNG의 가로·세로 해상도를 유지했다. 스토어 아이콘은 A 로고의 512px 원본과 정확히 같다. 알림은 흰색 RGB 한 색과 투명 알파만 사용하며, 배경을 채우지 않았다. 마스커블 배경은 불투명하고 로고의 가장 먼 지점은 이미지 너비의 29.45~30.38% 반경으로, 40% 반경 안전 영역 안에 있다. 기존 adaptive-icon XML의 8.5dp 여백도 변경하지 않았다.

`npm run check:twa`와 변경 파일의 `git diff --check`가 통과했다. 추가 검사에서 PNG 해상도, 알림의 단색·투명성, 마스커블 안전 영역, 새 아이콘 URL의 로컬 파일 존재를 확인했다. TWA 매니페스트의 브랜드 필드 외 설정과 Gradle의 테마·배경색 외 내용이 변경되지 않았음을 비교했다. 기존 스토어 스크린샷 6개와 feature graphic, adaptive-icon XML은 변경 전후 SHA-256이 동일하다. 검증 수치는 `output/playwright/m3-service/academic-twa-branding-check.json`에 저장했다.

APK/AAB 빌드·설치·서명·스토어 게시와 실제 Android 기기 검증은 실행하지 않았다. 키스토어 파일과 서명·버전 설정은 변경하지 않았다. 운영 적용 전에는 웹의 새 `*-m3.png` 경로를 배포한 뒤, 기존 릴리스 절차로 앱을 빌드하고 실제 기기에서 런처의 원형·둥근 사각 마스크, 콜드 스타트 스플래시, 알림의 밝고 어두운 배경, 4개 바로가기, 웹 앱 링크를 확인해야 한다. 이 로컬 검사는 운영 Digital Asset Links 응답이나 서명된 앱의 동작을 증명하지 않는다.
