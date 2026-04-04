# 공공데이터 버스 API 가이드

## 개요

이 문서는 삼육대학교 셔틀버스 및 대중교통 정보 서비스에서 사용하는 공공데이터 API를 정리합니다.

- **서울 버스**: 서울특별시 정류소 정보 조회, 버스 도착 정보 조회, 버스 위치 정보 조회
- **경기도 버스**: 경기도 정류소 정보, 버스 도착 정보, 버스 위치 정보

---

## 설정

### 환경변수 필수

`.env.local`에 다음을 추가하세요:

```env
# 공공데이터포털 서비스 키 (날씨, 버스 API 공통)
NEXT_PUBLIC_PUBLIC_DATA_SERVICE_KEY=your_public_data_service_key
```

**주의**: 서울과 경기도 모두 같은 공공데이터포털 서비스 키를 사용합니다.

### 정류장 고정 정의

다음 4개 정류장만 사용합니다:

| 위치 | 방향 | 정류소명   | 서울 ID | 경기도 ID |
| ---- | ---- | ---------- | ------- | --------- |
| 정문 | 상행 | 삼육대앞   | 11154   | 110000054 |
| 정문 | 하행 | 삼육대앞   | 11155   | 110000055 |
| 후문 | 상행 | 삼육대후문 | 42100   | 222001596 |
| 후문 | 하행 | 삼육대후문 | 42101   | 222001597 |

---

## 서울특별시 API

**기본 URL**: `https://ws.bus.go.kr/api/rest/`

### 1. 정류소 도착 정보 조회

**엔드포인트**: `/arrive/getArrInfoByStId`

**파라미터**:

- `serviceKey`: 인증키 (필수)
- `stId`: 정류소 고유번호 (필수)

**응답 (XML)**:

```xml
<ArrivedList>
  <itemList>
    <busRouteId>100100118</busRouteId>  <!-- 노선 ID -->
    <rtNm>100</rtNm>                      <!-- 노선명 (번호) -->
    <arrmsg1>2분</arrmsg1>                <!-- 첫번째 도착 메시지 -->
    <arrmsg2>20분</arrmsg2>               <!-- 두번째 도착 메시지 -->
    <vehId1>3140</vehId1>                 <!-- 첫번째 차량 ID -->
    <vehId2>3145</vehId2>                 <!-- 두번째 차량 ID -->
    <stationNm>정류소명</stationNm>
    <isLow1>Y</isLow1>                    <!-- 저상버스 여부 -->
    <isLow2>N</isLow2>
  </itemList>
</ArrivedList>
```

**응답 필드**:

- `rtNm`: 버스 노선 번호
- `arrmsg1`, `arrmsg2`: 도착 예상 시간 (한글 메시지, 예: "2분", "10분 후" 등)
- `isLow1`, `isLow2`: 저상버스 여부 (Y/N)
- `vehId1`, `vehId2`: 차량 ID (위치 조회에 사용 가능)

### 2. 버스 위치 정보 조회

**엔드포인트**: `/buspos/getBusPosByRtid`

**파라미터**:

- `serviceKey`: 인증키 (필수)
- `busRouteId`: 노선 ID (필수)

**응답 (XML)**:

```xml
<BusPosList>
  <itemList>
    <busid>3140</busid>                   <!-- 버스 ID (차량 ID) -->
    <busnm>100</busnm>                    <!-- 노선명 -->
    <routeid>100100118</routeid>          <!-- 노선 ID -->
    <gpsX>127.0284667</gpsX>              <!-- 경도 (WGS84) -->
    <gpsY>37.49545</gpsY>                 <!-- 위도 (WGS84) -->
    <sectionOrd>5</sectionOrd>            <!-- 구간 순번 -->
    <nextStn>태릉국제스케이트장</nextStn>  <!-- 다음 정류소명 -->
  </itemList>
</BusPosList>
```

**응답 필드**:

- `busid`: 차량 고유 ID
- `gpsX`, `gpsY`: 위도/경도 좌표 (Kakao Map에 표시 가능)
- `nextStn`: 다음 정류소명

---

## 경기도 버스 API

**기본 URL**: `https://apis.data.go.kr/6410000/`

### 1. 정류소 도착 정보 조회

**엔드포인트**: `/busarrivalservice/v2/getBusArrivalListv2`

**파라미터**:

- `serviceKey`: 인증키 (필수, URL Encode)
- `stationId`: 정류소 ID (필수)
- `format`: `json` 또는 `xml`

**응답 (JSON)**:

