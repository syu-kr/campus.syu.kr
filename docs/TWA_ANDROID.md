# SYU CAMPUS Android TWA

## 확정된 앱 식별 정보

- 앱 이름: `SYU CAMPUS`
- Android application ID: `kr.syukr.campus`
- 운영 주체 표시: `SYU KR`
- 서비스 호스트: `campus.syu.kr`
- Web Manifest: `https://campus.syu.kr/manifest.json`
- 시작 URL과 범위: `/`
- 출시 형식: Android App Bundle (`.aab`)
- Bubblewrap 기준 버전: `1.25.0`
- target SDK: Android 16, API 36

## 저장소 역할

현재 저장소는 웹앱, 도메인 소유권 증명 파일, `twa-android/`의 Android 래퍼를 함께 관리합니다.
서명 키와 빌드 결과물은 Git에 커밋하지 않습니다.

현재 Android 프로젝트는 다음 조건으로 생성되어 있습니다.

- Bubblewrap CLI `1.25.0`
- Android Gradle Plugin `8.9.1`
- Gradle `8.11.1`
- JDK 17
- `minSdkVersion 23`, `targetSdkVersion 36`
- 앱 버전 `1.0.0`, 버전 코드 `1`

## Digital Asset Links

웹사이트는 `/.well-known/assetlinks.json`에서 Android 앱과 도메인의 관계를 선언합니다.
현재 `public/.well-known/assetlinks.json`에는 Play Console에서 확인한 앱 서명 키 인증서의
SHA-256 지문이 등록되어 있습니다. 인증서 지문은 공개 식별 정보이며 비공개 키나 업로드 키
비밀번호를 포함하지 않습니다.

Play Console에서 Play App Signing을 활성화한 뒤에는 다음 위치에서 앱 서명 키 인증서의 SHA-256 지문을 확인합니다.

`Play Console > 설정 > 앱 무결성 > 앱 서명 키 인증서`

`public/.well-known/assetlinks.json`에는 업로드 키나 디버그 키가 아니라 Play의 앱 서명 키
지문을 사용합니다. 앱 서명 키를 업그레이드하거나 교체하면 사용자 기기에 배포될 수 있는
인증서 지문을 다시 확인하고 필요한 지문을 배열에 반영합니다.

배포 후 다음 조건을 확인합니다.

- `https://campus.syu.kr/.well-known/assetlinks.json`이 리디렉션 없이 `200`을 반환한다.
- 응답 `Content-Type`이 `application/json`이다.
- 패키지 이름이 `kr.syukr.campus`이다.
- 설치된 앱 인증서의 SHA-256 지문이 배열에 포함된다.

## 로컬 검사

```powershell
npm run check:twa
npm run check:twa:release
```

이 명령은 manifest 식별자와 범위, 192/512 일반 아이콘, maskable/monochrome 아이콘,
Digital Asset Links 패키지 이름과 인증서 지문 형식을 검사합니다.
`check:twa:release`는 운영 설정에 디버그 인증서가 남아 있으면 실패합니다.

## Android 로컬 빌드

PowerShell에서 JDK 17과 Android SDK 경로를 설정한 뒤 Gradle Wrapper를 사용합니다.

```powershell
cd twa-android
$env:JAVA_HOME = "<JDK 17 경로>"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
.\gradlew.bat :app:assembleDebug
```

디버그 APK는 `twa-android/app/build/outputs/apk/debug/app-debug.apk`에 생성됩니다.
기기 또는 에뮬레이터가 연결되어 있으면 다음 명령으로 설치할 수 있습니다.

```powershell
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

릴리스 변형의 컴파일만 검증하려면 다음 명령을 실행합니다.

```powershell
.\gradlew.bat :app:bundleRelease
```

서명 설정 전 생성되는 `app-release.aab`는 미서명 검증 산출물이므로 Play Console에 업로드하지 않습니다.

## Android 빌드 순서

1. Bubblewrap 전용 JDK 17과 Android SDK를 준비한다.
2. Play Console에서 `kr.syukr.campus` 앱 레코드를 생성해 패키지를 먼저 등록한다.
3. `twa-android/`에 Android 프로젝트를 생성한다.
4. application ID를 `kr.syukr.campus`로 설정한다.
5. target SDK 36과 현재 앱 버전을 확인한다.
6. 디버그 APK와 미서명 릴리스 AAB가 컴파일되는지 확인한다.
7. Android Studio에서 저장소 밖의 업로드 키로 서명된 AAB를 생성한다.
8. Play Console 내부 테스트 트랙에 AAB를 올리고 Play App Signing을 활성화한다.
9. Play의 앱 서명 키 SHA-256과 `assetlinks.json`의 지문이 일치하는지 확인하고, 다르면 교체한다.
10. PR 검사 통과 후 머지하고 운영 도메인의 Digital Asset Links 응답을 확인한다.
11. 내부 테스트 트랙에서 설치하고 주소 표시줄 없이 TWA로 열리는지 검증한다.
12. 대상 계정이라면 12명이 14일 연속 참여하는 비공개 테스트를 완료한다.

현재 Play Console 개인 개발자 계정은 2023년 11월 13일 이후 생성되었으므로 프로덕션 액세스 신청 전에
비공개 테스트가 필요합니다. 최소 12명의 테스터가 14일 동안 중단 없이 참여 상태를 유지해야 하며,
내부 테스트 참여 기간은 이 요건에 포함되지 않습니다. 요건을 채운 뒤 Play Console 대시보드에서
프로덕션 액세스를 신청합니다.

이 단계의 역할은 다음과 같이 나눕니다.

- 운영자: Android Studio에서 저장소 밖의 업로드 키를 생성·보관하고 서명된 AAB를 업로드한 뒤,
  Play Console의 **앱 서명 키 인증서 SHA-256**만 개발 작업에 전달합니다. 이후 비공개 테스트 트랙과
  테스터 12명 이상의 14일 연속 참여를 관리합니다.
- 저장소 작업: 전달받은 SHA-256으로 `assetlinks.json`을 교체하고 출시 검사를 통과시킨 뒤,
  같은 Draft PR에 커밋을 추가하고 배포 후 운영 도메인의 Digital Asset Links를 검증합니다.

운영 업로드 키와 서명된 AAB는 Android Studio에서 생성합니다.

`Build > Generate Signed Bundle / APK > Android App Bundle`

운영 키 비밀번호가 오류 로그에 노출될 가능성을 피하기 위해 Bubblewrap CLI에는 운영 keystore
비밀번호를 입력하지 않습니다. 키 저장소는 저장소 밖에 만들고 비밀번호는 Android Studio의
서명 화면에서만 입력합니다.

## 서명 키 원칙

- `.jks`와 `.keystore` 파일은 저장소에 커밋하지 않는다.
- 키 비밀번호를 코드, 문서, 터미널 로그 또는 CI 로그에 남기지 않는다.
- 업로드 키는 암호화된 별도 저장소에 백업한다.
- Play App Signing의 앱 서명 키와 로컬 업로드 키를 구분한다.
