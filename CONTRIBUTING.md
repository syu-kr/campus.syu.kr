# Contributing

기여해 주셔서 감사합니다. 변경 전에 이 문서와 [개발 가이드](DEVELOPMENT.md)를 확인해 주세요. 기능별 유지보수 문서는 [문서 안내](docs/README.md)에서 찾을 수 있습니다.

## Development

```bash
npm ci
cp .env.example .env.local
npm run dev
```

비밀 값은 커밋하지 마세요. 로컬 환경 변수는 `.env.local`, 공유 가능한 변수 이름과 예시는 `.env.example`에 둡니다.

## Pull Requests

1. 기능과 관련된 작은 단위로 변경합니다.
2. 운영 데이터에 dummy 또는 mock 데이터를 넣지 않습니다.
3. 새 환경 변수가 필요하면 `.env.example`과 환경 등록 문서를 함께 수정합니다.
4. `npm run check`로 lint, 타입, 다국어·TWA·미사용 코드, Python 검사, 졸업·교육과정·크롤링 자료, 단위 테스트와 프로덕션 빌드를 확인합니다. CI는 별도로 npm·Python 의존성 감사와 Android TWA lint·빌드·출시 설정 검사도 실행합니다.
5. 사용자 동작이나 배포 방식이 바뀌면 관련 문서를 함께 수정합니다.

캡처·HAR·원본 성능 측정·빌드 로그·실험 파일은 Git에서 제외된 `output/`, `.playwright-mcp/`, `.cache/`에 둡니다. 공개 문서에는 개인정보를 제거한 결과와 재현 조건만 남기고, 개인 PC 절대경로나 비밀값을 포함하지 않습니다. 자세한 원칙은 [문서 안내](docs/README.md#공개-문서-유지-원칙)를 따릅니다.

## SEO And Accessibility

새 공개 페이지를 추가할 때 metadata, 내부 링크, `app/sitemap.ts`, 빈 상태, 오류 상태를 확인합니다. 이미지에는 의미 있는 대체 텍스트를 제공하고 아이콘 버튼에는 `aria-label` 또는 `title`을 지정합니다.

## Repository Rules

`main` 변경은 pull request와 필수 CI 통과를 거치고 force push와 삭제를 금지하는 원칙으로 운영합니다. 월간 크롤러도 PR을 생성하므로 자동화용 Ruleset bypass를 허용하지 않습니다. 실제 브랜치 보호·Ruleset 설정은 GitHub 저장소 설정에서 별도로 확인합니다.
