# 일일 크롤링 데이터 GitHub Pages 운영

## 목적

일일 공지·행사·학과 공지·학식·AI 메타데이터를 애플리케이션 소스와 분리해 GitHub Pages 아티팩트로 게시합니다. 공개 저장소에 포함된 GitHub Pages와 표준 `ubuntu-latest` Actions runner만 사용하므로 Google Cloud/Firebase Storage 결제 계정, bucket, service account나 GitHub larger runner가 필요하지 않습니다.

일일 갱신은 `main` 커밋, 애플리케이션 CI, 개인 배포 저장소 동기화, Vercel 배포를 발생시키지 않습니다.

## 데이터 구조

```text
GitHub Pages artifact
├── .nojekyll
├── index.html
└── crawl-data/
    ├── current.json
    └── versions/
        ├── <current-version>/
        │   ├── manifest.json
        │   └── 7개 JSON
        └── <previous-version>/
            ├── manifest.json
            └── 7개 JSON
```

`current.json`은 `version`, `publishedAt`, 7개 파일의 상대 경로·크기·SHA-256, `retainedVersions`를 포함합니다. 현재 버전과 직전 버전을 합쳐 최대 7개를 한 아티팩트에 보존합니다. 버전 경로는 immutable이고 Pages 배포 전환은 아티팩트 단위이므로 부분 게시가 노출되지 않습니다.

운영 base URL:

```text
https://syu-kr.github.io/campus.syu.kr/crawl-data
```

## 최초 활성화

1. GitHub 저장소 `Settings -> Pages`로 이동합니다.
2. `Build and deployment`의 Source를 `GitHub Actions`로 선택합니다.
3. `Actions -> Daily Crawl ... -> Run workflow`로 최초 실행합니다.
4. deploy job이 성공한 뒤 아래 응답을 확인합니다.

```bash
curl -i https://syu-kr.github.io/campus.syu.kr/crawl-data/current.json
curl -i https://campus.syu.kr/api/crawl-data/cafeteria-menu.json
```

앱 API 응답의 정상 원격 source는 다음과 같습니다.

```text
X-Crawl-Data-Source: github-pages
X-Crawl-Data-Version: <current-version>
```

Pages 활성화와 배포에는 별도 Secret/Variable이 필요하지 않습니다. 워크플로가 제공하는 `GITHUB_TOKEN`의 job별 최소 권한만 사용합니다.
배포용 Actions 아티팩트 보존 기간은 1일이며, 롤백에 필요한 최근 7개 데이터 버전은 현재 Pages deployment 안에 포함합니다.

## 일일 게시 순서

1. Pages에 `current.json`이 있으면 그 버전의 7개 파일을 `public/data/`로 복원합니다.
2. 크롤러와 AI 메타데이터 생성기를 실행합니다.
3. 결과 JSON을 파싱하고 크기·SHA-256 manifest를 만듭니다.
4. 내용이 현재 버전과 같으면 Pages 배포를 건너뜁니다.
5. 내용이 바뀌면 새 버전과 이전 최대 6개 버전을 포함한 아티팩트를 준비합니다.
6. `actions/deploy-pages`가 완성된 아티팩트를 한 번에 배포합니다.

준비나 배포가 실패하면 이전 Pages deployment가 그대로 유지됩니다. 런타임은 Pages 조회, JSON 파싱, 크기 또는 SHA-256 검증이 실패할 때 배포에 포함된 `public/data/*.json`을 사용합니다.

## 롤백

1. 운영 `current.json`의 `retainedVersions`에서 목표 버전을 고릅니다.
2. `Actions -> Rollback Crawl Data -> Run workflow`를 엽니다.
3. `version`에 목표 버전을 입력해 실행합니다.
4. 배포 후 `current.json`과 앱 API의 `X-Crawl-Data-Version`을 확인합니다.

로컬에서 같은 아티팩트를 검사하려면 존재하지 않는 출력 경로를 지정합니다.

```bash
npm run rollback:crawl-data -- <version> <output-directory>
```

보존된 7개보다 오래된 버전은 Pages에 남지 않으므로 롤백할 수 없습니다. 장기 보존이 필요하면 비용과 운영 책임을 별도로 승인받기 전에는 확대하지 않습니다.

## 장애 확인

- `Restore current crawl data snapshot` 실패: Pages 응답 상태와 manifest/파일 무결성을 확인합니다.
- `Prepare versioned Pages artifact` 실패: 생성된 7개 JSON의 파싱 오류 또는 이전 스냅샷 경고를 확인합니다.
- `Deploy crawl data to GitHub Pages` 실패: Pages Source가 `GitHub Actions`인지, environment protection이 배포를 막는지 확인합니다.
- 앱 API가 `bundled-fallback`: Pages `current.json`, 해당 버전 파일, 응답 헤더와 서버 로그를 확인합니다.

일일 데이터 장애 때문에 애플리케이션 배포를 재실행하지 않습니다. 데이터 워크플로만 재실행하거나 보존 버전으로 롤백합니다.
