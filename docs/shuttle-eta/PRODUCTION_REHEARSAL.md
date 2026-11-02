# 셔틀 승객 화면의 운영 전환 리허설

기본 `/campus/bus-info`는 기존 셔틀과 대중교통 화면을 유지한다. 새 승객용 셔틀 화면은 아래 리허설 경로에서 확인한다.

- `/campus/bus-info/preview?view=production`은 실제 날짜의 데이터 로더와 운영용 API를 사용한다.
- `view=production&scenario=operating`을 함께 전달해도 과거 운행 예시를 켜지 않는다.
- 운영 표면에서는 예시 링크·조작·관리자 현장 기록 도구를 표시하지 않는다.
- 프리뷰의 로봇 차단 메타데이터는 리허설 경로에도 적용한다.

## 공용 데이터 경로

화면과 위치 수집·ETA는 `lib/server/shuttle-service-data.ts`의 같은 로더를 사용한다. 스냅샷 버전에 따른 금요일 별내 08:30, 기말 추가 출발, 동계 기간 보정도 같은 경로에서 적용된다. 기존 프리뷰 로더 경로는 호환 re-export로 유지한다. Firebase의 활성 공개 스냅샷을 읽지 못해 보관 자료로 내려간 경우 시간표는 참고용으로 표시하고, 실제 위치 수집과 저장소 기반 ETA는 차단한다.

`/api/bus/shuttle/locations`와 `/api/bus/shuttle/eta`는 승객용 GET만 제공한다. 기존 프리뷰 GET과 같은 서버 응답 처리 함수를 호출하므로 검증·수집·예측 로직이 두 벌로 갈라지지 않는다. 운영 클라이언트는 이 경로를 사용하고 프리뷰 URL이나 관리자 인증에 의존하지 않는다.

실제 위치의 수집 조건과 신선도는 서버에서 적용한다. 운영 위치 GET은 새로 수신한 시각을 그대로 유지하며 최대 5초 CDN 캐시를 공유한다. 유효 운행 창의 다음 분 경계와 수신 90초 만료까지 남은 시간으로 캐시 길이를 줄이고, 운휴·오류·지연 응답은 공유 캐시에 두지 않는다. stale-while-revalidate는 사용하지 않는다. 차량 선택 ETA는 선택한 차량만 반환하고 사적 캐시를 사용한다. 위치나 ETA 조회 실패 시 내부 오류 내용은 응답에 포함하지 않는다.

합성 ETA 점검 `?check=1`은 프리뷰 ETA에서만 제공한다. 운영 ETA는 이 매개변수를 400으로 거부하고 관측 저장소에 접근하지 않는다. 관리자 현장 사건 POST는 기존 프리뷰 위치 경로의 인증 검사 뒤에서 처리하며 승객용 위치 경로에는 POST를 제공하지 않는다.

## 향후 진입점 교체

운영 전환 시 `app/campus/bus-info/page.tsx`에서 기존 초기 데이터 대신 같은 서버 데이터 로더와 승객용 표면을 연결한다.

```tsx
import BusInfoPageClient from "./BusInfoPageClient";
import ShuttleServicePreview from "./preview/ShuttleServicePreview";
import { loadShuttleServiceData } from "./preview/service-data.server";
import "./preview/preview.css";

export default async function BusInfoPage() {
  const data = await loadShuttleServiceData();
  return (
    <BusInfoPageClient
      shuttleContent={<ShuttleServicePreview data={data} surface="production" />}
    />
  );
}
```

승객용 컴포넌트의 `data-shuttle-surface` 표식으로 새 셔틀 스타일을 적용하므로 실제 운영 경로에서도 동일한 폭·탭·반응형 스타일을 재사용한다. 대중교통 탭은 원래 컴포넌트와 공용 스타일을 사용한다. 현재 기본 진입점에는 이 교체를 적용하지 않는다. 되돌릴 때는 기본 진입점을 기존 `initialData` 연결로 복구한다.

## 검증

- 공개 위치·ETA 경로의 성공·실패·차량 선택·부적합 선택자 검사
- 운영 합성 점검 차단과 프리뷰 합성 점검의 저장소 접근 0회
- 운영 리허설에서 실제 데이터 선택, 예시 매개변수 혼합 차단
- 동일 운행 자료에 대해 프리뷰와 운영용 API의 응답 정책·만료·수집 조건 일치
- 한국어·영어와 모바일·데스크톱에서 승객용 표면의 탭·지도·정류장 안내 비교

커밋·PR·외부 배포와 실기기·운영 운행일 검증은 사용자 지시에 맞춰 별도로 진행한다.
