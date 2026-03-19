import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";

export default function LibraryPage() {
  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          도서관
        </h1>
        <p className="text-neutral-600">중앙도서관 정보</p>
      </div>

      <Card className="mb-6">
        <h2 className="text-lg font-bold text-neutral-900 mb-4">운영시간</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">평일</span>
            <strong className="text-neutral-900">08:00 - 22:00</strong>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">토요일</span>
            <strong className="text-neutral-900">10:00 - 18:00</strong>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">일요일</span>
            <strong className="text-neutral-900">휴무</strong>
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="text-lg font-bold text-neutral-900 mb-4">열람실 정보</h2>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-2">
              <strong className="text-neutral-900">메인 열람실</strong>
              <span className="text-sm font-semibold text-primary-600">
                120/150
              </span>
            </div>
            <div className="w-full bg-neutral-200 rounded h-2">
              <div
                className="bg-primary-600 h-2 rounded"
                style={{ width: "80%" }}
              ></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <strong className="text-neutral-900">조용한 열람실</strong>
              <span className="text-sm font-semibold text-primary-600">
                85/100
              </span>
            </div>
            <div className="w-full bg-neutral-200 rounded h-2">
              <div
                className="bg-primary-600 h-2 rounded"
                style={{ width: "85%" }}
              ></div>
            </div>
          </div>
        </div>
      </Card>

      <button className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors">
        좌석 예약하기
      </button>

      <Card className="mt-8 bg-blue-50 border border-blue-200">
        <p className="text-sm text-blue-900">
          📚 <strong>연락처:</strong> 02-3708-1000
        </p>
      </Card>
    </Container>
  );
}
