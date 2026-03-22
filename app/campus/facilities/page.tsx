import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import { MockDataAlert } from "@/app/components/MockDataAlert";

export default function FacilitiesPage() {
  const facilities = [
    {
      name: "ATM",
      locations: ["바울관 1층", "학생회관 1층", "백주년기념관 1층"],
    },
    {
      name: "CU편의점",
      locations: ["학생회관 1층"],
    },
    {
      name: "SU Lounge (학생식당)",
      locations: ["학생회관 1층"],
    },
    {
      name: "안경점",
      locations: ["학생회관 2층"],
    },
    {
      name: "복사실",
      locations: ["바울관 지하1층 (문구점 내)"],
    },
    {
      name: "서점",
      locations: ["바울관 지하1층"],
    },
    {
      name: "우리은행 (삼육대점)",
      locations: ["도서관 1층"],
    },
    {
      name: "우체국 (삼육대점)",
      locations: ["제3과학관 지하1층"],
    },
  ];

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          편의시설
        </h1>
        <p className="text-neutral-600">캠퍼스 편의시설 위치</p>
      </div>

      <MockDataAlert
        title="개발 예정"
        message="편의시설 위치 정보는 개발 중입니다. 정확한 위치는 캠퍼스 맵 서비스를 이용해주세요."
        type="info"
      />

      <div className="space-y-4">
        {facilities.map((facility) => (
          <Card key={facility.name}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-neutral-900 mb-2">
                  {facility.name}
                </h3>
                <div className="space-y-1">
                  {facility.locations.map((loc) => (
                    <p key={loc} className="text-sm text-neutral-600">
                      • {loc}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-8 bg-blue-50 border border-blue-200">
        <p className="text-sm text-blue-900">
          <strong>개발 예정:</strong> 인터랙티브 캠퍼스 맵 서비스
        </p>
      </Card>
    </Container>
  );
}
