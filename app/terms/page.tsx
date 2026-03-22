import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import { AlertCircle } from "lucide-react";
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
          SYU CAMPUS 서비스 이용약관입니다. 2026년 3월 22일 시행
        </p>
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-900 font-semibold mb-2">중요 공지</p>
          <p className="text-sm text-red-800">
            본 서비스는 삼육대학교의 공식 서비스가 아닙니다. 제공되는 모든
            자료는 참고용이며, 정확한 정보는 학교 공식 웹사이트를 참고하시기
            바랍니다.
          </p>
        </div>
      </div>

      <div className="space-y-6 mb-8">
        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제1조 목적
          </h2>
          <p className="text-neutral-700 leading-relaxed">
            이 약관은 삼육대학교 학생들을 위해 제공되는 &quot;SYU CAMPUS&quot;
            (이하 &quot;서비스&quot;)의 이용과 관련하여 SYU KR(이하
            &quot;제공자&quot;)과 이용자의 권리 및 의무를 정하는 것을 목적으로
            합니다.
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
                삼육대학교 학생들이 학사정보, 캠퍼스 생활 정보, 공지사항을
                통합적으로 확인할 수 있는 웹 플랫폼을 의미합니다.
              </p>
            </div>
            <div>
              <p className="font-semibold mb-1">2. 이용자</p>
              <p className="text-sm text-neutral-600">
                이 약관에 동의하고 서비스를 이용하는 삼육대학교 학생을
                의미합니다.
              </p>
            </div>
            <div>
              <p className="font-semibold mb-1">3. 제공자</p>
              <p className="text-sm text-neutral-600">
                SYU CAMPUS 서비스를 개발, 운영, 관리하는 SYU KR을 의미합니다.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제3조 서비스의 내용
          </h2>
          <div className="space-y-3 text-neutral-700">
            <div className="p-3 bg-orange-50 border border-orange-200 rounded mb-3">
              <p className="text-sm text-orange-900 font-semibold flex items-center gap-2">
                <AlertCircle size={16} className="flex-shrink-0" />
                참고용 자료
              </p>
              <p className="text-xs text-orange-800 mt-1">
                본 서비스의 모든 자료(공지사항, 시간표, 학식 정보 등)는
                참고용입니다. 정확한 정보는 반드시 삼육대학교 공식 웹사이트를
                확인하시기 바랍니다.
              </p>
            </div>
            <p>
              <span className="font-semibold">1.</span> 서비스는 다음의 기능을
              제공합니다:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-600 ml-2">
              <li>
                <strong>학사정보</strong>: 학사공지, 학사일정, 학과공지,
                행사정보
              </li>
              <li>
                <strong>캠퍼스정보</strong>: 캠퍼스 지도, 셔틀버스 시간표, 학식
                정보, 도서관 열람실 현황
              </li>
              <li>
                <strong>재정정보</strong>: 등록금 일정, 장학금 안내, 캠퍼스공지
              </li>
              <li>
                <strong>통합검색</strong>: 모든 공지사항, 일정, 연락처, 건물
                정보를 통합 검색
              </li>
              <li>
                <strong>기타서비스</strong>: PWA 지원으로 앱처럼 사용 가능
              </li>
            </ul>
            <p className="text-sm mt-3">
              <span className="font-semibold">2.</span> 제공되는 정보는 공개된
              학교 공식 정보를 크롤링하거나 JSON 데이터 형태로 관리됩니다.
            </p>
            <p className="text-sm mt-3">
              <span className="font-semibold">3.</span> 제공자는 운영상 필요시
              사전 공지 후 서비스의 내용을 변경하거나 일시 중단할 수 있습니다.
            </p>
            <p className="text-sm mt-3">
              <span className="font-semibold">4.</span> 본 서비스는 삼육대학교의
              공식 서비스가 아니며, SYU KR에 의해 개발되었습니다. 서비스 이용 시
              발생하는 모든 문제 또는 손해에 대해 제공자는 책임을 지지 않습니다.
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제4조 사용자의 책임
          </h2>
          <div className="space-y-2 text-neutral-700">
            <p>이용자는 서비스 이용 시 다음 행위를 하여서는 안 됩니다:</p>
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-600 ml-2">
              <li>불법적인 콘텐츠의 게시, 배포, 공유</li>
              <li>타인의 개인정보 침해 행위</li>
              <li>서비스의 정상적 기능을 방해하는 행위</li>
              <li>크롤링, 스크래핑 등 악의적인 정보 수집</li>
              <li>
                자동화 도구/봇을 이용한 서버 부하 행위 (개인적 서버 테스트 제외)
              </li>
              <li>부정한 접근, 해킹, 시스템 침해</li>
              <li>기타 불법적 또는 부당한 행위</li>
            </ul>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제5조 데이터 및 개인정보
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p>
              <span className="font-semibold">1.</span> 서비스는 로컬 스토리지를
              이용하여 기본적인 사용자 설정 정보를 저장할 수 있습니다.
            </p>
            <p>
              <span className="font-semibold">2.</span> 서버에는 개인정보가
              저장되지 않으며, 모든 데이터는 클라이언트(사용자 기기)에서만
              처리됩니다.
            </p>
            <p>
              <span className="font-semibold">3.</span> 서비스의 성능 개선을
              위해 Vercel Analytics를 통해 사용 패턴을 익명으로 수집할 수
              있습니다.
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제6조 서비스 제공의 제한 및 종료
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p>
              <span className="font-semibold">1.</span> 이용자가 본 약관을
              위반하는 경우, 제공자는 사전 통지 없이 서비스 이용을 제한하거나
              중단할 수 있습니다.
            </p>
            <p>
              <span className="font-semibold">2.</span> 서비스의 보안 문제, 학교
              정책 변경, 기술적 문제 등으로 인해 일시 중단될 수 있습니다.
            </p>
            <p>
              <span className="font-semibold">3.</span> 제공자의 판단에 따라
              서비스를 영구 종료할 수 있습니다. 이 경우 최소 30일 전에
              공지합니다.
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제7조 책임의 제한
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p>
              제공자는 다음의 경우 서비스로 인해 발생한 손해에 대해 책임을 지지
              않습니다:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-600 ml-2">
              <li>이용자의 부주의 또는 오용으로 인한 손해</li>
              <li>네트워크 지연, 시스템 과부하 등 기술적 문제</li>
              <li>학교 서버 점검 또는 학교 전산 정책 변경</li>
              <li>제3자의 불법 행위로 인한 손해</li>
              <li>데이터의 정확성, 완전성, 최신성을 보장하지 않음</li>
              <li>기타 제공자의 합리적 통제 범위 밖의 원인</li>
            </ul>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제8조 약관의 변경
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p>
              <span className="font-semibold">1.</span> 제공자는 필요한 경우 이
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
            제9조 준거법 및 관할
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p>
              <span className="font-semibold">1.</span> 이 약관의 해석 및 수정은
              대한민국의 법을 적용합니다.
            </p>
            <p>
              <span className="font-semibold">2.</span> 분쟁 발생 시 대한민국의
              일반법원에 제소할 수 있습니다.
            </p>
          </div>
        </Card>
      </div>
    </Container>
  );
}
