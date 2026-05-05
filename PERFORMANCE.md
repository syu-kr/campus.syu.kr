# 성능 점검 가이드

Next.js 빌드 결과와 운영 중 확인해야 할 성능 항목을 정리합니다.

## 현재 기준

2026-05-05 `npm run build` 기준:

- Shared First Load JS: 87.4 kB
- 홈 페이지 First Load JS: 119 kB
- 정적/동적 라우트 생성: 36개 페이지 기준 정상 빌드
- 주요 검증 명령: `npm run lint`, `npm run type-check`, `npm run build`

## 확인 방법

```bash
npm run build
npm run build:analyze
```

`npm run build`에서는 페이지별 First Load JS, 정적/동적 라우트, 타입 검사 결과를 확인합니다. `npm run build:analyze`는 번들 구성과 큰 의존성을 확인할 때 사용합니다.

## 적용 중인 최적화

- Next.js App Router의 자동 code splitting
- `next/image` 기반 이미지 최적화
- `@fontsource/pretendard` 사용
- TanStack Query의 기능별 캐시 정책
- 정적 JSON 데이터의 장기 캐시와 버전 확인
- `@tanstack/react-query` package import 최적화
- Service Worker는 Firebase Messaging 중심으로 유지하고 앱 데이터 캐싱은 제한

## 점검 항목

- [x] lint 통과
- [x] type-check 통과
- [x] production build 통과
- [x] First Load JS 추적
- [ ] 배포 환경 Lighthouse 확인
- [ ] Core Web Vitals 모니터링
- [ ] 번들 분석 결과에서 큰 의존성 주기적 확인

## 개선 후보

- Firebase 클라이언트 import가 브라우저 번들에 필요한 범위만 포함되는지 확인
- 지도/버스/알림처럼 무거운 기능은 필요한 화면에서만 초기화
- 반복 렌더링이 많은 목록은 memoization 필요성을 실제 측정 후 적용
- 이미지가 추가될 때 `next/image` 사용과 적절한 크기 지정 확인

## 참고 링크

- Next.js Performance: https://nextjs.org/docs/app/building-your-application/optimizing
- Bundle Analyzer: https://www.npmjs.com/package/@next/bundle-analyzer
- TanStack Query: https://tanstack.com/query/latest
- Firebase Web SDK: https://firebase.google.com/docs/web/setup

## 최종 업데이트

2026-05-05
