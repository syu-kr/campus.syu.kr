# 버스 실시간 위치 API 문서

## 엔드포인트

```
POST http://nexmotion.co.kr/bus/busStatusList.php
```

## 응답 형식

```json
{
  "returnCode": "200",
  "data": [
    {
      "id": "15231a7ce4ba789d13b722cc5c955834",
      "name": "1701",
      "lat": "37.636666550379196",
      "lon": "127.10678919395919",
      "status": "1",
      "routeid": 2
    }
  ]
}
```

## 필드 설명

| 필드    | 타입                 | 설명                         | 필수 |
| ------- | -------------------- | ---------------------------- | ---- |
| id      | string               | 버스 고유 ID (무시 가능)     | -    |
| name    | string               | 버스 번호 (UI에 표시 불필요) | -    |
| lat     | string               | 위도 (실수형 문자열)         | ✓    |
| lon     | string               | 경도 (실수형 문자열)         | ✓    |
| status  | string (또는 number) | 버스 운행 상태               | ✓    |
| routeid | number (또는 string) | 노선 ID                      | ✓    |

## Status 코드

| 값  | 설명                                  | 사용자 표시            |
| --- | ------------------------------------- | ---------------------- |
| 0   | 운행하지 않는 중                      | 필터링 후 숨김         |
| 1   | 학교에서 출발 (학교 → 역 이동 중)     | 파란색 마커            |
| 2   | 역에서 출발 (역 → 학교로 돌아가는 중) | 회색 마커 (탈 수 없음) |

## Route ID 매핑

| ID  | 노선명   | 마커 색상        |
| --- | -------- | ---------------- |
| 1   | 화랑대역 | 파란색 (#3b82f6) |
| 2   | 석계역   | 초록색 (#10b981) |
| 3   | 별내역   | 주황색 (#f59e0b) |

### Status 2인 경우 색상 오버라이드

- Status 2일 때는 routeid와 무관하게 회색(#d0d0d0)으로 표시

## 데이터 처리

### 필터링 규칙

1. **Status 필터링**: `status !== 0` 인 버스만 사용
2. **Type 변환**: `routeid`와 `status` 는 숫자로 변환

### 마커 생성 로직

```typescript
// Status별 색상 결정
const color = bus.status === 2 ? "#d0d0d0" : routeColors[bus.routeid];

// SVG 마커 이미지 생성
// - 파일: app/campus/shuttle/page.tsx
// - MapComponent 내부
```

### 버스 위치 업데이트

- 폴링 간격: 5-10초 (랜덤)
- 응답 실패 시: 빈 배열 반환
- 에러 로깅: `console.error("Failed to fetch bus locations:", error)`

## 주의사항

- ⚠️ `lat`, `lon` 은 문자열로 수신되므로 `Number()` 로 변환 필요
- ⚠️ `status` 와 `routeid` 도 명시적으로 타입 변환 필요
- ⚠️ ID와 name은 내부 처리용이며 UI 표시에 사용하지 않음

## 관련 파일

- `lib/api.ts` - `fetchBusLocations()` 함수
- `app/campus/shuttle/page.tsx` - MapComponent
- `app/api/bus/locations/route.ts` - API 프록시 라우트
- `types/index.ts` - BusLocation 타입 정의
