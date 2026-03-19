import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";

export default function TuitionSchedulePage() {
  const schedule = [
    {
      term: "1학기",
      period: "2024.01.15 - 2024.01.26",
      amount: "3,500,000원",
      status: "납부 기간 종료",
    },
    {
      term: "2학기",
      period: "2024.08.15 - 2024.08.30",
      amount: "3,500,000원",
      status: "예정",
    },
  ];

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          등록금 일정
        </h1>
        <p className="text-neutral-600">학기별 등록금 납부 기간</p>
      </div>

      <div className="space-y-4">
        {schedule.map((item) => (
          <Card key={item.term}>
            <div className="mb-3">
              <h3 className="text-lg font-bold text-neutral-900 mb-1">
                {item.term}
              </h3>
              <p className="text-sm text-neutral-600 mb-3">{item.period}</p>
            </div>
            <div className="flex items-center justify-between">
              <strong className="text-primary-600 text-lg">
                {item.amount}
              </strong>
              <span className="text-xs font-medium text-neutral-500">
                {item.status}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-8 bg-yellow-50 border border-yellow-200">
        <p className="text-sm text-yellow-900 mb-2">
          ⚠️ <strong>중요:</strong> 등록금 미납 시 수강 정정 및 성적 열람이
          불가능합니다.
        </p>
        <p className="text-xs text-yellow-800">
          분할 납부 또는 납부 유예에 대한 문의는 학생지원팀으로 연락하세요.
        </p>
      </Card>
    </Container>
  );
}
