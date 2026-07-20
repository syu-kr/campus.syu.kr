# 공공데이터 버스 API 가이드

삼육대학교 대중교통 정보 화면에서 사용하는 서울/경기도 버스 도착 정보 API 참고 문서입니다.

## 환경 변수

```env
PUBLIC_DATA_SERVICE_KEY=your_public_data_service_key
SEOUL_BUS_ARRIVAL_URL=your_seoul_bus_arrival_endpoint
GYEONGGI_BUS_ARRIVAL_URL=your_gyeonggi_bus_arrival_endpoint
```

서울과 경기도 버스 API는 공공데이터포털 서비스 키를 사용합니다. 운영 환경에서는 Vercel 환경 변수에도 같은 값을 설정합니다. 브라우저에 노출하지 않기 위해 `NEXT_PUBLIC_` 접두사를 쓰지 않습니다.

## 고정 정류장

| 위치 | 방향 | 정류소명 | 서울 ID | 경기도 ID |
| --- | --- | --- | --- | --- |
| 정문 | 상행 | 삼육대앞 | 11154 | 110000054 |
| 정문 | 하행 | 삼육대앞 | 11155 | 110000055 |
| 후문 | 상행 | 삼육대후문 | 42100 | 222001596 |
| 후문 | 하행 | 삼육대후문 | 42101 | 222001597 |

## 서울 버스 API

- 기본 URL: `SEOUL_BUS_ARRIVAL_URL`
- 도착 정보: 환경변수에 완성된 endpoint를 등록
- 응답 형식: XML

주요 필드:

| 필드 | 의미 |
| --- | --- |
| `rtNm` | 노선 번호 |
| `arrmsg1`, `arrmsg2` | 첫번째/두번째 도착 메시지 |
| `vehId1`, `vehId2` | 차량 ID |
| `isLow1`, `isLow2` | 저상버스 여부 |
| `stationNm` | 정류소명 |

## 경기도 버스 API

- 도착 정보: `GYEONGGI_BUS_ARRIVAL_URL`
- 응답 형식: JSON 또는 XML

주요 필드:

| 필드 | 의미 |
| --- | --- |
| `routeName` | 노선 번호 |
| `predictTime1`, `predictTime2` | 도착 예정 시간 |
| `predictMsg1`, `predictMsg2` | 도착 메시지 |
| `lowFloor1`, `lowFloor2` | 저상버스 여부 |
| `remainSeat1`, `remainSeat2` | 잔여 좌석 |

## 앱 내부 흐름

```text
PublicTransitSection
  -> /api/bus/public-transit
  -> lib/public-transit.ts
  -> 서울/경기도 도착 정보 API
  -> routeId + 논리 정류장 기준 행선지 결합
  -> 정류장 방향별로 정규화된 응답 반환
```

프론트엔드는 10초 간격으로 `/api/bus/public-transit`를 다시 요청합니다. API Route는 각 정류장 요청을 병렬로 처리하고, 실패한 정류장이 있어도 가능한 결과를 반환합니다.

## 노선별 주요 행선지

도착 정보의 `stationNm1`, `stationNm2`, `nxtStn`은 현재 버스의 다음 정류소이며 노선 행선지가 아닙니다. 화면에 표시하는 행선지는 `lib/public-transit-destinations.ts`에서 `routeId + 논리 정류장 ID` 기준으로 관리합니다.

논리 정류장 ID:

- `jungmun-up`: 정문에서 경기 방면
- `jungmun-down`: 정문에서 서울 방면
- `humun-up`: 후문에서 경기 방면
- `humun-down`: 후문에서 서울 방면

현재 고정 매핑:

| 노선 | 경기 방면 | 서울/회차 방면 | 적용 정류장 |
| --- | --- | --- | --- |
| 202 | 불암동 | 후암동 | 정문, 후문 |
| 2212 | 불암동 | 서일대학교 | 정문, 후문 |
| 2155 | 불암동 | 석계역 | 정문 |
| 155 | 청학리 | 석계역 | 정문, 후문 |
| 115 | 사능차고지 | 석계역 | 정문 |
| 2-2 | 구리역·롯데백화점 | 삼육대앞 종점 | 정문 |
| 82A | 부대앞 | 태릉입구역 | 정문, 후문 |
| 82B | 별내차고지 | 태릉입구역 | 정문, 후문 |
| 86 | 별내차고지 | 삼육대후문 종점 | 후문 |

검증 기준:

- 경기버스정보 `getBusRouteStationListv2`의 정류장 순서와 `turnYn=Y`
- 경기버스정보 노선 기본정보 및 노선현황
- 서울 노선 기본정보가 경기 API에 없을 때 서울특별시·삼육대학교 공식 안내와 경유 정류장 순서를 교차 확인
- 최종 검증일: 2026-07-20

신규 노선이나 변경된 `routeId`는 추측해서 기존 노선명 매핑을 재사용하지 않습니다. 매핑이 없으면 목록에서는 행선지를 생략하고 상세 화면에는 `행선지 정보 없음`을 표시합니다.

## 오류 처리

- 단일 정류장 실패: 해당 정류장만 빈 상태 또는 오류 상태로 처리
- 전체 실패: 재시도 가능한 오류 상태 반환
- 빈 응답: 운행 중인 버스 없음으로 표시
- 오래된 잔존 데이터: 현재 시각 기준으로 필터링

## 캐싱 정책

실시간 도착 정보는 오래 캐시하지 않습니다.

| 데이터 | staleTime | gcTime | refetchInterval |
| --- | --- | --- | --- |
| 도착 정보 | 0초 | 0초 | 10초 |
| 차량 위치 | 5초 | 15초 | 5초 |

Next.js fetch 옵션에서 `cache: "no-store"`와 `next.revalidate`를 동시에 지정하지 않습니다.

## 참고 링크

- 공공데이터포털: https://www.data.go.kr
- 서울시 버스 정보: https://bus.go.kr
- 경기도 버스 정보: https://www.gbis.go.kr

## 최종 업데이트

2026-07-20
