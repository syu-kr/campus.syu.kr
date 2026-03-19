import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import { MockDataAlert } from "@/app/components/MockDataAlert";

export default function GymPage() {
  const facilities = [
    {
      name: "체육관 헬스장",
      hours: "06:00 - 22:00",
      fee: "월 50,000원",
      contact: "02-3708-1234",
    },
    {
      name: "스쿼시장",
      hours: "06:00 - 21:00",
      fee: "예약 필수",
      contact: "02-3708-1235",
    },
    {
      name: "배드민턴장",
      hours: "09:00 - 22:00",
      fee: "시간당 20,000원",
      contact: "02-3708-1236",
    },
    {
      name: "수영장",
      hours: "09:00 - 20:00",
      fee: "월 100,000원",
      contact: "02-3708-1237",
    },
  ];

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          체육시설
        </h1>
        <p className="text-neutral-600">캠퍼스 운동 시설 안내</p>
      </div>

      <MockDataAlert
        title="⚠️ 안내"
        message="실제 예약은 학사시스템 또는 직접 연락을 통해 진행하세요. 위의 시간과 요금은 참고용입니다."
        type="warning"
      />

      <div className="space-y-4">
        {facilities.map((facility) => (
          <Card key={facility.name}>
            <div className="mb-3">
              <h3 className="text-lg font-bold text-neutral-900 mb-3">
                {facility.name}
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-600 w-16">운영시간</span>
                  <strong className="text-neutral-900">{facility.hours}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-neutral-600 w-16">이용료</span>
                  <strong className="text-neutral-900">{facility.fee}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-neutral-600 w-16">연락처</span>
                  <strong className="text-neutral-900">
                    {facility.contact}
                  </strong>
                </div>
              </div>
            </div>
            <button className="w-full px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
              예약하기
            </button>
          </Card>
        ))}
      </div>

      <Card className="mt-8 bg-yellow-50 border border-yellow-200">
        <p className="text-sm text-yellow-900">
          ⚠️ <strong>주의:</strong> 예약은 학사시스템을 통해 진행하세요.
        </p>
      </Card>
    </Container>
  );
}
