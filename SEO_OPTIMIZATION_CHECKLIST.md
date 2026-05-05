# SEO 점검 체크리스트

검색 노출과 공유 미리보기를 안정적으로 유지하기 위한 점검 항목입니다.

## 기본 파일

- [x] `public/robots.txt` 유지
- [x] `public/sitemap.xml` 유지
- [x] `app/layout.tsx` 기본 metadata 유지
- [x] JSON-LD Organization schema 유지
- [x] 주요 페이지별 title/description 유지

## 페이지 메타데이터

다음 영역은 새 페이지를 추가할 때 metadata를 함께 확인합니다.

- 홈
- 학사
- 학사 공지
- 학사 일정
- 졸업 요건
- 시간표
- 캠퍼스
- 캠퍼스 공지
- 학식
- 셔틀버스
- 대중교통
- 캠퍼스 지도
- 도서관
- 체육관
- 보건소
- 더보기
- 장학금
- 전화번호
- 캠퍼스 꿀팁
- 서비스 공지

## 접근성 및 콘텐츠

- [x] 로고와 알림 이미지에 의미 있는 `alt` 제공
- [x] 아이콘 버튼에 `aria-label` 또는 title 제공
- [x] 빈 상태와 오류 상태가 화면에 안전하게 표시됨
- [ ] 새 이미지 추가 시 대체 텍스트 확인
- [ ] 새 페이지 추가 시 내부 링크 흐름 확인

## 배포 전 확인

```bash
npm run lint
npm run type-check
npm run build
```

추가 확인:

- `robots.txt`가 배포 도메인에서 열리는지 확인
- `sitemap.xml`에 새 공개 페이지가 반영되었는지 확인
- 공유 미리보기용 Open Graph 값이 깨지지 않는지 확인
- Search Console에 sitemap 제출 상태를 확인

## 운영 모니터링

- Google Search Console 색인 상태
- Core Web Vitals
- 주요 검색어 노출/클릭 수
- 404 또는 리다이렉트 오류
- sitemap lastmod 갱신 상태

## 최종 업데이트

2026-05-05
