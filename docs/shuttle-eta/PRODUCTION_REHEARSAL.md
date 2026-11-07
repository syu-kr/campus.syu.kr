# 셔틀 승객 화면의 운영 전환 준비

다음 배포를 위한 기본 `/campus/bus-info` 진입점은 새 승객용 셔틀 화면을 사용하도록 준비했다. 실제 날짜의 공용 로더와 공개 API를 사용하며 기존 대중교통 탭·공유 URL·다국어 경로는 유지한다. 로컬 코드 변경과 실제 프로덕션 배포 완료는 구분한다. 프리뷰와 운영 리허설 경로도 계속 제공한다.

- `/campus/bus-info/preview?view=production`은 실제 날짜의 데이터 로더와 운영용 API를 사용한다.
- `view=production&scenario=operating`을 함께 전달해도 과거 운행 예시를 켜지 않는다.
- 운영 표면에서는 예시 링크·조작·관리자 현장 기록 도구를 표시하지 않는다.
- 프리뷰의 로봇 차단 메타데이터는 리허설 경로에도 적용한다.

## 공용 데이터 경로

화면과 위치 수집·ETA는 `lib/server/shuttle-service-data.ts`의 같은 로더를 사용한다. 스냅샷 버전에 따른 금요일 별내 08:30, 기말 추가 출발, 동계 기간 보정도 같은 경로에서 적용된다. 기존 프리뷰 로더 경로는 호환 re-export로 유지한다. Firebase의 활성 공개 스냅샷을 읽지 못해 보관 자료로 내려간 경우 시간표는 참고용으로 표시하고, 실제 위치 수집과 저장소 기반 ETA는 차단한다.

`/api/bus/shuttle/locations`와 `/api/bus/shuttle/eta`는 승객용 GET만 제공한다. 기존 프리뷰 GET과 같은 서버 응답 처리 함수를 호출하므로 검증·수집·예측 로직이 두 벌로 갈라지지 않는다. 운영 클라이언트는 이 경로를 사용하고 프리뷰 URL이나 관리자 인증에 의존하지 않는다.

실제 위치의 수집 조건과 신선도는 서버에서 적용한다. 운영 위치 GET은 새로 수신한 시각을 그대로 유지하며 최대 5초 CDN 캐시를 공유한다. 유효 운행 창의 다음 분 경계와 수신 90초 만료까지 남은 시간으로 캐시 길이를 줄이고, 운휴·오류·지연 응답은 공유 캐시에 두지 않는다. stale-while-revalidate는 사용하지 않는다. 차량 선택 ETA는 선택한 차량만 반환하고 사적 캐시를 사용한다. 위치나 ETA 조회 실패 시 내부 오류 내용은 응답에 포함하지 않는다.

합성 ETA 점검 `?check=1`은 프리뷰 ETA에서만 제공한다. 운영 ETA는 이 매개변수를 400으로 거부하고 관측 저장소에 접근하지 않는다. 관리자 현장 사건 POST는 기존 프리뷰 위치 경로의 인증 검사 뒤에서 처리하며 승객용 위치 경로에는 POST를 제공하지 않는다.

## 로컬 실제 자료 확인

예시 화면 확인과 실제 저장 자료 연결 확인을 구분한다. 실제 자료를 읽으려면 실행 서버에 `PUBLIC_DATA_BACKEND=firebase`, 기존 서버용 `FIREBASE_SERVICE_ACCOUNT`, 대상 `PUBLIC_DATA_STORAGE_BUCKET` 또는 `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`이 필요하다. 새 작업트리에 설정이 없으면 보관 시간표로 대체되어 저장소 기반 ETA를 제공하지 않는다. 보관 공휴일의 시각을 바꾸거나 자료 신뢰 검사를 해제해 실제 화면처럼 만들지 않는다.

로컬 읽기 검증은 `VERCEL_ENV=development`로 실행한다. 운영 자격증명은 프로세스 환경 또는 Git에서 제외된 로컬 설정으로만 전달하며 코드·PR·로그에 넣지 않는다. 일반 ETA 확인에는 실제 위치 수집 설정이 필요 없다. 예시·모의 응답만 확인한 경우 실제 연결까지 검증했다고 기록하지 않는다.

현재 날짜의 ETA 응답에서 운행일·시간표 버전과 `scheduledArrivals`를 확인한 뒤, 같은 버전의 화면에 숫자 예측이 표시되는지 확인한다. 종료 후 숫자가 없는 경우 자료 부재와 막차 표시 정책에 따른 종료를 구별한다. 위치 없는 예정 예측의 표시 성공은 현장 도착 오차 검증과 별개다.

## 기본 진입점

`app/campus/bus-info/page.tsx`는 기존 초기 데이터 대신 같은 서버 데이터 로더와 `surface="production"`을 연결한다.

```tsx
import BusInfoPageClient from "./BusInfoPageClient";
import ShuttleServicePreview from "./preview/ShuttleServicePreview";
import { loadShuttleServiceData } from "@/lib/server/shuttle-service-data";
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

승객용 컴포넌트의 `data-shuttle-surface` 표식으로 새 셔틀 스타일을 적용하므로 기본 경로에서도 동일한 폭·탭·반응형 스타일을 재사용한다. 대중교통 탭은 원래 컴포넌트와 공용 스타일을 사용한다. 기본 경로에서는 예시 진입 링크·관리자 조작이 없으며 `scenario=operating`을 붙여도 예시로 전환하지 않는다. 되돌릴 때는 기본 진입점을 기존 `initialData` 연결로 복구한다.

도착 예상은 소요시간·도착 시각과 필요한 운행 상태만 표시한다. 위치 반영·시간표 기준·예정편·학습 중 등의 근거 설명과 추가 설명 패널은 표시하지 않는다. 숫자를 제공할 자료가 없으면 `—`로 두고 예상 버스의 `예상` 배지는 유지한다. 기점 출발과 막차 출발·도착, 운휴 표시는 기존 정책을 따른다.

## 검증

- 공개 위치·ETA 경로의 성공·실패·차량 선택·부적합 선택자 검사
- 운영 합성 점검 차단과 프리뷰 합성 점검의 저장소 접근 0회
- 운영 리허설에서 실제 데이터 선택, 예시 매개변수 혼합 차단
- 동일 운행 자료에 대해 프리뷰와 운영용 API의 응답 정책·만료·수집 조건 일치
- 한국어·영어와 모바일·데스크톱에서 승객용 표면의 탭·지도·정류장 안내 비교

커밋·PR·외부 배포와 실기기·운영 운행일 검증은 사용자 지시에 맞춰 별도로 진행한다.
