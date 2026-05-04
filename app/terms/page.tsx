import { Container } from "@/app/components/Container";
import { Icon } from "@/app/components/Icon";
import {
  LegalPageHeader,
  LegalSection,
} from "@/app/features/legal/LegalPageLayout";
import { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "이용약관",
  description: "SYU CAMPUS 이용약관",
};

const serviceItems = [
  {
    title: "학사정보",
    description: "학사공지, 학사일정, 학과공지, 졸업요건 간편확인",
  },
  {
    title: "캠퍼스정보",
    description:
      "캠퍼스공지, 캠퍼스 지도, 셔틀버스 시간표, 실시간 버스 위치 조회, 학식 정보, 도서관 열람실 현황",
  },
  { title: "장학금정보", description: "장학금 안내" },
  {
    title: "통합검색",
    description: "모든 공지사항, 일정, 연락처, 건물 정보를 통합 검색",
  },
  { title: "기타서비스", description: "PWA 지원으로 앱처럼 사용 가능" },
];

const prohibitedActions = [
  "불법적인 콘텐츠의 게시, 배포, 공유",
  "타인의 개인정보 침해 행위",
  "서비스의 정상적 기능을 방해하는 행위",
  "크롤링, 스크래핑 등 악의적인 정보 수집",
  "자동화 도구/봇을 이용한 서버 부하 행위 (개인적 서버 테스트 제외)",
  "부정한 접근, 해킹, 시스템 침해",
  "기타 불법적 또는 부당한 행위",
];

const liabilityLimits = [
  "이용자의 부주의 또는 오용으로 인한 손해",
  "네트워크 지연, 시스템 과부하 등 기술적 문제",
  "학교 서버 점검 또는 학교 전산 정책 변경",
  "제3자의 불법 행위로 인한 손해",
  "데이터의 정확성, 완전성, 시의성을 보장하지 않음",
  "기타 제공자의 합리적 통제 범위 밖의 원인",
];

function NumberedParagraph({
  number,
  children,
}: {
  number: number;
  children: ReactNode;
}) {
  return (
    <p>
      <span className="font-semibold">{number}.</span> {children}
    </p>
  );
}

