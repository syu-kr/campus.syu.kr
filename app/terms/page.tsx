import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관",
  description: "SYU CAMPUS 이용약관",
};

export default function TermsPage() {
  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-4 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          홈으로
        </Link>
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">이용약관</h1>
        <p className="text-neutral-600">
          SYU CAMPUS 서비스 이용약관입니다. 2025년 4월 1일 시행
        </p>
      </div>

      <div className="space-y-6 mb-8">
        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제1조 목적
          </h2>
          <p className="text-neutral-700 leading-relaxed">
            이 약관은 삼육대학교(이하 "학교")가 제공하는 SYU CAMPUS(이하
            "서비스")의 이용과 관련하여 학교와 이용자의 권리 및 의무를 정하는
            것을 목적으로 합니다.
          </p>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제2조 정의
          </h2>
          <div className="space-y-3 text-neutral-700">
            <div>
              <p className="font-semibold mb-1">1. 서비스</p>
              <p className="text-sm text-neutral-600">
                학교가 제공하는 학사정보, 캠퍼스정보, 공지사항 등을 포함한 모든
                통합 정보 플랫폼을 의미합니다.
              </p>
            </div>
            <div>
              <p className="font-semibold mb-1">2. 이용자</p>
              <p className="text-sm text-neutral-600">
                이 약관에 동의하고 서비스를 이용하는 삼육대학교 재학생, 교직원,
                동문을 포함한 모든 사용자를 의미합니다.
              </p>
            </div>
            <div>
              <p className="font-semibold mb-1">3. 회원</p>
              <p className="text-sm text-neutral-600">
                서비스를 통해 학교에 가입하고, 서비스 이용 계약을 체결한 개인
                또는 단체를 의미합니다.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제3조 서비스의 제공
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p>
              <span className="font-semibold">1.</span> 학교는 이용자에게 다음의
              서비스를 제공합니다:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-600 ml-2">
              <li>학사일정, 공지사항, 학점 조회 등 학사정보</li>
              <li>학식, 셔틀버스, 시설정보 등 캠퍼스정보</li>
              <li>등록금 일정, 장학금 정보 등 맞춤 서비스</li>
              <li>기타 학교에서 제공하는 정보</li>
            </ul>
            <p className="text-sm mt-3">
              <span className="font-semibold">2.</span> 학교는 운영상 필요시
              사전 공지 후 서비스의 내용을 변경하거나 일시 중단할 수 있습니다.
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제4조 회원의 의무
          </h2>
          <div className="space-y-2 text-neutral-700">
            <p>이용자는 서비스 이용 시 다음 행위를 하여서는 안 됩니다:</p>
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-600 ml-2">
              <li>불법적인 컨텐츠의 게시, 배포, 공유</li>
              <li>타인의 개인정보 침해 행위</li>
              <li>서비스의 정상적 기능을 방해하는 행위</li>
              <li>악의적인 목적의 정보 수집 및 이용</li>
              <li>부정한 접근, 해킹, 시스템 구축물 침해</li>
              <li>기타 불법적 또는 부당한 행위</li>
            </ul>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제5조 지적재산권
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p>
              <span className="font-semibold">1.</span> 서비스에 포함된 모든
              컨텐츠의 저작권 및 지적재산권은 학교에 귀속됩니다.
            </p>
            <p>
              <span className="font-semibold">2.</span> 이용자는 학교의 사전
              승인 없이 이 컨텐츠를 복제, 배포, 전시, 전송할 수 없습니다.
            </p>
            <p>
              <span className="font-semibold">3.</span> 이용자가 작성한 컨텐츠의
              저작권은 이용자에게 귀속되며, 학교는 이를 자유롭게 이용할 수 있는
              라이선스를 부여받습니다.
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제6조 책임의 제한
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p>
              학교는 다음의 경우 서비스로 인해 발생한 손해에 대해 책임을 지지
              않습니다:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-600 ml-2">
              <li>이용자의 부주의 또는 오용으로 인한 손해</li>
              <li>천재지변 등 불가소항력으로 인한 손해</li>
              <li>제3자의 불법 행위로 인한 손해 (학교의 과실이 없는 경우)</li>
              <li>기타 학교의 합리적 통제 범위 밖의 원인</li>
            </ul>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제7조 약관의 변경
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p>
              <span className="font-semibold">1.</span> 학교는 필요한 경우 이
              약관을 변경할 수 있습니다.
            </p>
            <p>
              <span className="font-semibold">2.</span> 약관 변경 시 변경 사유
              및 변경 내용을 명시하여 최소 7일 이전에 공지합니다.
            </p>
            <p>
              <span className="font-semibold">3.</span> 변경된 약관에 동의하지
              않는 이용자는 서비스 이용을 중단할 수 있습니다.
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제8조 기타
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p>
              <span className="font-semibold">1.</span> 이 약관의 해석 및 수정은
              대한민국의 법을 적용합니다.
            </p>
            <p>
              <span className="font-semibold">2.</span> 분쟁 발생 시 서울의
              일반법원에 제소할 수 있습니다.
            </p>
            <p>
              <span className="font-semibold">3.</span> 기타 문의사항은
              support_team@syu.kr로 연락 바랍니다.
            </p>
          </div>
        </Card>

        <div className="text-center text-sm text-neutral-600 mt-8 pt-6 border-t border-neutral-200">
          <p>이용약관 시행일: 2025년 4월 1일</p>
          <p>최종 수정일: 2025년 4월 1일</p>
        </div>
      </div>
    </Container>
  );
}
