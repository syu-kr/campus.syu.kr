import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";

export default function HealthCenterPage() {
  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          보건소
        </h1>
        <p className="text-neutral-600">학생 의료 서비스</p>
      </div>

      <Card className="mb-6 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200">
        <h2 className="text-lg font-bold text-red-900 mb-4">응급상황</h2>
        <p className="text-sm text-red-800 mb-3">
          응급상황 발생 시 즉시 119에 신고하세요
        </p>
        <p className="text-xs text-red-700">보건소 긴급번호: 02-3708-2114</p>
      </Card>

      <Card className="mb-6">
        <h2 className="text-lg font-bold text-neutral-900 mb-4">운영시간</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">월-금</span>
            <strong className="text-neutral-900">09:00 - 18:00</strong>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">토요일</span>
            <strong className="text-neutral-900">10:00 - 13:00</strong>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">선릉역 분점</span>
            <strong className="text-neutral-900">24시간 운영</strong>
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="text-lg font-bold text-neutral-900 mb-4">제공 서비스</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">💉</span>
            <span>예방접종</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🩺</span>
            <span>건강검진</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">💊</span>
            <span>의약품 처방</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🧠</span>
            <span>상담 서비스</span>
          </div>
        </div>
      </Card>

      <button className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors">
        진료 예약하기
      </button>

      <Card className="mt-8 bg-blue-50 border border-blue-200">
        <p className="text-sm text-blue-900">
          📞 <strong>연락처:</strong> 02-3708-2000
        </p>
      </Card>
    </Container>
  );
}
