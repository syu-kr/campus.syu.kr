import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import { LegalPageHeader } from "@/app/features/legal/LegalPageLayout";
import {
  LOCALE_HEADER_NAME,
  getDictionary,
  localizePath,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n";
import type { Metadata } from "next";
import { headers } from "next/headers";

const policySections = [
  ["개인정보의 처리 목적", "Purposes of Processing"],
  ["개인정보의 처리 및 보유 기간", "Retention"],
  ["처리하는 개인정보의 항목", "Categories of Information"],
  ["개인정보의 제공·위탁 및 국외 이전", "Sharing, Processors, and Overseas Processing"],
  ["쿠키(Cookie) 정보", "Cookies and Browser Storage"],
  ["Google 분석도구 및 외부 처리 도구", "Analytics, Firebase, and AI Classification"],
  ["개인정보의 안전성 확보 조치", "Security Measures"],
  ["정보주체와 법정대리인의 권리·의무 및 그 행사방법", "User Rights and How to Exercise Them"],
  ["개인정보 보호책임자에 관한 사항", "Privacy Contact"],
  ["정보주체의 권익침해에 대한 구제방법", "Remedies"],
  ["개인정보 처리방침 변경", "Policy Changes"],
];

function PrivacyContents({ english = false }: { english?: boolean }) {
  return (
    <Card as="section" hover={false} className="mb-6">
      <h2 className="mb-3 text-lg font-bold text-neutral-900">
        {english ? "Contents" : "목차"}
      </h2>
      <nav aria-label={english ? "Privacy policy contents" : "개인정보처리방침 목차"}>
        <ol className="grid gap-x-6 sm:grid-cols-2">
          {policySections.map(([korean, englishTitle], index) => (
            <li key={index}>
              <a
                href={`#privacy-article-${index + 1}`}
                className="inline-flex min-h-11 items-center gap-2 py-2 text-sm text-neutral-700 hover:text-primary-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              >
                <span className="shrink-0 text-neutral-500">{index + 1}.</span>
                {english ? englishTitle : korean}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </Card>
  );
}

async function getRequestLocale(): Promise<Locale> {
  const headerStore = await headers();
  return normalizeLocale(headerStore.get(LOCALE_HEADER_NAME));
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();

  return locale === "en"
    ? {
        title: "Privacy Policy",
        description: "SYU CAMPUS Privacy Policy",
      }
    : {
        title: "개인정보처리방침",
        description: "SYU CAMPUS 개인정보처리방침",
      };
}

function RoommateRetention({ english = false }: { english?: boolean }) {
  const rows = [
    ["Email and Firebase authentication user record", "Used for email verification and identifying the same author on return visits. Signing out or deleting a listing does not delete this record. The current service has no automatic inactivity deletion for Firebase Authentication. To end authentication use and request deletion, contact the privacy contact in Article 9."],
    ["Browser session and server session record", "Valid for a fixed 30 days from authentication, or 12 hours if Keep me signed in is unchecked. Signing out revokes that session. Expired server session records are deleted by the scheduled cleanup."],
    ["Pending email in the browser", "Used for up to 24 hours to complete a sign-in link. Removed on completion or when leaving through the Campus link. An expired value is removed when the service next reads it; it may remain on a closed browser until then. You can remove it immediately by clearing site data."],
    ["Recruitment listing, contact link, and sharing-consent record", "No longer shown to other users when completed, deleted, expired, or hidden. The deletion deadline is 30 days after the earlier of the first completion/deletion and the recruitment deadline. The latest consent time and notice version are deleted with the listing. Editing or hiding does not extend retention."],
    ["Report, evidence snapshot, and administrator review notes", "Retained for 30 days after submission, whether resolved or not. The snapshot may include the reported nickname, introduction, dorm/room capacity, and contact link, and is accessible only to administrators."],
    ["Author activity and writing hold", "Eligible for deletion 90 days after the last author or administrator action, if there is no active recruiting listing or current writing hold. A hold normally lasts 30 days and administrators may release or extend it with a reason."],
    ["Administrator and cleanup audit records", "Retained for up to 365 days for abuse handling and accountability. Includes the administrator identifier, action, target identifier, status, and time. Does not copy report text or Open Chat links."],
  ];
  const koreanRows = [
    ["학교 이메일·Firebase 인증 사용자 자료", "메일 소유 확인과 재방문 시 동일 작성자 확인에 이용합니다. 로그아웃이나 모집글 삭제만으로 삭제되지 않으며, 현재 Firebase Authentication에는 미이용 계정 자동 삭제가 적용되어 있지 않습니다. 인증 이용 종료와 삭제는 제9조 개인정보 보호책임자에게 요청할 수 있습니다."],
    ["브라우저 접속 쿠키·서버 접속 상태", "인증 시점부터 고정 30일이며 ‘이 브라우저에서 30일 유지’를 해제하면 12시간입니다. 로그아웃 시 해당 접속 상태를 무효화하고, 기한이 지난 서버 기록은 예약 정리 작업으로 삭제합니다."],
    ["브라우저의 인증 대기 이메일", "로그인 링크를 완성하기 위해 24시간까지 이용합니다. 인증 완료나 ‘캠퍼스’ 링크로 나갈 때 삭제합니다. 기한이 지난 값은 다음 읽기 때 삭제하므로 닫힌 브라우저에는 그때까지 남을 수 있습니다. 사이트 데이터 삭제로 즉시 제거할 수 있습니다."],
    ["모집글·연락 링크·공개 동의 기록", "완료·삭제·만료·숨김 시 다른 이용자에게 표시하지 않습니다. 최초 완료·삭제 시각과 모집 마감 시각 중 이른 시각에서 30일 후 파기 대상으로 삼습니다. 최종 공개 동의 시각과 고지 버전은 글과 함께 파기하며, 수정이나 숨김으로 보유기간을 늘리지 않습니다."],
    ["신고·신고 당시 글의 근거·관리자 검토 메모", "접수 후 30일이며 미처리 신고도 동일하게 파기합니다. 근거에는 신고된 글의 닉네임, 소개, 기숙사·인실, 연락 링크가 포함될 수 있고 관리자만 열람합니다."],
    ["작성자 활동·작성 보류 상태", "작성자 또는 관리자의 최종 조치 후 90일이 지나고 유효한 모집글이나 작성 보류가 없으면 파기합니다. 작성 보류는 기본 30일이며 관리자가 사유를 기재하여 해제하거나 연장할 수 있습니다."],
    ["관리자 조치·정리 감사 기록", "침해 대응과 처리 이력 확인을 위해 최대 365일 보유합니다. 관리자 식별정보, 조치 종류, 대상 식별정보, 상태와 시각을 포함하며 신고 본문이나 연락 링크를 중복 저장하지 않습니다."],
  ];
  return (
    <section className="space-y-3 border-t border-neutral-200 pt-4">
      <h3 className="font-semibold text-base text-neutral-900">{english ? "Dorm roommate board retention" : "11. 기숙사 룸메이트 게시판 보유기간"}</h3>
      <dl className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 text-sm">
        {(english ? rows : koreanRows).map(([name, description]) => (
          <div key={name} className="grid gap-2 p-4 sm:grid-cols-[1fr_2fr] sm:gap-6">
            <dt className="font-medium text-neutral-900">{name}</dt>
            <dd className="leading-relaxed text-neutral-600">{description}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-neutral-600">{english ? "Server expiry and physical deletion are separate: access is restricted at expiry and the scheduled daily cleanup deletes expired records. These are service retention periods, not statutory retention requirements. An earlier deletion or processing-suspension request may be made through the privacy contact; where retention is legally necessary, the reason and period will be explained." : "서버의 접근 기한과 실제 삭제 시점은 구분됩니다. 기한이 지나면 열람을 제한하고 일일 예약 정리에서 만료 자료를 삭제합니다. 위 기간은 서비스 운영 기준이며 법령상 의무 보존기간을 뜻하지 않습니다. 더 이른 삭제·처리정지 요구는 개인정보 보호책임자에게 접수할 수 있고, 법령에 따라 보존해야 하는 경우 그 사유와 기간을 안내합니다."}</p>
      <p className="text-sm text-neutral-600">{english ? "Firebase Authentication logs IP addresses for a few weeks. Other authentication data remains until the operator initiates user deletion; Google states deletion from live and backup systems may take up to 180 days after that request." : "Firebase Authentication은 접속 IP 기록을 수 주간 보유합니다. 그 밖의 인증 자료는 운영자가 인증 사용자 삭제를 요청할 때까지 남으며, Google은 삭제 요청 후 실제 시스템과 백업에서 제거하는 데 최대 180일이 걸릴 수 있다고 안내합니다."} <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-700 underline">{english ? "Firebase retention information" : "Firebase 보유·삭제 안내"}</a></p>
    </section>
  );
}

function RoommateInformation({ english = false }: { english?: boolean }) {
  const items = english ? [
    ["Authentication and access (required for the board)", "School email, authentication user identifier, verification time, session expiry, and protected identifiers for confirming session/author ownership. Firebase also processes IP addresses and browser information for authentication security. Mailbox and SU-WINGs passwords are not collected."],
    ["Recruitment listing (required when posting)", "Nickname, dorm and room capacity, stay dates, recruitment deadline, number of roommates needed, and Kakao Open Chat link. Used to display recruitment information and enable contact. The latest sharing-consent time and notice version are stored as evidence of the writer's choice."],
    ["Living habits and introduction (optional)", "Selected bedtime/wake-up time, cleaning, indoor calls, sleep habits, smoking, temperature preferences, sharing preferences, and introduction. You can leave all of these blank and still post."],
    ["Reports and operation (when used)", "Report reason, optional explanation, a snapshot of the reported listing, a protected reporter identifier, review notes/status, writing-hold reason/period, and administrator action records. Used for review, abuse prevention, and handling objections. Request counters use protected author or IP-derived identifiers."],
  ] : [
    ["인증·접속 정보 (게시판 이용 시 필수)", "학교 이메일, 인증 사용자 식별정보, 인증 시각, 접속 만료 시각, 접속·작성자 확인을 위한 보호된 식별정보를 처리합니다. Firebase는 인증 보안을 위해 IP 주소와 브라우저 정보도 처리합니다. 학교 메일이나 SU-WINGs 비밀번호는 받지 않습니다."],
    ["모집글 (작성 시 필수)", "닉네임, 기숙사와 인실, 거주 시작·종료일, 모집 마감일, 모집 인원, 카카오 오픈채팅 링크를 모집 정보 표시와 연락 연결에 이용합니다. 작성자의 선택을 확인하기 위해 최종 공개 동의 시각과 고지 버전을 함께 저장합니다."],
    ["생활습관·소개 (선택)", "선택한 취침·기상 시간, 청소, 실내 통화, 잠버릇, 흡연, 냉난방, 물건 공유 선호와 소개를 처리합니다. 모두 미기재해도 글을 등록할 수 있습니다."],
    ["신고·운영 정보 (해당 기능 이용 시)", "신고 사유, 선택 설명, 신고 당시 글의 근거, 보호된 신고자 식별정보, 검토 메모·상태, 작성 보류 사유·기간, 관리자 조치 기록을 신고 검토와 부정 이용 방지, 이의 처리에 이용합니다. 요청 횟수 제한에는 작성자 또는 IP에서 만든 보호된 식별정보를 이용합니다."],
  ];
  return (
    <section className="space-y-3 border-t border-neutral-200 pt-4 text-sm">
      <h3 className="font-semibold text-base text-neutral-900">{english ? "Dorm roommate board information" : "9. 기숙사 룸메이트 게시판 정보"}</h3>
      <dl className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
        {items.map(([title, content]) => (
          <div key={title} className="space-y-2 p-4">
            <dt className="font-medium text-neutral-900">{title}</dt>
            <dd className="leading-relaxed text-neutral-600">{content}</dd>
          </div>
        ))}
      </dl>
      <p className="text-neutral-600">{english ? "Do not enter real names, phone numbers, exact room numbers, national identifiers, diagnoses, disability details, religious beliefs, political views, or another person's personal information. Optional entries are shown to verified users if included in a published listing. Leave them blank to keep them private." : "실명·전화번호·정확한 호실·주민등록번호, 질병 진단·장애 정보·종교·정치적 견해나 타인의 개인정보는 입력하지 마세요. 선택항목도 글에 포함해 공개하면 인증 이용자에게 표시됩니다. 공개하고 싶지 않은 항목은 입력하지 않을 수 있습니다."}</p>
    </section>
  );
}

function RoommateSharing({ english = false }: { english?: boolean }) {
  return (
    <section className="space-y-3 text-sm">
      <h3 className="font-semibold text-base text-neutral-900">{english ? "Sharing recruitment listings" : "모집글의 이용자 간 공개"}</h3>
      <ul className="list-disc space-y-2 pl-5 leading-relaxed text-neutral-600">
        <li>{english ? "Recipients: roommate board users verified with an @syuin.ac.kr email address. The purpose is to review roommate candidates and contact a writer." : "제공받는 자: @syuin.ac.kr 이메일로 인증한 룸메이트 게시판 이용자. 이용 목적: 기숙사 룸메이트 후보 확인 및 작성자와의 연락."}</li>
        <li>{english ? "Shared information: nickname, dorm/room capacity, stay dates, recruitment deadline/number needed, Open Chat link, and any selected living habits or introduction. Email addresses, authentication credentials, and internal author identifiers are not shown." : "제공 항목: 닉네임, 기숙사·인실, 거주 기간, 모집 마감일·인원, 오픈채팅 링크, 작성자가 선택한 생활습관과 소개. 이메일, 인증 비밀값과 내부 작성자 식별정보는 표시하지 않습니다."}</li>
        <li>{english ? "Availability: only while recruiting. The board stops displaying the listing and providing its contact link when completed, deleted, expired, or hidden. Recipients must stop using and delete the information when their roommate-contact purpose is fulfilled or recruitment ends, whichever comes first. Do not copy, repost, sell, or use it for advertising or harassment." : "이용 기간: 모집 중에만 제공하며 완료·삭제·만료·숨김 시 게시판 열람과 연락 링크 제공을 중단합니다. 제공받은 이용자는 연락 목적을 달성하거나 모집이 종료되면 지체 없이 이용을 중단하고 자료를 삭제해야 합니다. 복제·재게시·판매, 광고나 괴롭힘에 이용할 수 없습니다."}</li>
        <li>{english ? "You may decline sharing and continue using verification and browsing. A listing cannot be published or edited without sharing consent. To withdraw, delete the listing from My listing or contact the operator. The site cannot retrieve copies another user has already made outside the service." : "공개 동의를 거부해도 인증과 모집글 열람은 이용할 수 있으며, 글 등록·수정은 제한됩니다. ‘내 글 관리’에서 삭제하거나 운영자에게 요청하여 공개를 철회할 수 있습니다. 다른 이용자가 이미 서비스 밖에 복사한 자료는 사이트가 회수할 수 없습니다."}</li>
      </ul>
      <p className="text-neutral-600">{english ? "Reports and evidence are available only to authorized administrators. Kakao Open Chat is an external service opened at the user's choice; SYU CAMPUS does not read or store the conversation. This link is distinct from processing entrusted to the hosting or authentication provider." : "신고 내용과 근거는 권한이 있는 관리자만 열람합니다. 카카오 오픈채팅은 이용자가 선택하여 이동하는 외부 서비스이며 SYU CAMPUS는 대화를 읽거나 저장하지 않습니다. 이 외부 링크와 인증·호스팅 업체에 대한 처리위탁은 구분합니다."}</p>
    </section>
  );
}

function RoommateOverseasProcessing({ english = false }: { english?: boolean }) {
  const rows = english ? [
    ["Google LLC (United States Firebase processing)", "United States. School email, authentication identifier and verification/sign-in information, IP address, and browser information. Sent over encrypted connections when requesting or completing an email link and checking authentication.", "Email delivery, mailbox verification, and authentication security. Authentication records and Google's deletion processing follow Article 2; signing out does not delete the authentication user."],
    ["Vercel Inc. (privacy@vercel.com)", "United States (the configured server-function region is iad1). The email and authentication/session data needed by a request, submitted listing/report information, IP address, and browser information are processed over encrypted connections when using the server features.", "Website hosting, request handling, and security. Request contents are processed to complete the request; the application does not write roommate email, authentication credentials, listing contents, or contact links to runtime logs. Hobby runtime logs have a one-hour viewable retention window. Provider-generated security/service records follow Vercel's processing terms and are deleted or anonymized when their purpose ends."],
  ] : [
    ["Google LLC (Firebase 미국 처리)", "미국. 학교 이메일, 인증 식별정보와 인증·로그인 정보, IP 주소와 브라우저 정보가 인증 메일 요청·인증 완료·인증 상태 확인 시 암호화 통신으로 전달됩니다.", "인증 메일 발송, 메일 소유 확인과 인증 보안. 인증 자료의 보유와 Google의 삭제 처리는 제2조에 따르며 로그아웃만으로 인증 사용자 자료가 삭제되지 않습니다."],
    ["Vercel Inc. (privacy@vercel.com)", "미국(현재 서버 함수 리전 iad1). 서버 기능 이용 시 요청에 필요한 이메일·인증·접속 정보, 입력한 모집글·신고 정보, IP 주소와 브라우저 정보를 암호화 통신으로 처리합니다.", "웹사이트 호스팅, 요청 처리와 보안. 입력 내용은 요청을 처리하기 위해 이용하며 앱은 룸메이트 이메일·인증 비밀값·글 본문·연락 링크를 실행 로그에 기록하지 않습니다. Hobby 실행 로그의 조회 가능 기간은 1시간입니다. 사업자가 생성하는 보안·서비스 기록은 Vercel 처리 약관에 따라 목적이 종료되면 삭제하거나 익명화합니다."],
  ];
  return (
    <section className="space-y-3 border-t border-neutral-200 pt-4 text-sm">
      <h3 className="font-semibold text-base text-neutral-900">{english ? "Overseas processing for the roommate board" : "룸메이트 게시판의 국외 처리"}</h3>
      <p className="leading-relaxed text-neutral-600">{english ? "The authentication and server services below are entrusted processing needed to provide the service requested by the user. Transfer details are disclosed under Article 28-8(1)(3) of the Personal Information Protection Act; this disclosure is not a claim that separate overseas-transfer consent was obtained." : "아래 인증·서버 서비스는 이용자가 요청한 서비스를 제공하기 위해 필요한 처리위탁입니다. 「개인정보 보호법」 제28조의8제1항제3호에 따른 국외 처리 내용을 공개하며, 별도의 국외 이전 동의를 받았다는 의미는 아닙니다."}</p>
      <div className="space-y-3">
        {rows.map(([name, information, purpose], index) => (
          <div key={name} className="rounded-lg border border-neutral-200 p-4">
            <h4 className="mb-3 font-semibold text-neutral-900">{name}</h4>
            <dl className="space-y-3">
              <div>
                <dt className="font-medium">{english ? "Country, information, timing, and method" : "국가·항목·시기 및 방법"}</dt>
                <dd className="mt-1 leading-relaxed text-neutral-600">{information}</dd>
              </div>
              <div>
                <dt className="font-medium">{english ? "Purpose and retention" : "목적 및 보유·이용 기간"}</dt>
                <dd className="mt-1 leading-relaxed text-neutral-600">{purpose}</dd>
              </div>
            </dl>
            {index === 0 && <a href="https://firebase.google.com/support/privacy/dpo" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-primary-700 underline">{english ? "Firebase privacy contact" : "Firebase 개인정보 문의"}</a>}
          </div>
        ))}
      </div>
      <p className="leading-relaxed text-neutral-600">{english ? "The Firestore database storing roommate records is configured in Seoul, South Korea (asia-northeast3). Domestic database storage does not prevent overseas processing: the United States server functions read and process that data. Firebase Authentication separately uses United States data centers." : "룸메이트 자료를 저장하는 Firestore 데이터베이스는 대한민국 서울(asia-northeast3)에 설정되어 있습니다. 국내 데이터베이스에 저장하더라도 미국의 서버 함수가 조회·처리하므로 국외 처리가 발생합니다. Firebase Authentication은 이 저장 위치와 별도로 미국 데이터센터를 사용합니다."}</p>
      <p className="leading-relaxed text-neutral-600">{english ? "Google's published contracting-entity terms list Google Cloud Korea LLC for a South Korean billing address and define Google under that reseller arrangement as Google Asia Pacific Pte. Ltd. and/or its affiliates. The actual contracting entity depends on the billing address and applicable agreement. These contract roles are distinct from United States processing: Google LLC is listed as a United States data-center, service-maintenance, and support entity in Google's subprocessor list. The official list below identifies other entities and countries authorized for maintenance or customer-requested support." : "Google의 공개 계약 법인 안내는 한국 결제 주소에 Google Cloud Korea LLC를 기재하고, 해당 재판매 계약에서 Google을 Google Asia Pacific Pte. Ltd. 및 문맥에 따른 계열사로 정의합니다. 실제 계약 법인은 결제 주소와 적용 계약에 따릅니다. 이 계약상 역할과 미국의 데이터 처리는 구분되며, 공식 재수탁사 목록은 Google LLC를 미국 데이터센터 운영·서비스 유지보수·기술지원 법인으로 기재합니다. 유지보수나 고객이 요청한 기술지원에 참여할 수 있는 다른 법인과 국가는 아래 공식 목록에서 확인할 수 있습니다."}</p>
      <p className="leading-relaxed text-neutral-600">{english ? "To refuse these transfers, do not start email verification, or request suspension/deletion through the contact in Article 9. Refusal prevents use of authenticated roommate features, while public site features remain available. Overseas-processing or deletion questions may also be submitted to the providers through their official contacts below; user requests to SYU CAMPUS remain the operator's responsibility." : "이전을 원하지 않으면 학교 이메일 인증을 시작하지 않거나 제9조 연락처로 처리정지·삭제를 요청할 수 있습니다. 거부하면 인증이 필요한 룸메이트 기능을 이용할 수 없지만 공개 사이트 기능은 이용할 수 있습니다. 국외 처리나 삭제에 관한 문의는 아래 공식 연락처로도 접수할 수 있으며, SYU CAMPUS 이용자의 권리 요구 처리 책임은 운영자에게 있습니다."}</p>
      <p className="flex flex-wrap gap-x-4 gap-y-2">
        <a href="https://firebase.google.com/support/privacy/dpo" target="_blank" rel="noopener noreferrer" className="text-primary-700 underline">{english ? "Firebase privacy contact" : "Firebase 개인정보 문의"}</a>
        <a href="https://cloud.google.com/terms/google-entity" target="_blank" rel="noopener noreferrer" className="text-primary-700 underline">{english ? "Google service entities" : "Google 서비스 법인 안내"}</a>
        <a href="https://cloud.google.com/terms/subprocessors" target="_blank" rel="noopener noreferrer" className="text-primary-700 underline">{english ? "Google subprocessor entities and countries" : "Google 재수탁 법인·국가 목록"}</a>
        <a href="https://vercel.com/legal/privacy-notice" target="_blank" rel="noopener noreferrer" className="text-primary-700 underline">{english ? "Vercel privacy contact" : "Vercel 개인정보 문의"}</a>
        <a href="https://vercel.com/docs/logs/runtime" target="_blank" rel="noopener noreferrer" className="text-primary-700 underline">{english ? "Vercel runtime-log retention" : "Vercel 실행 로그 보유 안내"}</a>
      </p>
    </section>
  );
}

function EnglishPrivacyPage() {
  const legal = getDictionary("en").legal;

  return (
    <Container className="py-6 sm:py-8">
      <LegalPageHeader
        title="Privacy Policy"
        description="Privacy policy for the SYU CAMPUS service."
        homeHref={localizePath("/", "en")}
        homeLabel={legal.home}
        noticeTitle="Effective Date"
        notice="This English version is provided for convenience. If it differs from the Korean Privacy Policy, the Korean version applies. Effective March 23, 2026. Last updated October 4, 2026."
      />

      <PrivacyContents english />

      <div className="mb-8 space-y-6 [&_li]:leading-relaxed [&_p]:leading-relaxed">
        <Card as="section" id="privacy-article-1" hover={false} className="scroll-mt-24">
          <h2 className="mb-4 text-xl font-bold text-neutral-900">1. Purposes of Processing</h2>
          <div className="space-y-3 text-neutral-700">
            <p className="text-sm">
              Sanghyeok Seo, the individual operator using the service name
              SYU KR, processes personal information for SYU CAMPUS only as
              needed to operate and improve the service.
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-1">
              <li>Providing and operating service features</li>
              <li>Analyzing service usage and improving quality</li>
              <li>Reviewing contact requests, reports, and suggestions</li>
              <li>Creating schedule coordination links and collecting responses</li>
              <li>Creating timetable share links selected by users</li>
              <li>Sending service push notifications when users opt in</li>
              <li>Verifying school-email ownership, operating roommate recruitment, and reviewing roommate reports</li>
              <li>
                Supporting internal admin triage with AI-assisted classification
                when configured
              </li>
            </ul>
            <p className="text-sm text-neutral-600">
              For the roommate board, email verification, sessions, author
              identification, and processing a requested listing or report are
              necessary to provide the requested service under Article 15(1)(4)
              of the Personal Information Protection Act. Sharing a listing with
              other users requires the writer&apos;s consent under Article
              17(1)(1). Optional living habits and introductions may be omitted.
            </p>
          </div>
        </Card>

        <Card as="section" id="privacy-article-2" hover={false} className="scroll-mt-24">
          <h2 className="mb-4 text-xl font-bold text-neutral-900">2. Retention</h2>
          <div className="space-y-3 text-neutral-700">
            <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-1">
              <li>
                Local settings remain on the user&apos;s device and are deleted
                when browser data is cleared.
              </li>
              <li>
                Contact requests and campus-tip suggestions are retained until
                the review or service-improvement purpose is fulfilled.
              </li>
              <li>
                Schedule coordination rooms, participant responses, and
                timetable share links are retained for up to 90 days.
              </li>
              <li>
                Notification tokens are retained until the user disables
                notifications, the token becomes invalid, or delivery is no
                longer needed.
              </li>
              <li>Notification delivery records are retained for up to 90 days.</li>
              <li>
                Rate-limit counters are retained for the configured request
                window, and notification send locks may be retained for up to 14
                days to prevent duplicate sends.
              </li>
              <li>Admin action audit records are retained for up to 365 days.</li>
            </ul>
            <RoommateRetention english />
            <p className="text-sm text-neutral-600">
              Third-party data such as Kakao Maps cookies and Google service data
              follows each provider&apos;s policies.
            </p>
          </div>
        </Card>

        <Card as="section" id="privacy-article-3" hover={false} className="scroll-mt-24">
          <h2 className="mb-4 text-xl font-bold text-neutral-900">3. Categories of Information</h2>
          <div className="space-y-3 text-neutral-700">
            <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-1">
              <li>Local settings, drafts, participant edit tokens, and owner deletion tokens</li>
              <li>Service logs, access records, IP address, and user agent</li>
              <li>Kakao Maps SDK cookies used for map and shuttle features</li>
              <li>Contact, report, campus-tip, and optional contact details entered by users</li>
              <li>Schedule room titles, descriptions, candidate times, participant nicknames, and availability responses</li>
              <li>Schedule response edit-token hashes and room owner-token hashes used to protect edits and deletion</li>
              <li>Timetable share course IDs, year, semester, and owner-token hash</li>
              <li>Firebase Cloud Messaging tokens and notification delivery records when notifications are enabled</li>
              <li>Rate-limit counters and notification duplicate-send locks</li>
              <li>
                Admin-only AI classification metadata for contact requests or
                suggestions, when generated
              </li>
            </ul>
            <RoommateInformation english />
          </div>
        </Card>

        <Card as="section" id="privacy-article-4" hover={false} className="scroll-mt-24">
          <h2 className="mb-4 text-xl font-bold text-neutral-900">4. Sharing, Processors, and Overseas Processing</h2>
          <div className="mt-4 space-y-3 text-sm text-neutral-700">
            <RoommateSharing english />
            <h3 className="border-t border-neutral-200 pt-4 text-base font-semibold text-neutral-900">Processing entrusted to service providers</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 p-2 text-left">
                      Provider
                    </th>
                    <th className="border border-gray-300 p-2 text-left">
                      Purpose
                    </th>
                    <th className="border border-gray-300 p-2 text-left">
                      Retention
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 p-2">Kakao</td>
                    <td className="border border-gray-300 p-2">
                      Campus map and location-based map SDK features
                    </td>
                    <td className="border border-gray-300 p-2">
                      According to Kakao policies
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-2">Google</td>
                    <td className="border border-gray-300 p-2">
                      Email-link authentication, Firestore data storage,
                      analytics, Search Console, and push
                      notifications
                    </td>
                    <td className="border border-gray-300 p-2">
                      For roommate authentication and stored data, the periods
                      described in Articles 2 and 4; other Google services follow
                      their respective policies
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-2">Vercel</td>
                    <td className="border border-gray-300 p-2">
                      Hosting and deployment
                    </td>
                    <td className="border border-gray-300 p-2">
                      Until the processing purpose is fulfilled or the service
                      relationship ends
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-2">Sentry</td>
                    <td className="border border-gray-300 p-2">
                      Error monitoring with request bodies, cookies, headers, user
                      identity, and URL queries removed before transmission
                    </td>
                    <td className="border border-gray-300 p-2">
                      According to the configured Sentry retention settings
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              The processors above handle data to operate the service on the
              operator&apos;s behalf. This is separate from sharing a writer&apos;s
              listing with other users. Other provision requires a legal basis,
              such as the individual&apos;s consent or a specific legal duty.
            </p>
            <RoommateOverseasProcessing english />
            <h3 className="border-t border-neutral-200 pt-4 text-base font-semibold text-neutral-900">Other external service processing</h3>
            <p>
              Other service features may use Google analytics/notifications,
              Kakao maps, Sentry error monitoring, or a configured AI
              classification API for redacted contact/suggestion triage. These
              purposes do not include roommate report classification or
              roommate page tracking. Personal information or deletion requests
              must not be submitted to the public GitHub repository or issues.
            </p>
          </div>
        </Card>

        <Card as="section" id="privacy-article-5" hover={false} className="scroll-mt-24">
          <h2 className="mb-4 text-xl font-bold text-neutral-900">5. Cookies and Browser Storage</h2>
          <div className="space-y-3 text-neutral-700">
            <p className="text-sm">
              The service primarily uses local storage for user settings. Kakao
              Maps SDK may set cookies for map and shuttle features. The
              roommate board uses an essential login cookie with a fixed 30-day
              expiry, or 12 hours if persistent access is declined. It is removed
              on sign-out. Blocking this cookie prevents authenticated board
              access; public service pages remain available. Pending sign-in
              email storage and removal are explained in Article 2.
            </p>
            <p className="text-sm text-neutral-600">
              Blocking third-party cookies may limit map or shuttle-related
              features.
            </p>
          </div>
        </Card>

        <Card as="section" id="privacy-article-6" hover={false} className="scroll-mt-24">
          <h2 className="mb-4 text-xl font-bold text-neutral-900">6. Analytics, Firebase, and AI Classification</h2>
          <div className="space-y-3 text-neutral-700">
            <p className="text-sm">
              Google Analytics and Search Console support usage analysis and
              search visibility. Firebase Authentication verifies roommate
              email ownership, and Firestore stores service submissions,
              schedules, notification data, and roommate records. Roommate
              pages are excluded from Google Analytics page tracking, and
              roommate reports are not sent to AI classification.
            </p>
            <p className="text-sm text-neutral-600">
              When the admin classification feature is enabled, selected contact
              request or suggestion content may be sent to a configured AI
              classification API after contact details and obvious identifiers
              are redacted where possible. The result is stored only as
              admin-facing triage metadata.
            </p>
          </div>
        </Card>

        <Card as="section" id="privacy-article-7" hover={false} className="scroll-mt-24">
          <h2 className="mb-4 text-xl font-bold text-neutral-900">7. Security Measures</h2>
          <div className="space-y-3 text-neutral-700">
            <p className="text-sm">
              The service uses HTTPS, client-side storage where appropriate,
              Firebase security controls, environment variable management, and
              administrator authentication to protect service data within the
              scope of its operation.
            </p>
          </div>
        </Card>

        <Card as="section" id="privacy-article-8" hover={false} className="scroll-mt-24">
          <h2 className="mb-4 text-xl font-bold text-neutral-900">8. User Rights and How to Exercise Them</h2>
          <div className="space-y-3 text-neutral-700">
            <p className="text-sm">
              Users may request access, correction, deletion, or suspension of
              processing by contacting the service operator through the contact
              page or email.
            </p>
            <p className="text-sm text-neutral-600">
              For roommate records, you can ask the operator to review or
              delete a listing, report, or authentication user record, or stop
              processing. Signing out only ends that browser session. Requests
              remain available after recruitment ends or the board or email
              sending is paused. Identity and affected data are checked to avoid
              unauthorized deletion. Where a request cannot be met under law,
              the operator will explain the reason and available remedies.
            </p>
          </div>
        </Card>

        <Card as="section" id="privacy-article-9" hover={false} className="scroll-mt-24">
          <h2 className="mb-4 text-xl font-bold text-neutral-900">9. Privacy Contact</h2>
          <div className="space-y-3 text-neutral-700">
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <p className="font-semibold text-sm mb-2">Privacy Contact</p>
              <p className="text-sm text-neutral-600">Operator and privacy officer: Sanghyeok Seo (individual)</p>
              <p className="text-sm text-neutral-600">Service operating name: SYU KR</p>
              <p className="text-sm text-neutral-600">
                Email: singhic_dev@syu.kr
              </p>
            </div>
          </div>
        </Card>

        <Card as="section" id="privacy-article-10" hover={false} className="scroll-mt-24">
          <h2 className="mb-4 text-xl font-bold text-neutral-900">10. Remedies</h2>
          <div className="space-y-3 text-neutral-700">
            <p className="text-sm">
              Users may contact Korean privacy dispute or reporting agencies for
              remedies: the Personal Information Dispute Mediation Committee
              (1833-6972, kopico.go.kr), the privacy infringement reporting
              center (118, privacy.kisa.or.kr), the prosecution service (1301,
              spo.go.kr), or the police (182, ecrm.cyber.go.kr).
            </p>
          </div>
        </Card>

        <Card as="section" id="privacy-article-11" hover={false} className="scroll-mt-24">
          <h2 className="mb-4 text-xl font-bold text-neutral-900">11. Policy Changes</h2>
          <div className="space-y-3 text-neutral-700">
            <p className="text-sm">
              Changes are published on this page. Important changes affecting
              user rights are announced in advance or when legally required,
              and consent is obtained separately where required by law.
            </p>
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded">
              <p className="text-xs text-neutral-600">
                <strong>Effective date</strong>: March 23, 2026
                <br />
                <strong>Last updated</strong>: October 4, 2026
              </p>
            </div>
          </div>
        </Card>
      </div>
    </Container>
  );
}

export default async function PrivacyPage() {
  const locale = await getRequestLocale();
  const legal = getDictionary(locale).legal;

  if (locale === "en") {
    return <EnglishPrivacyPage />;
  }

  return (
    <Container className="py-6 sm:py-8">
      <LegalPageHeader
        title="개인정보처리방침"
        description="SYU CAMPUS 서비스 개인정보처리방침입니다."
        homeHref={localizePath("/", locale)}
        homeLabel={legal.home}
        noticeTitle="시행일"
        notice="본 개인정보처리방침은 2026년 3월 23일부터 시행되었으며, 2026년 10월 4일 최종 개정되었습니다."
      />

      <PrivacyContents />

      <div className="mb-8 space-y-6 [&_li]:leading-relaxed [&_p]:leading-relaxed">
        <Card as="section" id="privacy-article-1" hover={false} className="scroll-mt-24">
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제1조 개인정보의 처리 목적
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p className="text-sm">
              서상혁(개인, 서비스 운영 명칭 &quot;SYU KR&quot;)은 SYU CAMPUS
              (이하 &quot;서비스&quot;)의 운영자로서 「개인정보 보호법」 제30조에
              따라 이 방침을 공개하며 다음의 목적을 위하여 개인정보를
              처리합니다.
            </p>
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <h3 className="font-semibold text-sm mb-2">처리 목적</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-1">
                <li>서비스 제공 및 운영</li>
                <li>서비스 이용현황 통계분석 및 활용</li>
                <li>서비스 품질 개선 및 신규 기능 개발</li>
                <li>고객 문의 및 불만사항 처리</li>
                <li>사용자 제보 및 문의 내용 검토와 서비스 개선 반영</li>
                <li>일정 잡기 초대 링크 생성 및 참여자 가능 시간 취합</li>
                <li>사용자가 선택한 시간표 공유 링크 생성 및 조회</li>
                <li>사용자가 허용한 경우 서비스 공지 푸시 알림 발송</li>
                <li>학교 이메일 소유 확인, 룸메이트 모집 운영 및 신고 검토</li>
                <li>운영자 문의·제보 검토를 위한 AI 분류 보조</li>
              </ul>
            </div>
            <p className="text-sm text-neutral-600">
              룸메이트 게시판의 이메일 인증, 접속 상태, 작성자 확인과 이용자가
              요청한 모집글·신고 처리는 「개인정보 보호법」 제15조제1항제4호의
              요청한 서비스 제공에 필요한 처리에 해당합니다. 다른 이용자에
              대한 모집글 공개는 제17조제1항제1호에 따른 작성자의 동의를
              받습니다. 선택 생활습관과 소개는 입력하지 않아도 됩니다.
            </p>
          </div>
        </Card>

        <Card as="section" id="privacy-article-2" hover={false} className="scroll-mt-24">
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제2조 개인정보의 처리 및 보유 기간
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p className="text-sm mb-3">
              처리 목적과 법적 근거별로 아래 기간 동안 개인정보를 보유합니다.
              보유 목적이 끝나거나 적법한 삭제·처리정지 요구가 있는 경우 관계
              법령에 따라 필요한 조치를 합니다.
            </p>
            <div className="space-y-2">
              <div>
                <h3 className="font-semibold text-sm mb-1">1. 로컬 스토리지</h3>
                <p className="text-sm text-neutral-600">
                  사용자 기기에만 저장되며, 브라우저 데이터 삭제 시 함께
                  삭제됩니다.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">2. Kakao Maps 쿠키</h3>
                <p className="text-sm text-neutral-600">
                  Kakao의 정책에 따라 관리됩니다.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">
                  3. 서비스 이용 로그
                </h3>
                <p className="text-sm text-neutral-600">
                  서비스 운영 및 통계 분석 목적으로 필요한 기간 동안 보존됩니다.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">
                  4. 문의 및 제보 정보
                </h3>
                <p className="text-sm text-neutral-600">
                  서비스 개선 검토 목적 달성 시까지 보존하며, 운영상 필요가
                  없어진 경우 삭제합니다.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">
                  5. 일정 잡기 정보
                </h3>
                <p className="text-sm text-neutral-600">
                  일정 방 생성 시점부터 90일까지 보존하며, 만료된 일정 방과
                  참여자 응답은 정리될 수 있습니다.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">
                  6. 푸시 알림 토큰
                </h3>
                <p className="text-sm text-neutral-600">
                  알림 발송 목적 달성 시까지 보존하며, 사용자가 알림을 차단하거나
                  토큰이 유효하지 않은 경우 삭제될 수 있습니다. 알림 발송 결과는
                  생성 시점부터 최대 90일까지 보존합니다.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">
                  7. 시간표 공유 정보
                </h3>
                <p className="text-sm text-neutral-600">
                  공유 링크 생성 시점부터 90일까지 보존하며, 만료된 공유 링크는
                  조회되지 않고 정리될 수 있습니다.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">
                  8. 요청 제한 및 알림 중복 방지 기록
                </h3>
                <p className="text-sm text-neutral-600">
                  요청 제한 카운터는 해당 요청 제한 구간이 끝날 때까지, 알림
                  중복 발송 방지 기록은 생성 시점부터 최대 14일까지 보존될 수
                  있습니다.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">
                  9. AI 분류 결과
                </h3>
                <p className="text-sm text-neutral-600">
                  문의 및 제보 항목의 운영자 검토 목적 달성 시까지 원 접수
                  항목과 함께 보존되며, 운영상 필요가 없어진 경우 삭제합니다.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">
                  10. 관리자 작업 감사 기록
                </h3>
                <p className="text-sm text-neutral-600">
                  관리자 UID·이메일, 작업 종류와 대상, 변경 전후 상태를 최대
                  365일까지 보존합니다.
                </p>
              </div>
            </div>
            <RoommateRetention />
            <div className="mt-4 p-3 bg-neutral-50 border border-neutral-200 rounded">
              <h3 className="font-semibold text-sm mb-2">파기 절차 및 방법</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-1">
                <li>
                  서버에 저장된 정보는 보유 목적이 달성되거나 만료 시 데이터
                  삭제 또는 예약 정리 작업으로 파기합니다. 인증 사용자 자료는
                  일반 게시판 자료 정리와 별도로 Firebase Authentication에서
                  삭제해야 합니다.
                </li>
                <li>
                  로컬 스토리지 정보는 사용자가 브라우저 데이터 삭제, 알림 구독
                  해제, 또는 서비스 내 설정 변경을 통해 삭제할 수 있습니다.
                </li>
                <li>
                  법령상 보존 의무가 있는 경우에는 해당 기간 동안 별도 보관 후
                  파기합니다.
                </li>
              </ul>
            </div>
          </div>
        </Card>

        <Card as="section" id="privacy-article-3" hover={false} className="scroll-mt-24">
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제3조 처리하는 개인정보의 항목
          </h2>
          <div className="space-y-4 text-neutral-700">
            <div>
              <h3 className="font-semibold text-sm mb-2">1. 수집 방법</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-1">
                <li>서비스 이용 과정에서 사용자가 직접 입력한 정보</li>
                <li>서비스 이용 과정에서 자동으로 수집되는 정보</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">
                2. 로컬 스토리지 저장 정보 (선택항목)
              </h3>
              <p className="text-sm text-neutral-600 mb-2">
                사용자 기기에만 저장되며 서버에 전송되지 않습니다:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-2">
                <li>테마 설정 (다크 모드/라이트 모드)</li>
                <li>시간표 초안</li>
                <li>일정 응답 편집 토큰과 일정 방 삭제용 소유 토큰</li>
                <li>시간표 공유 링크 삭제용 소유 토큰</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">
                3. 자동 생성/수집 정보 (필수항목)
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-2">
                <li>서비스 이용 기록 (앱 사용 이력, 접속 기록)</li>
                <li>접속 IP 주소</li>
                <li>쿠키 (Kakao Maps SDK)</li>
                <li>접속 로그</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">
                4. 문의 및 제보 입력 정보 (선택항목)
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-2">
                <li>문의/제보 제목 및 내용</li>
                <li>관련 페이지 URL 또는 관련 링크</li>
                <li>사용자가 선택적으로 입력한 연락처</li>
                <li>접수 시점의 브라우저 정보(User-Agent)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">
                5. 일정 잡기 입력 정보 (선택항목)
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-2">
                <li>일정 방 제목 및 설명</li>
                <li>후보 날짜와 시간대</li>
                <li>참여자 닉네임</li>
                <li>참여자가 선택한 가능 시간</li>
                <li>응답 수정을 위한 편집 토큰 해시</li>
                <li>방 삭제 권한 확인을 위한 소유 토큰 해시</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">
                6. 푸시 알림 정보 (선택항목)
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-2">
                <li>Firebase Cloud Messaging 알림 토큰</li>
                <li>알림 구독 시점과 토큰 갱신 시점</li>
                <li>알림 발송 결과 및 실패 기록</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">
                7. 시간표 공유 정보 (선택항목)
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-2">
                <li>공유 링크에 포함된 강의 식별자 목록</li>
                <li>학년도 및 학기 정보</li>
                <li>공유 링크 삭제 권한 확인을 위한 소유 토큰 해시</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">
                8. 서비스 운영 및 보안 정보
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-2">
                <li>요청 제한 카운터와 만료 시각</li>
                <li>알림 중복 발송 방지 잠금 및 발송 기록</li>
                <li>운영자 검토를 위한 AI 분류 결과와 생성 시점</li>
                <li>관리자 작업 감사 기록</li>
              </ul>
            </div>
            <RoommateInformation />
          </div>
        </Card>

        <Card as="section" id="privacy-article-4" hover={false} className="scroll-mt-24">
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제4조 개인정보의 제공·위탁 및 국외 이전
          </h2>
          <div className="space-y-3 text-neutral-700">
            <div className="space-y-4">
              <RoommateSharing />
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="font-semibold text-sm text-blue-900 mb-2">
                  개인정보 제3자 제공
                </p>
                <p className="text-sm text-blue-900">
                  모집글의 이용자 간 공개 외의 제3자 제공은 정보주체의 동의나
                  법령에 따른 근거가 있는 경우에만 해당 범위에서 이루어집니다.
                  위 수탁업체가 운영자를 대신하여 수행하는 처리위탁은
                  제3자 제공과 구분합니다.
                </p>
              </div>
              <h3 className="border-t border-neutral-200 pt-4 text-base font-semibold text-neutral-900">서비스 운영을 위한 처리위탁</h3>
              <p className="text-sm mb-3">
                본 서비스는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보
                처리업무를 위탁하고 있습니다.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 p-2 text-left">
                        수탁업체
                      </th>
                      <th className="border border-gray-300 p-2 text-left">
                        위탁업무 내용
                      </th>
                      <th className="border border-gray-300 p-2 text-left">
                        개인정보의 보유 및 이용 기간
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 p-2">Kakao</td>
                      <td className="border border-gray-300 p-2">
                        캠퍼스 지도 API 서비스 제공
                      </td>
                      <td className="border border-gray-300 p-2">
                        Kakao의 정책에 따름
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2">Google</td>
                      <td className="border border-gray-300 p-2">
                        이메일 링크 인증, Firebase 데이터 저장, 검색 최적화,
                        분석 및 푸시 알림
                      </td>
                      <td className="border border-gray-300 p-2">
                        룸메이트 인증·저장 자료는 제2조와 본 조의 기간에 따르며,
                        그 밖의 Google 서비스 자료는 해당 정책에 따름
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2">Vercel</td>
                      <td className="border border-gray-300 p-2">
                        서비스 호스팅 및 배포
                      </td>
                      <td className="border border-gray-300 p-2">
                        개인정보의 이용 목적 달성 시 또는 위탁 계약 종료 시
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2">Sentry</td>
                      <td className="border border-gray-300 p-2">
                        오류 모니터링. 전송 전 요청 본문·쿠키·헤더·사용자 식별정보와
                        URL 쿼리를 제거합니다.
                      </td>
                      <td className="border border-gray-300 p-2">
                        설정된 Sentry 보존 정책에 따름
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <RoommateOverseasProcessing />
              <h3 className="border-t border-neutral-200 pt-4 text-base font-semibold text-neutral-900">그 밖의 외부 서비스 처리</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 p-2 text-left">
                        업체
                      </th>
                      <th className="border border-gray-300 p-2 text-left">
                        외부 처리 항목
                      </th>
                      <th className="border border-gray-300 p-2 text-left">
                        목적
                      </th>
                      <th className="border border-gray-300 p-2 text-left">
                        보유 및 이용 기간
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 p-2">Google</td>
                      <td className="border border-gray-300 p-2">
                        분석 이벤트, FCM 토큰 및 발송 기록. 룸메이트 인증과
                        데이터 처리는 위 표에 별도로 안내합니다.
                      </td>
                      <td className="border border-gray-300 p-2">
                        분석, 데이터 저장, 푸시 알림 발송
                      </td>
                      <td className="border border-gray-300 p-2">
                        Google 정책 및 본 방침의 보유기간에 따름
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2">Vercel</td>
                      <td className="border border-gray-300 p-2">
                        접속 로그, 요청 처리에 필요한 서비스 데이터
                      </td>
                      <td className="border border-gray-300 p-2">
                        서비스 호스팅 및 배포
                      </td>
                      <td className="border border-gray-300 p-2">
                        Vercel 정책 및 서비스 운영 기간에 따름
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2">Sentry</td>
                      <td className="border border-gray-300 p-2">
                        최소화된 오류·성능 진단 정보
                      </td>
                      <td className="border border-gray-300 p-2">
                        서비스 오류 모니터링
                      </td>
                      <td className="border border-gray-300 p-2">
                        설정된 Sentry 보존 정책에 따름
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2">Kakao</td>
                      <td className="border border-gray-300 p-2">
                        지도 SDK 사용 과정에서 Kakao가 처리하는 쿠키 및 기기 정보
                      </td>
                      <td className="border border-gray-300 p-2">
                        캠퍼스 지도 및 위치 기반 지도 기능 제공
                      </td>
                      <td className="border border-gray-300 p-2">
                        Kakao 정책에 따름
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2">
                        설정된 AI 분류 API
                      </td>
                      <td className="border border-gray-300 p-2">
                        마스킹 처리된 문의·제보 제목, 내용, 링크, 태그, 운영자
                        메모
                      </td>
                      <td className="border border-gray-300 p-2">
                        운영자 문의·제보 분류 보조
                      </td>
                      <td className="border border-gray-300 p-2">
                        해당 API 제공자의 정책 및 분류 처리 목적 달성 시까지
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-neutral-500">
                사업자의 일반 정책은 룸메이트 자료의 공개 범위나 제2조의
                서비스 보유기간을 대신하지 않습니다. 실제 개인정보와 삭제 요청은
                공개 GitHub 저장소나 이슈에 등록하지 않습니다.
              </p>
            </div>
          </div>
        </Card>

        <Card as="section" id="privacy-article-5" hover={false} className="scroll-mt-24">
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제5조 쿠키(Cookie) 정보
          </h2>
          <div className="space-y-4 text-neutral-700">
            <div>
              <p className="font-semibold text-sm mb-2">쿠키의 개념</p>
              <p className="text-sm text-neutral-600">
                쿠키는 이용자가 웹사이트를 접속할 때 해당 웹사이트에서 이용자의
                웹브라우저를 통해 이용자의 기기에 저장하는 매우 작은 크기의
                텍스트 파일입니다. 웹사이트 서버는 저장된 쿠키의 내용을 읽어
                이용자가 설정한 서비스 이용 환경을 유지하여 편리한 인터넷 서비스
                이용을 가능케 합니다.
              </p>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">
                본 서비스의 쿠키 사용
              </p>
              <p className="text-sm text-neutral-600 mb-3">
                본 서비스는 로컬 스토리지를 주로 사용하며, 캠퍼스 지도 및
                셔틀버스 기능 제공을 위해 Kakao Maps SDK를 사용합니다. Kakao
                Maps 사용 과정에서 Kakao가 쿠키 또는 기기 정보를 처리할 수
                있습니다. 구체적인 항목과 보존기간은 Kakao의 최신 정책을
                확인해주세요.
              </p>
              <p className="text-sm text-neutral-600 mb-3">
                룸메이트 게시판은 인증 상태를 유지하는 필수 접속 쿠키를
                사용합니다. 인증 시점부터 30일이며 접속 유지 선택을 해제하면
                12시간입니다. 로그아웃 시 해당 쿠키와 서버 접속 상태를
                삭제합니다. 이 쿠키를 차단하면 인증이 필요한 게시판 이용이
                제한되며, 공개 사이트 기능은 계속 이용할 수 있습니다.
                인증 대기 이메일의 브라우저 저장·삭제 기준은 제2조에 따릅니다.
              </p>
              <div className="space-y-2 text-sm mb-4 p-3 bg-gray-50 rounded border border-gray-200">
                <p>
                  <span className="font-semibold">목적:</span>
                  <span className="text-neutral-600">
                    지도와 장소 검색 기능 제공
                  </span>
                </p>
                <p>
                  <span className="font-semibold">보존 기간:</span>
                  <span className="text-neutral-600">Kakao의 정책에 따름</span>
                </p>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                <p className="text-sm font-semibold text-amber-900 mb-2">
                  쿠키 차단에 대한 안내
                </p>
                <p className="text-sm text-amber-800 mb-2">
                  이용자는 쿠키에 대한 선택권을 가지고 있으며, 웹브라우저에서
                  옵션을 설정하여 모든 쿠키를 허용하거나, 쿠키가 저장될 때마다
                  확인을 거치거나, 아니면 모든 쿠키의 저장을 거부할 수도
                  있습니다.
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-amber-800 ml-1">
                  <li>브라우저 설정 → 개인정보 보호 및 보안 → 쿠키 설정</li>
                  <li>특정 사이트의 쿠키만 차단</li>
                </ul>
                <p className="text-sm text-amber-800 mt-2">
                  다만, Kakao Maps 쿠키를 거부 시 캠퍼스 지도 및 셔틀버스 기능이
                  제한될 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card as="section" id="privacy-article-6" hover={false} className="scroll-mt-24">
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제6조 Google 분석도구 및 외부 처리 도구
          </h2>
          <div className="space-y-4 text-neutral-700">
            <div>
              <h3 className="font-semibold text-sm mb-2">
                1. Google Analytics 4 (GA4)
              </h3>
              <p className="text-sm text-neutral-600 mb-2">
                본 서비스는 사용자 행동 분석 및 서비스 통계를 위해 Google
                Analytics 4를 사용합니다. 룸메이트 게시판과 인증 페이지는
                페이지 추적 대상에서 제외합니다.
              </p>
              <div className="p-3 bg-gray-50 rounded border border-gray-200 mb-2">
                <p className="text-sm">
                  <span className="font-semibold">수집 정보:</span>
                  <span className="text-neutral-600">
                    {" "}
                    페이지뷰, 사용자 행동, 이벤트 데이터, 기기 정보, 위치 정보
                    등
                  </span>
                </p>
                <p className="text-sm mt-1">
                  <span className="font-semibold">목적:</span>
                  <span className="text-neutral-600">
                    {" "}
                    서비스 사용 분석, 사용자 행동 패턴 파악, 서비스 개선
                  </span>
                </p>
                <p className="text-sm mt-1">
                  <span className="font-semibold">보존 기간:</span>
                  <span className="text-neutral-600">
                    {" "}
                    Google의 정책에 따름
                  </span>
                </p>
              </div>
              <p className="text-sm">
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 underline"
                >
                  Google 개인정보 보호정책 →
                </a>
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">
                2. Google Search Console
              </h3>
              <p className="text-sm text-neutral-600 mb-2">
                본 서비스는 검색 최적화를 위해 Google Search Console을
                사용합니다.
              </p>
              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <p className="text-sm">
                  <span className="font-semibold">수집 정보:</span>
                  <span className="text-neutral-600">
                    {" "}
                    사이트 통계, 검색 분석, 색인 상태 등의 정보
                  </span>
                </p>
                <p className="text-sm mt-1">
                  <span className="font-semibold">목적:</span>
                  <span className="text-neutral-600">
                    {" "}
                    Google 검색 결과 최적화, 서비스 성능 모니터링
                  </span>
                </p>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">
                3. Firebase 및 Firestore
              </h3>
              <p className="text-sm text-neutral-600 mb-2">
                본 서비스는 문의, 꿀팁 제보, 일정 잡기, 푸시 알림 토큰과
                룸메이트 게시판 자료 관리에 Firestore를 사용합니다. 학교 이메일
                소유 확인은 Firebase Authentication으로 처리하며, 항목과 보유기간,
                처리 위치는 제2조부터 제4조에 따릅니다.
              </p>
              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <p className="text-sm">
                  <span className="font-semibold">처리 정보:</span>
                  <span className="text-neutral-600">
                    {" "}
                    사용자가 직접 입력한 문의·제보·일정 정보, 브라우저 정보,
                    알림 토큰, 룸메이트 인증·모집글·신고·운영 정보
                  </span>
                </p>
                <p className="text-sm mt-1">
                  <span className="font-semibold">목적:</span>
                  <span className="text-neutral-600">
                    {" "}
                    서비스 운영, 사용자 제보 검토, 일정 조율, 푸시 알림 발송,
                    룸메이트 모집과 신고 검토
                  </span>
                </p>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">
                4. 운영자 AI 분류 보조
              </h3>
              <p className="text-sm text-neutral-600 mb-2">
                운영자가 문의 및 제보를 빠르게 검토할 수 있도록, 설정된 경우 AI
                분류 API를 이용해 접수 항목의 카테고리, 긴급도, 처리 힌트를
                생성할 수 있습니다. 룸메이트 신고·근거·검토 메모는 이 AI
                분류에 전송하지 않으며 관리자가 직접 검토합니다.
              </p>
              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <p className="text-sm">
                  <span className="font-semibold">처리 정보:</span>
                  <span className="text-neutral-600">
                    {" "}
                    마스킹 처리된 문의·제보 제목, 내용, 링크, 태그, 운영자
                    메모와 AI 분류 결과
                  </span>
                </p>
                <p className="text-sm mt-1">
                  <span className="font-semibold">목적:</span>
                  <span className="text-neutral-600">
                    {" "}
                    운영자 검토 우선순위 판단 및 처리 방향 분류
                  </span>
                </p>
                <p className="text-sm mt-1">
                  <span className="font-semibold">보호조치:</span>
                  <span className="text-neutral-600">
                    {" "}
                    이메일, 전화번호, 식별번호 등 명백한 개인정보는 가능한
                    범위에서 마스킹한 뒤 전송합니다.
                  </span>
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card as="section" id="privacy-article-7" hover={false} className="scroll-mt-24">
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제7조 개인정보의 안전성 확보 조치
          </h2>
          <div className="space-y-3 text-neutral-700">
            <div>
              <h3 className="font-semibold text-sm mb-2">1. 암호화</h3>
              <p className="text-sm text-neutral-600">
                HTTPS 암호화 연결을 통해 데이터 전송 중 보호합니다.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">
                2. 클라이언트 중심 저장
              </h3>
              <p className="text-sm text-neutral-600">
                설정 정보는 사용자 기기의 로컬 스토리지에 저장되며, 문의 및
                제보 과정에서 사용자가 직접 입력한 정보는 서비스 개선 검토를
                위해 서버에 저장될 수 있습니다. 일정 잡기와 푸시 알림 기능에
                필요한 정보도 사용자가 기능을 이용하거나 권한을 허용한 경우에만
                저장됩니다.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">3. 접근 제한</h3>
              <p className="text-sm text-neutral-600">
                관리자 기능은 Firebase Authentication과 허용된 관리자 계정을
                통해 접근을 제한하며, 개인정보가 저장된 데이터베이스는 필요한
                서버 API에서만 접근하도록 관리합니다.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">4. 기술적 대책</h3>
              <p className="text-sm text-neutral-600">
                HTTPS, Firebase 보안 설정, 서버 환경변수 관리, 관리자 인증 등
                서비스 규모에 맞는 기술적 보호조치를 적용합니다.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">5. 접속기록 관리</h3>
              <p className="text-sm text-neutral-600">
                서비스 운영과 보안 확인에 필요한 범위에서 접속 기록과 처리
                기록을 관리하며, 불필요한 정보는 운영상 필요가 없어진 경우
                정리할 수 있습니다.
              </p>
            </div>
          </div>
        </Card>

        <Card as="section" id="privacy-article-8" hover={false} className="scroll-mt-24">
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제8조 정보주체와 법정대리인의 권리·의무 및 그 행사방법
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p className="text-sm">
              정보주체는 본 서비스에 대해 언제든지 개인정보
              열람·정정·삭제·처리정지 요구 등의 권리를 행사할 수 있습니다.
            </p>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-900">
                권리 행사는 사이트 문의 페이지 또는 메일을 통해 문의하시면 지체 없이
                처리하겠습니다.
              </p>
            </div>
            <p className="text-sm">
              권리 행사는 정보주체의 법정대리인이나 위임을 받은 자 등 대리인을
              통하여 하실 수 있습니다.
            </p>
            <p className="text-sm text-neutral-600">
              룸메이트 모집글, 신고, 인증 사용자 자료의 열람·정정·삭제·처리정지
              요구는 모집 종료 후나 게시판·메일 발송 중지 중에도 제9조 연락처로
              접수할 수 있습니다. 로그아웃은 해당 브라우저의 접속 종료이며 인증
              사용자 자료 삭제와 다릅니다. 운영자는 권한 없는 삭제를 막기 위해
              요청자와 대상 자료를 확인합니다. 법령에 따라 요구를 제한해야 하는
              경우에는 그 사유와 권리 구제 방법을 안내합니다.
            </p>
          </div>
        </Card>

        <Card as="section" id="privacy-article-9" hover={false} className="scroll-mt-24">
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제9조 개인정보 보호책임자에 관한 사항
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p className="text-sm">
              정보주체께서는 본 서비스를 이용하시면서 발생한 모든 개인정보 보호
              관련 문의, 불만처리, 피해구제 등에 관한 사항을 문의하실 수
              있습니다.
            </p>
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <h3 className="font-semibold text-sm mb-2">개인정보 보호책임자</h3>
              <p className="text-sm text-neutral-600">운영자 및 개인정보 보호책임자: 서상혁(개인)</p>
              <p className="text-sm text-neutral-600">서비스 운영 명칭: SYU KR</p>
              <p className="text-sm text-neutral-600">
                연락처: singhic_dev@syu.kr
              </p>
            </div>
            <p className="text-sm text-neutral-600">
              문의는 사이트 문의 페이지 또는 메인 페이지 하단의 Footer에서
              확인하실 수 있습니다.
            </p>
          </div>
        </Card>

        <Card as="section" id="privacy-article-10" hover={false} className="scroll-mt-24">
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제10조 정보주체의 권익침해에 대한 구제방법
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p className="text-sm">
              정보주체는 개인정보침해로 인한 구제를 받기 위하여 다음의 기관에
              분쟁해결 또는 상담을 신청할 수 있습니다.
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-600 ml-2">
              <li>
                <strong>개인정보분쟁조정위원회</strong>
                <br />
                <span className="text-xs">
                  (국번없이) 1833-6972 (www.kopico.go.kr)
                </span>
              </li>
              <li>
                <strong>개인정보침해신고센터</strong>
                <br />
                <span className="text-xs">
                  (국번없이) 118 (privacy.kisa.or.kr)
                </span>
              </li>
              <li>
                <strong>대검찰청</strong>
                <br />
                <span className="text-xs">(국번없이) 1301 (www.spo.go.kr)</span>
              </li>
              <li>
                <strong>경찰청</strong>
                <br />
                <span className="text-xs">
                  (국번없이) 182 (ecrm.cyber.go.kr)
                </span>
              </li>
            </ul>
          </div>
        </Card>

        <Card as="section" id="privacy-article-11" hover={false} className="scroll-mt-24">
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제11조 개인정보 처리방침 변경
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p className="text-sm">
              본 개인정보처리방침은 관계 법령, 정부의 정책 변화 또는 서비스
              운영상 필요에 따라 사전 공지 후 변경될 수 있습니다.
            </p>
            <p className="text-sm">
              변경 사항은 본 페이지에 공시되며, 중대한 변경의 경우 사전 공지를
              통해 알려드립니다.
            </p>
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded mt-3">
              <p className="text-xs text-neutral-600">
                <strong>시행일</strong>: 2026년 3월 23일
                <br />
                <strong>최종 개정일</strong>: 2026년 10월 4일
              </p>
            </div>
          </div>
        </Card>
      </div>
    </Container>
  );
}
