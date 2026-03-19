import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";

export default function LeaveApplicationPage() {
  const statuses = [
    {
      type: "현재 상태",
      status: "정상",
      icon: "✅",
      color: "green",
    },
    {
      type: "학적 유효기간",
      status: "2025.02.14",
      icon: "📅",
      color: "blue",
    },
    {
      type: "휴학 가능 횟수",
      status: "1회",
      icon: "🔄",
      color: "orange",
    },
  ];

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          학적신청
        </h1>
        <p className="text-neutral-600">휴학 및 복학 신청</p>
      </div>

      <div className="space-y-4 mb-6">
        {statuses.map((s) => (
          <Card key={s.type}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600 mb-1">{s.type}</p>
                <p className="font-bold text-neutral-900">{s.status}</p>
              </div>
              <span className="text-3xl">{s.icon}</span>
            </div>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        <button className="w-full px-4 py-3 bg-neutral-100 text-neutral-900 rounded-lg font-semibold hover:bg-neutral-200 transition-colors">
          휴학 신청
        </button>
        <button className="w-full px-4 py-3 bg-neutral-100 text-neutral-900 rounded-lg font-semibold hover:bg-neutral-200 transition-colors">
          복학 신청
        </button>
      </div>

      <Card className="mt-8 bg-blue-50 border border-blue-200">
        <p className="text-sm text-blue-900 mb-2">
          ℹ️ <strong>안내:</strong> 학적 변동은 교무처에서 승인 후 적용됩니다.
        </p>
        <p className="text-xs text-blue-800">
          상세 내용은 교무처(02-3708-0000)로 문의하세요.
        </p>
      </Card>
    </Container>
  );
}
