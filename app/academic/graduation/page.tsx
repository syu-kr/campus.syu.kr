import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";

export default function GraduationPage() {
  const requirements = [
    {
      title: "총 이수학점",
      required: 130,
      completed: 115,
      percentage: 88,
    },
    {
      title: "전공학점",
      required: 54,
      completed: 54,
      percentage: 100,
    },
    {
      title: "교양학점",
      required: 36,
      completed: 34,
      percentage: 94,
    },
  ];

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          졸업요건
        </h1>
        <p className="text-neutral-600">졸업 요건 체크리스트</p>
      </div>

      <div className="space-y-4">
        {requirements.map((req) => (
          <Card key={req.title}>
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-neutral-900">{req.title}</h3>
                <span className="text-sm font-bold text-primary-600">
                  {req.completed}/{req.required}
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all"
                  style={{ width: `${req.percentage}%` }}
                ></div>
              </div>
            </div>
            <p className="text-xs text-neutral-600">{req.percentage}% 달성</p>
          </Card>
        ))}
      </div>

      <Card className="mt-8 bg-green-50 border border-green-200">
        <p className="text-sm text-green-900 mb-2">
          ✅ <strong>경축:</strong> 졸업 요건을 거의 충족하셨습니다!
        </p>
        <p className="text-xs text-green-800">2025년 2월 졸업 예정입니다.</p>
      </Card>
    </Container>
  );
}
