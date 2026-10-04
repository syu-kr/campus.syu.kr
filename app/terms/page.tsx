import { Container } from "@/app/components/Container";
import { Icon } from "@/app/components/Icon";
import {
  LegalPageHeader,
  LegalSection,
} from "@/app/features/legal/LegalPageLayout";
import {
  LOCALE_HEADER_NAME,
  getDictionary,
  localizePath,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import type { ReactNode } from "react";

const REVISED_TERMS_EFFECTIVE_AT = Date.parse("2026-11-04T00:00:00+09:00");

function revisedTermsAreEffective() {
  return Date.now() >= REVISED_TERMS_EFFECTIVE_AT;
}

async function getRequestLocale(): Promise<Locale> {
  const headerStore = await headers();
  return normalizeLocale(headerStore.get(LOCALE_HEADER_NAME));
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();

  return locale === "en"
    ? {
        title: revisedTermsAreEffective() ? "Terms of Use" : "Upcoming Terms of Use",
        description: "SYU CAMPUS Terms of Use",
      }
    : {
        title: revisedTermsAreEffective() ? "이용약관" : "이용약관 개정안 (시행 예정)",
        description: "SYU CAMPUS 이용약관",
      };
}

function TermsRevisionNotice({ locale }: { locale: Locale }) {
  const effective = revisedTermsAreEffective();
  const english = locale === "en";
  return (
    <aside className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-relaxed text-blue-900">
      <p className="font-semibold">
        {english ? "Terms amendment announced October 4, 2026" : "이용약관 개정 공지: 2026년 10월 4일"}
      </p>
      <p className="mt-2">
        {english
          ? effective
            ? "These revised Terms apply from 00:00 Korean time on November 4, 2026. The amendment notice explains the changes and preserves the previous Terms."
            : "This is the upcoming Terms text, scheduled to apply from 00:00 Korean time on November 4, 2026. Until then, the current Terms preserved in the amendment notice remain applicable."
          : effective
            ? "이 개정 약관은 2026년 11월 4일 00:00(한국 시간)부터 적용됩니다. 변경 내용과 이전 약관 전문은 개정 공지에서 확인할 수 있습니다."
            : "아래는 2026년 11월 4일 00:00(한국 시간)부터 적용할 시행 예정 약관입니다. 그 전까지는 개정 공지에 보존한 현행 약관이 적용됩니다."}
      </p>
      <Link href={localizePath("/service/notices/017-roommate-board", locale)} className="mt-2 inline-flex min-h-11 items-center font-medium underline underline-offset-4">
        {english ? "Amendment notice and current/previous Terms in full" : "개정 공지와 현행·이전 약관 전문 확인"}
      </Link>
    </aside>
  );
}

const serviceItems = [
  {
    title: "학사정보",
    description:
      "학사공지, 학사일정, 학과공지, 졸업요건 간편확인, 시간표 짜기 및 공유",
  },
  {
    title: "캠퍼스정보",
    description:
      "캠퍼스공지, 캠퍼스 지도, 셔틀버스 시간표, 실시간 버스 위치 조회, 학식 정보, 도서관 열람실 현황",
  },
  { title: "장학금정보", description: "장학금 안내" },
  {
    title: "캠퍼스 꿀팁",
    description:
      "학교생활, 전공 학습, 진로, 대외활동 등에 도움이 되는 외부 링크와 학생 제보 기반 자료",
  },
  {
    title: "문의 및 제보",
    description:
      "서비스 문의, 데이터 수정 요청, 캠퍼스 꿀팁 제보 접수 및 운영자 검토",
  },
  {
    title: "일정 잡기",
    description:
      "초대 링크를 통해 참여자의 가능한 시간을 모으고 일정 조율을 돕는 기능",
  },
  {
    title: "기숙사 룸메이트 게시판",
    description: "학교 이메일 인증 이용자의 모집글 게시, 카카오 오픈채팅 연결 및 신고 접수",
  },
  {
    title: "알림",
    description: "사용자가 명시적으로 허용한 경우 서비스 공지 푸시 알림 제공",
  },
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

const englishServiceItems = [
  {
    title: "Academic Information",
    description:
      "Academic notices, schedules, department notices, graduation checks, timetable tools, and timetable sharing",
  },
  {
    title: "Campus Information",
    description:
      "Campus notices, maps, shuttle information, cafeteria menus, library seat status, and campus facilities",
  },
  {
    title: "Dorm Roommate Board",
    description:
      "School-email-verified recruitment listings, Kakao Open Chat links, and reports",
  },
  {
    title: "Student Tools",
    description:
      "Scholarship notices, campus tips, contact/suggestion forms, schedule coordination, notifications, search, and PWA support",
  },
];

const englishProhibitedActions = [
  "Posting, distributing, or sharing illegal content",
  "Infringing another person's privacy or personal information",
  "Interfering with normal service operation",
  "Malicious crawling, scraping, automation, or server load generation",
  "Unauthorized access, hacking, or system intrusion",
  "Any other illegal or unfair use of the service",
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

function RoommateTerms({ english = false }: { english?: boolean }) {
  const items = english ? [
    "The board is for finding Sahmyook University dorm roommates. An @syuin.ac.kr email sign-in link verifies mailbox access. There is no separate registration form or password, but Firebase Authentication creates or uses an authentication user record. This does not verify current enrollment, dorm admission, or official roommate assignments. Follow the university's official application and assignment procedures.",
    "Users are responsible for the accuracy of their recruitment posts and must not impersonate others, disclose personal information without permission, post spam, harass others or submit abusive reports. Avoid real names, phone numbers and exact room numbers. Recruitment is limited to one active post per email and up to 30 calendar days including the creation date.",
    "Listings and contact links are visible to verified board users while recruiting. Contact then takes place through the writer's Kakao Open Chat link, under Kakao's terms. The provider does not arrange rooms, guarantee a match, or read external conversations. Completed and deleted listings cannot be reopened. These limits do not exclude the provider's duties to protect personal information or address reported misuse under applicable law.",
    "Administrators review reports and may hide or delete a listing or place its author on a writing hold for privacy exposure, impersonation, spam, harassment, or other violations. A hold normally lasts 30 days; its reason and end time appear in My listing. Administrators may release it or extend it with a reason. A hold ending does not automatically restore a hidden listing. Report counts alone do not trigger hiding. During a hold, reporting and completing or deleting your own listing remain available.",
    "You may raise a report-related question or appeal through the site's Contact page, including after recruitment ends. Reports are reviewed by administrators without AI classification. Immediate or round-the-clock response is not promised, but statutory user rights and complaint-handling duties continue to apply.",
    "The board, new posts/edits or new authentication emails may be paused separately for operation. Personal-data processing and retention follow the Privacy Policy. Roommate reports do not use the site's AI classification tools for other submissions.",
  ] : [
    "게시판은 삼육대학교 기숙사 룸메이트 모집을 위한 기능입니다. @syuin.ac.kr 이메일의 로그인 링크로 메일 소유를 확인합니다. 별도 가입 화면이나 비밀번호는 없지만 Firebase Authentication에 인증 사용자 자료가 생성되거나 기존 자료가 사용됩니다. 재학 상태, 입사 합격이나 공식 방 배정을 확인하는 인증은 아닙니다. 학교의 공식 신청 및 지정 절차를 따라야 합니다.",
    "이용자는 모집 내용의 정확성을 확인하고 사칭, 동의 없는 개인정보 공개, 스팸, 괴롭힘과 악의적인 신고를 하지 않아야 합니다. 실명, 전화번호와 정확한 호실은 적지 않습니다. 이메일당 활성 모집글 1개와 등록일 포함 최대 30일 모집 기간을 적용합니다.",
    "모집 중인 글과 연락 링크는 학교 이메일로 인증한 게시판 이용자에게 공개됩니다. 연락은 작성자의 카카오 오픈채팅 링크에서 이루어지며 Kakao의 약관을 따릅니다. 제공자는 방 배정이나 매칭 성사를 보증하지 않고 외부 대화를 열람하지 않습니다. 완료하거나 삭제한 글은 다시 모집 중으로 돌릴 수 없습니다. 이 안내는 제공자의 개인정보 보호나 신고된 침해에 관한 법령상 의무를 배제하지 않습니다.",
    "관리자는 신고를 검토하여 개인정보 노출, 사칭, 스팸, 괴롭힘 또는 그 밖의 약관 위반에 대해 글 숨김·삭제나 작성 보류를 적용할 수 있습니다. 보류는 기본 30일이며 사유와 종료 시각은 ‘내 글 관리’에서 확인할 수 있습니다. 관리자는 보류를 해제하거나 사유를 기재하여 연장할 수 있습니다. 보류 종료만으로 숨김 글이 자동 복구되지는 않습니다. 신고 수만으로 자동 숨김 처리하지 않으며, 보류 중에도 신고와 본인 글의 완료·삭제는 가능합니다.",
    "신고 처리에 관한 문의나 이의제기는 모집 종료 후에도 사이트 문의로 접수할 수 있습니다. 룸메이트 신고는 AI 분류 없이 관리자가 검토합니다. 상시·즉시 대응을 보장하지 않지만, 법령상 이용자 권리와 불만 처리 의무를 제한하지 않습니다.",
    "운영상 게시판 전체, 신규 작성과 수정, 새 인증 메일 발송을 각각 중지할 수 있습니다. 개인정보 처리와 보존은 개인정보처리방침을 따릅니다. 다른 문의·제보에 사용하는 AI 분류 도구는 룸메이트 신고에 적용하지 않습니다.",
  ];
  return (
    <LegalSection title={english ? "Article 4. Dorm Roommate Board" : "제4조 기숙사 룸메이트 게시판"}>
      <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-neutral-700">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ol>
    </LegalSection>
  );
}

function EnglishTermsPage() {
  const legal = getDictionary("en").legal;

  return (
    <Container className="py-6 sm:py-8">
      <LegalPageHeader
        title={revisedTermsAreEffective() ? "Terms of Use" : "Upcoming Terms of Use"}
        description="SYU CAMPUS Terms amendment announced October 4, 2026. Effective November 4, 2026."
        homeHref={localizePath("/", "en")}
        homeLabel={legal.home}
        noticeTitle="Important Notice"
        noticeTone="red"
        notice="SYU CAMPUS is not an official Sahmyook University service. This English version is provided for convenience; if it differs from the Korean version, the Korean version applies."
      />
      <TermsRevisionNotice locale="en" />

      <div className="space-y-6 mb-8">
        <LegalSection title="Article 1. Purpose">
          <p className="text-neutral-700 leading-relaxed">
            These Terms define the rights and obligations between Sanghyeok
            Seo, the individual operator using the service name SYU KR
            (the provider), and users of SYU CAMPUS, a web platform for Sahmyook
            University students.
          </p>
        </LegalSection>

        <LegalSection title="Article 2. Definitions">
          <div className="space-y-3 text-neutral-700">
            {[
              [
                "Service",
                "The SYU CAMPUS web platform that provides integrated academic, campus, and notice information.",
              ],
              [
                "User",
                "A person who uses the service after agreeing to these Terms.",
              ],
              [
                "Provider",
                "Sanghyeok Seo, the individual who develops, operates, and maintains SYU CAMPUS under the service operating name SYU KR.",
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

        <LegalSection title="Article 3. Service Scope">
          <div className="space-y-3 text-neutral-700">
            <div className="p-3 bg-orange-50 border border-orange-200 rounded mb-3">
              <p className="text-sm text-orange-900 font-semibold flex items-center gap-2">
                <Icon
                  name="alert-circle"
                  size={16}
                  color="rgb(194, 65, 12)"
                  className="flex-shrink-0"
                />
                Reference-only information
              </p>
              <p className="text-xs text-orange-800 mt-1">
                Notices, schedules, cafeteria data, bus data, and other
                information are provided for reference only. Always verify
                important information on official Sahmyook University websites.
              </p>
            </div>
            <p>
              <span className="font-semibold">1.</span> The service may provide
              the following features:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-600 ml-2">
              {englishServiceItems.map((item) => (
                <li key={item.title}>
                  <strong>{item.title}</strong>: {item.description}
                </li>
              ))}
            </ul>
            <NumberedParagraph number={2}>
              Academic and campus information may be collected from public
              university sources or maintained as JSON data. Recruitment
              listings are written by users and are distinct from official
              university notices.
            </NumberedParagraph>
            <NumberedParagraph number={3}>
              The provider may change, pause, or terminate service features when
              operationally necessary after prior notice where practical.
            </NumberedParagraph>
          </div>
        </LegalSection>

        <RoommateTerms english />

        <LegalSection title="Article 5. User Responsibilities">
          <div className="space-y-2 text-neutral-700">
            <p>Users must not engage in the following actions:</p>
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-600 ml-2">
              {englishProhibitedActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </div>
        </LegalSection>

        <LegalSection title="Article 6. Data and Privacy">
          <div className="space-y-3 text-neutral-700">
            <NumberedParagraph number={1}>
              The service may store basic settings in local storage on the
              user&apos;s device.
            </NumberedParagraph>
            <NumberedParagraph number={2}>
              Contact, suggestion, campus-tip, schedule coordination, and push
              notification features may store user-provided data or notification
              tokens only for service operation and improvement.
            </NumberedParagraph>
            <NumberedParagraph number={3}>
              Timetable sharing may store selected course IDs, year, semester,
              and request metadata for creating and loading share links.
            </NumberedParagraph>
            <NumberedParagraph number={4}>
              Campus-tip submissions and contact requests may be reviewed,
              classified, edited for safety or clarity, rejected, or removed at
              the provider&apos;s discretion.
            </NumberedParagraph>
            <NumberedParagraph number={5}>
              The provider may use AI-assisted admin classification for internal
              triage after redacting contact details or obvious identifiers
              where practical.
            </NumberedParagraph>
            <NumberedParagraph number={6}>
              Privacy details are governed by the Privacy Policy.
            </NumberedParagraph>
          </div>
        </LegalSection>

        <LegalSection title="Article 7. Restrictions and Termination">
          <div className="space-y-3 text-neutral-700">
            <NumberedParagraph number={1}>
              The provider may restrict access for violations of these Terms.
              Where possible, the reason and scope of a restriction are
              communicated. Urgent security or privacy risks may be addressed
              before notice, with an opportunity to raise an appeal afterward.
            </NumberedParagraph>
            <NumberedParagraph number={2}>
              Security incidents, technical issues, or university policy changes
              may temporarily interrupt the service. The provider will give at
              least 30 days&apos; notice before permanently ending the service.
            </NumberedParagraph>
          </div>
        </LegalSection>

        <LegalSection title="Article 8. Responsibility and Service Limits">
          <div className="space-y-3 text-neutral-700">
            <p>
              The provider takes reasonable steps to maintain service accuracy,
              security, and availability. Responsibility for damage is
              determined under applicable law, considering each party&apos;s
              fault and the cause of the damage. These Terms do not exclude
              liability that cannot lawfully be excluded or transfer the
              provider&apos;s statutory duties to users.
            </p>
            <p className="text-sm text-neutral-600">
              External information such as cafeteria menus, library status,
              shuttle information, and notices may differ from the original
              source because of source delays, changes, or errors.
            </p>
          </div>
        </LegalSection>

        <LegalSection title="Article 9. Changes to the Terms">
          <div className="space-y-3 text-neutral-700">
            <NumberedParagraph number={1}>
              The provider may update these Terms when necessary and will post
              the reason and details at least seven days before a change takes
              effect. A change that disadvantages users or materially affects
              their rights will be announced at least 30 days in advance.
            </NumberedParagraph>
            <NumberedParagraph number={2}>
              Users who do not agree to the revised Terms may stop using the
              service and request deletion of their personal information. Where
              consent is legally required, it will be obtained separately;
              silence or continued use alone will not replace it.
            </NumberedParagraph>
          </div>
        </LegalSection>

        <LegalSection title="Article 10. Governing Law and Jurisdiction">
          <p className="text-neutral-700 leading-relaxed">
            These Terms are governed by the laws of the Republic of Korea.
            Disputes may be submitted to the courts having jurisdiction under
            applicable law.
          </p>
        </LegalSection>
      </div>
    </Container>
  );
}

export default async function TermsPage() {
  const locale = await getRequestLocale();
  const legal = getDictionary(locale).legal;

  if (locale === "en") {
    return <EnglishTermsPage />;
  }

  return (
    <Container className="py-6 sm:py-8">
      <LegalPageHeader
        title={revisedTermsAreEffective() ? "이용약관" : "이용약관 개정안 (시행 예정)"}
        description="SYU CAMPUS 이용약관 개정안입니다. 2026년 10월 4일 공지, 2026년 11월 4일 시행."
        homeHref={localizePath("/", locale)}
        homeLabel={legal.home}
        noticeTitle="중요 공지"
        noticeTone="red"
        notice="본 서비스는 삼육대학교의 공식 서비스가 아닙니다. 학사·캠퍼스 안내는 참고용이며 학교 공식 웹사이트에서 확인해주세요. 룸메이트 모집글은 이용자가 작성한 내용입니다."
      />
      <TermsRevisionNotice locale={locale} />

      <div className="space-y-6 mb-8">
        <LegalSection title="제1조 목적">
          <p className="text-neutral-700 leading-relaxed">
            이 약관은 삼육대학교 학생들을 위해 제공되는 &quot;SYU CAMPUS&quot;
            (이하 &quot;서비스&quot;)의 이용과 관련하여 서상혁(개인, 서비스
            운영 명칭 &quot;SYU KR&quot;, 이하 &quot;제공자&quot;)과 이용자의
            권리 및 의무를 정하는 것을 목적으로 합니다.
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
                "SYU KR이라는 운영 명칭으로 SYU CAMPUS 서비스를 개발, 운영, 관리하는 개인 서상혁을 의미합니다.",
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
                학사·캠퍼스 안내 자료(공지사항, 시간표, 학식 정보 등)는
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
              학사·캠퍼스 안내 정보는 공개된 학교 공식 정보를 수집하거나 JSON
              데이터 형태로 관리됩니다. 모집글은 이용자가 직접 작성한 자료이며
              학교 공식 공지와 구분됩니다.
            </NumberedParagraph>
            <NumberedParagraph number={3}>
              제공자는 운영상 필요시 사전 공지 후 서비스의 내용을 변경하거나
              일시 중단할 수 있습니다.
            </NumberedParagraph>
            <NumberedParagraph number={4}>
              본 서비스는 삼육대학교의 공식 서비스가 아니며, 제공자가
              개발·운영합니다. 제공자는 정보의 정확성과 안정성을 위해 합리적인
              노력을 합니다. 서비스 이용으로 발생한 손해에 대한 책임은
              제8조와 관계 법령에 따릅니다.
            </NumberedParagraph>
          </div>
        </LegalSection>

        <RoommateTerms />

        <LegalSection title="제5조 사용자의 책임">
          <div className="space-y-2 text-neutral-700">
            <p>이용자는 서비스 이용 시 다음 행위를 하여서는 안 됩니다:</p>
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-600 ml-2">
              {prohibitedActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </div>
        </LegalSection>

        <LegalSection title="제6조 데이터 및 개인정보">
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
              일정 잡기 기능을 이용하는 경우, 일정 방 제목, 설명, 후보 시간,
              참여자 닉네임과 가능 시간이 링크 공유 및 일정 조율을 위해 서버에
              저장될 수 있습니다.
            </NumberedParagraph>
            <NumberedParagraph number={4}>
              시간표 공유 기능을 이용하는 경우, 선택한 강의 식별자, 학년도,
              학기, 공유 링크 생성 시점의 브라우저 정보가 링크 생성과 조회를
              위해 서버에 저장될 수 있습니다.
            </NumberedParagraph>
            <NumberedParagraph number={5}>
              푸시 알림을 허용한 경우, 알림 발송을 위한 브라우저 알림 토큰이
              저장될 수 있습니다. 알림 권한은 브라우저 설정에서 언제든지 변경할
              수 있습니다.
            </NumberedParagraph>
            <NumberedParagraph number={6}>
              저장된 문의 및 제보 내용은 개별 답변을 보장하지 않으며, 제공자의
              판단에 따라 서비스 개선과 데이터 수정에 참고됩니다.
            </NumberedParagraph>
            <NumberedParagraph number={7}>
              캠퍼스 꿀팁 제보 및 문의 내용은 운영자 검토 과정에서 분류, 보류,
              비공개, 삭제, 안전성 검토, 표현 정리 등의 처리가 이루어질 수
              있습니다.
            </NumberedParagraph>
            <NumberedParagraph number={8}>
              운영자는 문의 및 제보의 우선순위와 처리 방향을 판단하기 위해,
              명백한 개인정보를 가능한 범위에서 마스킹한 뒤 AI 분류 보조 도구를
              사용할 수 있습니다.
            </NumberedParagraph>
            <NumberedParagraph number={9}>
              서비스의 검색 노출 최적화를 위해 Google Search Console을 통해
              사이트 데이터를 수집할 수 있습니다.
            </NumberedParagraph>
            <NumberedParagraph number={10}>
              개인정보 처리의 구체적인 항목, 보유기간, 위탁, 국외 처리, 파기
              방법은 개인정보처리방침에 따릅니다.
            </NumberedParagraph>
          </div>
        </LegalSection>

        <LegalSection title="제7조 서비스 제공의 제한 및 종료">
          <div className="space-y-3 text-neutral-700">
            <NumberedParagraph number={1}>
              이용자가 본 약관을 위반하는 경우, 제공자는 서비스 이용을 제한할
              수 있으며 가능한 경우 제한 사유와 범위를 안내합니다. 긴급한
              보안 위협이나 개인정보 침해는 먼저 조치한 뒤 안내할 수 있으며,
              이용자는 사이트 문의를 통해 이의를 제기할 수 있습니다.
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

        <LegalSection title="제8조 책임 및 서비스의 한계">
          <div className="space-y-3 text-neutral-700">
            <p>
              제공자는 서비스의 정확성, 보안과 안정성을 위해 합리적인 노력을
              합니다. 손해배상 책임은 각 당사자의 귀책사유와 손해의 원인 등을
              고려하여 관계 법령에 따라 정합니다. 이 약관은 법령상 배제할 수
              없는 책임을 제외하거나 제공자의 의무를 이용자에게 전가하지
              않습니다. 다음의 사유는 서비스의 정확성이나 이용 가능성에
              영향을 줄 수 있습니다:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-600 ml-2">
              {liabilityLimits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
            <p className="text-sm text-neutral-600">
              특히 학식, 도서관, 버스, 공지사항 등 외부 또는 학교 시스템에서
              가져오는 정보는 원본 제공처의 변경, 지연, 오류에 따라 실제 내용과
              다를 수 있습니다.
            </p>
          </div>
        </LegalSection>

        <LegalSection title="제9조 약관의 변경">
          <div className="space-y-3 text-neutral-700">
            <NumberedParagraph number={1}>
              제공자는 필요한 경우 이 약관을 변경할 수 있습니다.
            </NumberedParagraph>
            <NumberedParagraph number={2}>
              약관 변경 시 변경 사유 및 변경 내용을 명시하여 최소 7일 이전에
              공지합니다. 이용자에게 불리하거나 권리에 중대한 영향을 주는
              변경은 최소 30일 이전에 공지합니다.
            </NumberedParagraph>
            <NumberedParagraph number={3}>
              변경된 약관에 동의하지 않는 이용자는 서비스 이용을 중단할 수
              있으며 개인정보 삭제를 요청할 수 있습니다. 법령상 동의가 필요한
              사항은 별도로 동의를 받으며, 응답이 없거나 계속 이용한다는
              이유만으로 이를 대신하지 않습니다.
            </NumberedParagraph>
          </div>
        </LegalSection>

        <LegalSection title="제10조 준거법 및 관할">
          <div className="space-y-3 text-neutral-700">
            <NumberedParagraph number={1}>
              이 약관의 해석 및 수정은 대한민국의 법을 적용합니다.
            </NumberedParagraph>
            <NumberedParagraph number={2}>
              분쟁 발생 시 관계 법령에 따라 관할권이 있는 법원에 제소할 수
              있습니다.
            </NumberedParagraph>
          </div>
        </LegalSection>
      </div>
    </Container>
  );
}
