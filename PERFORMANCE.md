# 성능 최적화 가이드

## 📊 번들 크기 분석

### 현재 상태 (Task 6 완료)

- **First Load JS**: 87.4 kB ✅ (우수)
- **페이지 평균 크기**: 90-103 kB (캠퍼스 지도 최대)
- **Shared JS Chunks**: 85.3 kB (2개 청크)
- **빌드 최적화**: ✅ 활성화

### 분석 방법

#### 1️⃣ 번들 분석 보고서 생성

```bash
npm run build:analyze
```

이 명령어는 Next.js 프로젝트의 JavaScript 번들 구성을 시각적으로 보여주는 HTML 보고서를 생성합니다.

- 브라우저에서 자동으로 열립니다
- 각 라이브러리의 크기와 의존성 구조 확인 가능

#### 2️⃣ 정적 분석 결과

```bash
npm run build
```

빌드 로그에서 다음 정보 확인:

- 페이지별 크기 (정적, 동적 페이지 구분)
- 공유 청크 크기
- 최적화된 라이브러리 목록

---

## 🎯 주요 최적화 항목

### ✅ 이미 적용된 최적화

#### 1. 이미지 최적화

- **Next.js Image 컴포넌트 사용**: AVIF, WebP 자동 변환
- **Lazy Loading**: `loading="lazy"` 속성 설정
- **캐싱**: 1년 TTL (변경 없을 때)

#### 2. 번들 코드 분할

- **자동 Code Splitting**: 페이지별 필요한 코드만 로드
- **Shared Chunks**: 공통 라이브러리 분리 (31.7 kB + 53.6 kB)
- **Tree Shaking**: 사용하지 않는 코드 제거

#### 3. 라이브러리 최적화

```javascript
// experimental.optimizePackageImports
optimizePackageImports: ["@tanstack/react-query"];
```

- React Query의 필요한 부분만 번들에 포함

#### 4. 폰트 최적화

- **@fontsource/pretendard**: 서브셋 폰트 사용
- **Font 최적화**: CSS-in-JS 대신 정적 폰트

#### 5. 캐싱 전략

| 대상              | 캐시 정책 | TTL           |
| ----------------- | --------- | ------------- |
| `/data/*.json`    | no-cache  | -             |
| `/images/*`       | immutable | 432000s (5일) |
| `/_next/static/*` | immutable | 432000s (5일) |

---

## 📈 추천 개선사항

### 우선순위 1: 의존성 검토

1. **Firebase 크기 확인**

   ```bash
   npm ls firebase firebase-admin
   ```

   - Firebase는 상당한 크기이므로 필요한 기능만 import 확인
   - 브라우저/서버 환경에 맞는 import 사용

2. **React Query 최적화**
   - 현재: 최적화 설정 적용 ✅
   - 추가 확인: 사용하지 않는 플러그인/기능 제거

### 우선순위 2: 코드 최적화

1. **동적 Import 활용**

   ```typescript
   // 무거운 컴포넌트는 동적 로드
   import dynamic from "next/dynamic";
   const HeavyComponent = dynamic(() => import("./HeavyComponent"), {
     loading: () => <div>로딩 중...</div>,
   });
   ```

2. **useCallback/useMemo 검토**
   - 자주 리렌더링되는 컴포넌트 점검
   - 필요시 최적화 적용

### 우선순위 3: 네트워크 최적화

1. **API 호출 최소화**
   - 중복 요청 제거 (React Query로 이미 최적화 됨)
   - 배치 API 고려

2. **이미지 최적화**
   - 불필요한 이미지 제거
   - SVG로 대체 가능한 것 확인

---

## 🔗 관련 명령어

```bash
# 정상 빌드
npm run build

# 번들 분석 (HTML 시각화)
npm run build:analyze

# 타입 체크
npm run type-check

# Linting
npm run lint
```

---

## 📚 참고 자료

- **Next.js Performance**: https://nextjs.org/learn/seo/web-performance
- **Bundle Analyzer**: https://www.npmjs.com/package/@next/bundle-analyzer
- **React Query Docs**: https://tanstack.com/query/latest
- **Firebase SDK Size**: https://firebase.google.com/docs/web/setup#import-individual-services

---

## 📋 성능 체크리스트

- [x] 번들 분석 도구 설정
- [x] 이미지 컴포넌트 최적화 (Task 4에서 완료)
- [x] 캐싱 정책 구성
- [x] Font 최적화
- [x] Code Splitting 검증
- [ ] Core Web Vitals 모니터링 (배포 후)
- [ ] Lighthouse 감사 (배포 전)
- [ ] Performance 메트릭 수집 (배포 후)

---

**Last Updated**: 2026-04-07  
**Task 6 Status**: ✅ 완료  
**Next**: Task 7 - 최종 배포 준비
