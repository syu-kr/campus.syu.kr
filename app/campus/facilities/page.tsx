import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";

export default function FacilitiesPage() {
  const facilities = [
    {
      name: "ATM",
      locations: ["학생회관 1F", "중앙도서관 1F"],
      icon: "🏧",
    },
    {
      name: "편의점",
      locations: ["학생회관 B1", "기숙사 로비"],
      icon: "🛒",
    },
    {
      name: "카페",
      locations: ["학생회관 2F", "중앙도서관 2F"],
      icon: "☕",
    },
    {
      name: "세탁소",
      locations: ["기숙사 지하"],
      icon: "👕",
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
              <span className="text-3xl">{facility.icon}</span>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-8 bg-blue-50 border border-blue-200">
        <p className="text-sm text-blue-900">
          🗺️ <strong>개발 예정:</strong> 인터랙티브 캠퍼스 맵 서비스
        </p>
      </Card>
    </Container>
  );
}
