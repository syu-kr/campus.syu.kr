# Contributing

기여해 주셔서 감사합니다. 변경 전에 이 문서와 `DEVELOPMENT.md`를 확인해 주세요.

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
4. `npm run check`를 실행해 lint, 타입, 미사용 코드, Python 크롤러 문법, 프로덕션 빌드를 확인합니다.
5. 사용자 동작이나 배포 방식이 바뀌면 관련 문서를 함께 수정합니다.

## SEO And Accessibility

새 공개 페이지를 추가할 때 metadata, 내부 링크, `app/sitemap.ts`, 빈 상태, 오류 상태를 확인합니다. 이미지에는 의미 있는 대체 텍스트를 제공하고 아이콘 버튼에는 `aria-label` 또는 `title`을 지정합니다.

## Repository Rules

`main`은 pull request와 `Lint, Type Check, Build` 통과를 요구하며 force push와 삭제를 금지합니다. 예약 크롤러가 `public/data/`를 직접 갱신하므로 Ruleset bypass 목록에는 **GitHub Actions 앱**만 허용합니다.