```json
{
  "response": {
    "body": {
      "items": [
        {
          "routeId": "200000037", // 노선 ID
          "routeName": "100번", // 노선명
          "predictTime1": 180, // 첫번째 도착까지 초 (초 단위)
          "predictTime2": 900, // 두번째 도착까지 초
          "lowFloor1": "Y", // 저상버스 여부
          "lowFloor2": "N",
          "remainSeat1": 5, // 첫번째 버스 빈자리
          "remainSeat2": 12,
          "predictMsg1": "3분", // 한글 메시지
          "predictMsg2": "15분"
        }
      ]
    }
  }
}
```

**응답 필드**:

- `predictTime1`, `predictTime2`: 도착까지 초 단위 시간
- `predictMsg1`, `predictMsg2`: 한글 메시지 (예: "3분", "15분")
- `remainSeat1`, `remainSeat2`: 빈자리 수
- `lowFloor1`, `lowFloor2`: 저상버스 여부

### 2. 버스 위치 정보 조회

**엔드포인트**: `/buslocationservice/v2/getBusLocationListv2`

**파라미터**:

- `serviceKey`: 인증키 (필수, URL Encode)
- `routeId`: 노선 ID (필수)
- `format`: `json` 또는 `xml`

**응답 (JSON)**:

```json
{
  "response": {
    "body": {
      "items": [
        {
          "vehId": "200000001", // 차량 ID
          "busNo": "100-1234", // 버스 번호판
          "routeId": "200000037", // 노선 ID
          "lon": 127.0284667, // 경도 (WGS84)
          "lat": 37.49545, // 위도 (WGS84)
          "nextStationName": "담티고개", // 다음 정류소명
          "nextStationId": "200000150" // 다음 정류소 ID
        }
      ]
    }
  }
}
```

**응답 필드**:

- `vehId`: 차량 고유 ID
- `lon`, `lat`: 경도/위도 좌표
- `nextStationName`: 다음 정류소명

---

## 활용 흐름

### 프론트엔드 (클라이언트)

```typescript
// useQuery로 10초 간격 자동 갱신
useQuery({
  queryKey: ["public-transit-arrivals"],
  queryFn: () => fetch("/api/bus/public-transit").then((r) => r.json()),
  staleTime: 10000, // 10초 후 stale 표시
  gcTime: 30000, // 30초 후 메모리 해제
  refetchInterval: 10000, // 10초마다 재요청
});
```

### 백엔드 API 라우트 (`/api/bus/public-transit`)

```
1. 4개 정류장의 도착 정보 병렬 조회
   ├─ 서울 정문상행 (11154)
   ├─ 서울 정문하행 (11155)
   ├─ 경기도 후문상행 (42100, 49339)
   └─ 경기도 후문하행 (42101, 49340)

2. 각 정류장별 도착 정보 응답
   ├─ 노선명 (버스 번호)
   ├─ 도착 메시지 (예: "3분", "15분")
   ├─ 저상버스 여부
   └─ 빈자리 정보 (경기도만)

3. 각 노선의 버스 위치 조회 (선택사항)
   └─ 지도에 표시할 GPS 좌표
```

---

## 오류 처리

### API 실패 시나리오

1. **단일 정류장 API 타임아웃**
   - 그 정류장만 오류 상태 표시
   - 다른 정류장은 정상 표시

2. **모든 API 실패**
   - 재시도 버튼 및 오류 메시지 표시
   - 학교 연락처 안내

3. **빈 응답**
   - "운행 중인 버스 없음" 메시지
   - 첫차/막차 시간 안내 (필요시)

### HTTP 상태 코드

| 코드 | 의미        | 처리               |
| ---- | ----------- | ------------------ |
| 200  | 성공        | 데이터 표시        |
| 400  | 잘못된 요청 | 파라미터 검증 실패 |
| 401  | 인증 실패   | 서비스 키 확인     |
| 429  | 레이트 제한 | 재시도 간격 증가   |
| 500  | 서버 에러   | 재시도             |

---

## 캐싱 전략

| 데이터      | staleTime | gcTime | refetchInterval |
| ----------- | --------- | ------ | --------------- |
| 도착 정보   | 10초      | 30초   | 10초 (자동)     |
| 차량 위치   | 5초       | 15초   | 5초 (자동)      |
| 정류소 정보 | 1시간     | 3시간  | 없음            |

---

## 제약사항

- 서울 API: XML 응답만 지원 (JSON 비지원)
- 경기도 API: JSON/XML 모두 지원
- 도착 정보 조회: 매 요청마다 1회 API 호출
- 차량 위치 조회: 노선당 1회 API 호출 (필수 아님)

---

## 참고

- 공공데이터포털: https://www.data.go.kr
- 서울시 버스 정보: https://bus.go.kr
- 경기도 버스 정보: https://www.gbis.go.kr
