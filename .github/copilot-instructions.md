# Project Guidelines

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS의 기존 패턴을 따릅니다.
- route 전용 코드는 `app/`, 공유 UI는 `app/components/`, 공유 로직은 `lib/`, 공유 타입은 `types/`에 둡니다.
- 운영 코드와 `public/data/`에 dummy 또는 mock 데이터를 추가하지 않습니다.
- 외부 API 키와 Firebase 서비스 계정은 서버 환경 변수로만 사용합니다.
- 정적 JSON은 `lib/fetch-json.ts`를 사용하고, 외부 API는 API Route에서 정규화합니다.
- 변경 후 `npm run check`를 실행합니다.
- 자세한 환경 설정과 배포 흐름은 `DEVELOPMENT.md`, 기여 규칙은 `CONTRIBUTING.md`를 참고합니다.
