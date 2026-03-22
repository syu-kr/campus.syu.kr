# 삼육대 캠퍼스 - 개발 가이드

## 프로젝트 개요

이 문서는 개발자를 위한 상세 개발 가이드입니다.

## 개발 환경 설정

### 1단계: 의존성 설치

```bash
npm install
```

### 2단계: 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 아키텍처

### 디렉토리 구조 상세

```
src/
├── app/                         # Next.js App Router
│   ├── (routes)/               # 라우트 그룹 (선택사항)
│   ├── layout.tsx              # Root 레이아웃
│   ├── page.tsx                # 홈 페이지
│   ├── globals.css             # 전역 스타일
│   ├── components/             # 공유 컴포넌트
│   │   ├── Header.tsx          # 상단 헤더
│   │   ├── BottomNav.tsx       # 모바일 하단 네비게이션
│   │   ├── Card.tsx            # 카드 컴포넌트
│   │   ├── Container.tsx       # 컨테이너
│   │   ├── Badge.tsx           # 배지
│   │   ├── AnnouncementCard.tsx  # 공지사항 카드
│   │   ├── SearchBar.tsx       # 검색바
│   │   └── Skeleton.tsx        # 로딩 상태
│   ├── features/               # 기능별 컴포넌트 (추후 확장)
│   └── [route]/                # 동적 라우트
│
├── lib/                        # 유틸리티
│   ├── api.ts                  # API 함수 (Mock & Real)
│   └── utils.ts                # 헬퍼 함수
│
├── data/                       # Mock 데이터
│   ├── announcements.json      # 공지사항
│   ├── cafeteria.json          # 학식 메뉴
│   ├── schedule.json           # 학사일정
│   ├── shuttle-bus.json        # 셔틀버스
│   └── scholarships.json       # 장학금
│
├── types/                      # TypeScript 타입
│   └── index.ts
│
├── public/                     # 정적 파일
│   ├── manifest.json           # PWA 매니페스트
│   ├── sw.js                   # 서비스 워커
│   ├── favicon.ico
│   └── images/                 # 아이콘 및 이미지
│
└── 설정 파일들
    ├── package.json
    ├── next.config.js
    ├── tsconfig.json
    ├── tailwind.config.js
    └── postcss.config.js
```

## 컴포넌트 개발

### 새로운 컴포넌트 만들기

```typescript
// app/components/MyComponent.tsx
'use client'; // Client Component인 경우

import React from 'react';
import clsx from 'clsx';

interface MyComponentProps {
  title: string;
  variant?: 'primary' | 'secondary';
  children?: React.ReactNode;
}

export function MyComponent({
  title,
  variant = 'primary',
  children,
}: MyComponentProps) {
  return (
    <div className={clsx(
      'p-4 rounded-lg',
      variant === 'primary' ? 'bg-primary-600 text-white' : 'bg-neutral-100'
    )}>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export default MyComponent;
```

### 컴포넌트 베스트 프랙티스

1. **TypeScript**: 모든 Props에 타입 정의
2. **aria 속성**: 접근성 고려
3. **클래스 병합**: `clsx` 유틸리티 사용
4. **기본값**: 합리적인 기본값 제공
5. **문서**: JSDoc 주석 추가

## 상태 관리 (TanStack Query)

### API 데이터 조회

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchAnnouncements } from '@/lib/api';

export function AnnouncementsList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['announcements'],
    queryFn: fetchAnnouncements,
    staleTime: 5 * 60 * 1000, // 5분
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState />;

  return (
    <div>
      {data?.map(announcement => (
        <AnnouncementCard key={announcement.id} announcement={announcement} />
      ))}
    </div>
  );
}
```

### 쿼리 키 컨벤션

```typescript
// 단순 쿼리
["announcements"][
  // 필터/카테고리가 있는 경우
  ("announcements", { category: "academic" })
][
  // 페이지네이션
  ("announcements", { page: 1, limit: 10 })
][
  // ID별 조회
  ("announcement", { id: "ann-001" })
];
```

## Mock API 개발

### 새로운 Mock API 추가

1. **데이터 파일 만들기** (`data/mydata.json`)

```json
[
  {
    "id": "1",
    "name": "Item 1",
    "description": "Description"
  }
]
```

2. **타입 정의** (`types/index.ts`)

```typescript
export interface MyData {
  id: string;
  name: string;
  description: string;
}
```

3. **API 함수** (`lib/api.ts`)

```typescript
import myData from "@/data/mydata.json";

export async function fetchMyData() {
  return new Promise<MyData[]>((resolve) => {
    setTimeout(() => {
      resolve(myData as MyData[]);
    }, 500);
  });
}
```

## 스타일링

### Tailwind CSS 사용

```typescript
<div className="p-4 rounded-lg bg-primary-600 text-white">
  <h2 className="text-lg font-bold mb-2">Title</h2>
  <p className="text-sm text-neutral-200">Description</p>
</div>
```

### 커스텀 클래스

Global CSS에 커스텀 클래스를 추가할 수 있습니다:

```css
/* app/globals.css */
.custom-class {
  @apply p-4 rounded-lg shadow-md;
}
```

### 반응형 디자인

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* 모바일: 1열, 태블릿: 2열, 데스크톱: 3열 */}
</div>
```

## 성능 최적화

### 이미지 최적화

```typescript
import Image from 'next/image';

<Image
  src="/image.jpg"
  alt="Description"
  width={400}
  height={300}
  priority={false}
/>
```

### 동적 Import

```typescript
const HeavyComponent = dynamic(() => import('@/components/Heavy'), {
  loading: () => <Skeleton />,
});
```

### 번들 분석

```bash
npm install -D @next/bundle-analyzer
# next.config.js에 설정 추가
```

## 테스팅

### 개발 중 테스트

```bash
npm run dev
```

모든 기능을 브라우저에서 테스트합니다.

### 빌드 테스트

```bash
npm run build
npm start
```

프로덕션 빌드가 정상 작동하는지 확인합니다.

### 타입 체크

```bash
npm run type-check
```

TypeScript 오류를 확인합니다.

## 배포 전 체크리스트

- [ ] 모든 페이지가 정상적으로 로드되는가?
- [ ] 모바일과 데스크톱에서 모두 작동하는가?
- [ ] 이미지가 최적화되어 있는가?
- [ ] 접근성 속성이 있는가?
- [ ] 에러 처리가 적절한가?
- [ ] 로딩 상태를 표시하는가?
- [ ] 타입 에러가 없는가?
- [ ] 모든 Mock API가 필요한 지연을 가지고 있는가?

## 트러블슈팅

### 포트 충돌

```bash
lsof -ti:3000 | xargs kill -9
npm run dev
```

### 캐시 제거

```bash
rm -rf .next node_modules
npm install
npm run dev
```

### 환경 변수 확인

```bash
# .env.local 파일이 있는지 확인
ls -la | grep env
```

## 유용한 리소스

- [Next.js 문서](https://nextjs.org/docs)
- [Tailwind CSS 문서](https://tailwindcss.com/docs)
- [TanStack Query 문서](https://tanstack.com/query/latest)
- [TypeScript 핸드북](https://www.typescriptlang.org/docs/)

## 문의사항

개발 중 문제가 생기면 이슈를 등록해주세요.