export default function TermsPage() {
  return (
    <Container className="py-6 sm:py-8">
      <LegalPageHeader
        title="이용약관"
        description="SYU CAMPUS 서비스 이용약관입니다. 2026년 3월 22일 시행"
        noticeTitle="중요 공지"
        noticeTone="red"
        notice="본 서비스는 삼육대학교의 공식 서비스가 아닙니다. 제공되는 모든 자료는 참고용이며, 정확한 정보는 학교 공식 웹사이트를 참고하시기 바랍니다."
      />

      <div className="space-y-6 mb-8">
        <LegalSection title="제1조 목적">
          <p className="text-neutral-700 leading-relaxed">
            이 약관은 삼육대학교 학생들을 위해 제공되는 &quot;SYU CAMPUS&quot;
            (이하 &quot;서비스&quot;)의 이용과 관련하여 SYU KR(이하
            &quot;제공자&quot;)과 이용자의 권리 및 의무를 정하는 것을 목적으로
            합니다.
          </p>
        </LegalSection>

        <LegalSection title="제2조 정의">
          <div className="space-y-3 text-neutral-700">
            {[
              [
                "서비스",
                "삼육대학교 학생들이 학사정보, 캠퍼스 생활 정보, 공지사항을 통합적으로 확인할 수 있는 웹 플랫폼을 의미합니다.",
              ],
              [
                "이용자",
                "이 약관에 동의하고 서비스를 이용하는 삼육대학교 학생을 의미합니다.",
              ],
              [
                "제공자",
                "SYU CAMPUS 서비스를 개발, 운영, 관리하는 SYU KR을 의미합니다.",
              ],
            ].map(([title, description], index) => (
              <div key={title}>
                <p className="font-semibold mb-1">
                  {index + 1}. {title}
                </p>
                <p className="text-sm text-neutral-600">{description}</p>
              </div>
            ))}
          </div>
        </LegalSection>

        <LegalSection title="제3조 서비스의 내용">
          <div className="space-y-3 text-neutral-700">
            <div className="p-3 bg-orange-50 border border-orange-200 rounded mb-3">
              <p className="text-sm text-orange-900 font-semibold flex items-center gap-2">
                <Icon
                  name="alert-circle"
                  size={16}
                  color="rgb(194, 65, 12)"
                  className="flex-shrink-0"
                />
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
              {serviceItems.map((item) => (
                <li key={item.title}>
                  <strong>{item.title}</strong>: {item.description}
                </li>
              ))}
            </ul>
            <NumberedParagraph number={2}>
              제공되는 정보는 공개된 학교 공식 정보를 크롤링하거나 JSON 데이터
              형태로 관리됩니다.
            </NumberedParagraph>
            <NumberedParagraph number={3}>
              제공자는 운영상 필요시 사전 공지 후 서비스의 내용을 변경하거나
              일시 중단할 수 있습니다.
            </NumberedParagraph>
            <NumberedParagraph number={4}>
              본 서비스는 삼육대학교의 공식 서비스가 아니며, SYU KR에 의해
              개발되었습니다. 서비스 이용 시 발생하는 모든 문제 또는 손해에 대해
              제공자는 책임을 지지 않습니다.
            </NumberedParagraph>
          </div>
        </LegalSection>

        <LegalSection title="제4조 사용자의 책임">
          <div className="space-y-2 text-neutral-700">
            <p>이용자는 서비스 이용 시 다음 행위를 하여서는 안 됩니다:</p>
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-600 ml-2">
              {prohibitedActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </div>
        </LegalSection>

        <LegalSection title="제5조 데이터 및 개인정보">
          <div className="space-y-3 text-neutral-700">
            <NumberedParagraph number={1}>
              서비스는 로컬 스토리지를 이용하여 기본적인 사용자 설정 정보를
              저장할 수 있습니다.
            </NumberedParagraph>
            <NumberedParagraph number={2}>
              문의 및 제보 기능을 이용하는 경우, 사용자가 직접 입력한 내용과
              선택 연락처가 서비스 개선 검토를 위해 서버에 저장될 수 있습니다.
            </NumberedParagraph>
            <NumberedParagraph number={3}>
              저장된 문의 및 제보 내용은 개별 답변을 보장하지 않으며, 제공자의
              판단에 따라 서비스 개선과 데이터 수정에 참고됩니다.
            </NumberedParagraph>
            <NumberedParagraph number={4}>
              서비스의 검색 노출 최적화를 위해 Google Search Console을 통해
              사이트 데이터를 수집할 수 있습니다.
            </NumberedParagraph>
          </div>
        </LegalSection>

        <LegalSection title="제6조 서비스 제공의 제한 및 종료">
          <div className="space-y-3 text-neutral-700">
            <NumberedParagraph number={1}>
              이용자가 본 약관을 위반하는 경우, 제공자는 사전 통지 없이 서비스
              이용을 제한하거나 중단할 수 있습니다.
            </NumberedParagraph>
            <NumberedParagraph number={2}>
              서비스의 보안 문제, 학교 정책 변경, 기술적 문제 등으로 인해 일시
              중단될 수 있습니다.
            </NumberedParagraph>
            <NumberedParagraph number={3}>
              제공자의 판단에 따라 서비스를 영구 종료할 수 있습니다. 이 경우
              최소 30일 전에 공지합니다.
            </NumberedParagraph>
          </div>
        </LegalSection>

        <LegalSection title="제7조 책임의 제한">
          <div className="space-y-3 text-neutral-700">
            <p>제공자는 다음의 경우 서비스로 인해 발생한 손해에 대해 책임을 지지 않습니다:</p>
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-600 ml-2">
              {liabilityLimits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </div>
        </LegalSection>

        <LegalSection title="제8조 약관의 변경">
          <div className="space-y-3 text-neutral-700">
            <NumberedParagraph number={1}>
              제공자는 필요한 경우 이 약관을 변경할 수 있습니다.
            </NumberedParagraph>
            <NumberedParagraph number={2}>
              약관 변경 시 변경 사유 및 변경 내용을 명시하여 최소 7일 이전에
              공지합니다.
            </NumberedParagraph>
            <NumberedParagraph number={3}>
              변경된 약관에 동의하지 않는 이용자는 서비스 이용을 중단할 수
              있습니다.
            </NumberedParagraph>
          </div>
        </LegalSection>

        <LegalSection title="제9조 준거법 및 관할">
          <div className="space-y-3 text-neutral-700">
            <NumberedParagraph number={1}>
              이 약관의 해석 및 수정은 대한민국의 법을 적용합니다.
            </NumberedParagraph>
            <NumberedParagraph number={2}>
              분쟁 발생 시 대한민국의 일반법원에 제소할 수 있습니다.
            </NumberedParagraph>
          </div>
        </LegalSection>
      </div>
    </Container>
  );
}
