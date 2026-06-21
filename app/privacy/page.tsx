import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
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
import { headers } from "next/headers";

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
        notice="This English version is provided for convenience. If it differs from the Korean Privacy Policy, the Korean version applies. Effective March 23, 2026. Last updated June 21, 2026."
      />

      <div className="space-y-6 mb-8">
        <LegalSection title="1. Purposes of Processing">
          <div className="space-y-3 text-neutral-700">
            <p className="text-sm">
              SYU CAMPUS processes personal information only as needed to
              operate and improve the service.
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-1">
              <li>Providing and operating service features</li>
              <li>Analyzing service usage and improving quality</li>
              <li>Reviewing contact requests, reports, and suggestions</li>
              <li>Creating schedule coordination links and collecting responses</li>
              <li>Creating timetable share links selected by users</li>
              <li>Sending service push notifications when users opt in</li>
              <li>
                Supporting internal admin triage with AI-assisted classification
                when configured
              </li>
            </ul>
          </div>
        </LegalSection>

        <LegalSection title="2. Retention">
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
              <li>
                Rate-limit counters are retained for the configured request
                window, and notification send locks may be retained for up to 14
                days to prevent duplicate sends.
              </li>
            </ul>
            <p className="text-sm text-neutral-600">
              Third-party data such as Kakao Maps cookies and Google service data
              follows each provider&apos;s policies.
            </p>
          </div>
        </LegalSection>

        <LegalSection title="3. Categories of Information">
          <div className="space-y-3 text-neutral-700">
            <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-1">
              <li>Local settings such as theme preference</li>
              <li>Service logs, access records, IP address, and user agent</li>
              <li>Kakao Maps SDK cookies used for map and shuttle features</li>
              <li>Contact, report, campus-tip, and optional contact details entered by users</li>
              <li>Schedule room titles, descriptions, candidate times, participant nicknames, and availability responses</li>
              <li>Schedule response edit-token hashes used to protect edits</li>
              <li>Timetable share course IDs, year, semester, and user agent</li>
              <li>Firebase Cloud Messaging tokens and notification delivery records when notifications are enabled</li>
              <li>Rate-limit counters and notification duplicate-send locks</li>
              <li>
                Admin-only AI classification metadata for contact requests or
                suggestions, when generated
              </li>
            </ul>
          </div>
        </LegalSection>

        <LegalSection title="4. Processors and Third-Party Services">
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
                    Analytics, Search Console, Firebase, Firestore, and push
                    notifications
                  </td>
                  <td className="border border-gray-300 p-2">
                    According to Google policies
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
                  <td className="border border-gray-300 p-2">GitHub</td>
                  <td className="border border-gray-300 p-2">
                    Source repository and change history management
                  </td>
                  <td className="border border-gray-300 p-2">
                    According to GitHub policies and repository operation
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-3 text-sm text-neutral-700">
            <p className="font-semibold">Third-party provision</p>
            <p>
              The service does not provide personal information to third parties
              except where the user has consented, where required by law, or
              where processing is necessary through the processors listed above.
            </p>
            <p className="font-semibold">Overseas or external processing</p>
            <p>
              Google, Vercel, GitHub, Kakao, and a configured AI classification
              API may process data on servers located outside Korea or in regions
              operated under each provider&apos;s policy. The categories of data
              are limited to the minimum needed for hosting, analytics,
              Firebase/Firestore storage, map features, notification delivery,
              repository operation, and redacted admin triage.
            </p>
          </div>
        </LegalSection>

        <LegalSection title="5. Cookies, Analytics, Firebase, and AI Classification">
          <div className="space-y-3 text-neutral-700">
            <p className="text-sm">
              The service primarily uses local storage for user settings. Kakao
              Maps SDK may set cookies for map and shuttle features. Google
              Analytics, Search Console, Firebase, and Firestore may be used for
              analytics, search visibility, user reports, schedule coordination,
              and notification delivery.
            </p>
            <p className="text-sm text-neutral-600">
              Blocking third-party cookies may limit map or shuttle-related
              features.
            </p>
            <p className="text-sm text-neutral-600">
              When the admin classification feature is enabled, selected contact
              request or suggestion content may be sent to a configured AI
              classification API after contact details and obvious identifiers
              are redacted where possible. The result is stored only as
              admin-facing triage metadata.
            </p>
          </div>
        </LegalSection>

        <LegalSection title="6. Security Measures">
          <div className="space-y-3 text-neutral-700">
            <p className="text-sm">
              The service uses HTTPS, client-side storage where appropriate,
              Firebase security controls, environment variable management, and
              administrator authentication to protect service data within the
              scope of its operation.
            </p>
          </div>
        </LegalSection>

        <LegalSection title="7. User Rights and Contact">
          <div className="space-y-3 text-neutral-700">
            <p className="text-sm">
              Users may request access, correction, deletion, or suspension of
              processing by contacting the service operator through the contact
              page or email.
            </p>
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <p className="font-semibold text-sm mb-2">Privacy Contact</p>
              <p className="text-sm text-neutral-600">Team: Development Team</p>
              <p className="text-sm text-neutral-600">Owner: Sanghyeok Seo</p>
              <p className="text-sm text-neutral-600">
                Email: singhic_dev@syu.kr
              </p>
            </div>
          </div>
        </LegalSection>

        <LegalSection title="8. Remedies and Changes">
          <div className="space-y-3 text-neutral-700">
            <p className="text-sm">
              Users may contact Korean privacy dispute or reporting agencies for
              remedies where applicable. This policy may change due to legal,
              governmental, or service operation needs, and important changes
              will be announced in advance.
            </p>
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded">
              <p className="text-xs text-neutral-600">
                <strong>Effective date</strong>: March 23, 2026
                <br />
                <strong>Last updated</strong>: June 21, 2026
              </p>
            </div>
          </div>
        </LegalSection>
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
        notice="본 개인정보처리방침은 2026년 3월 23일부터 시행되었으며, 2026년 6월 21일 최종 개정되었습니다."
      />

      <div className="space-y-6 mb-8">
        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제1조 개인정보의 처리 목적
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p className="text-sm">
              SYU CAMPUS(이하 &quot;서비스&quot;)는 「개인정보 보호법」 제30조에
              따라 정보주체의 개인정보를 보호하며, 다음의 목적을 위하여
              개인정보를 처리합니다.
            </p>
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <p className="font-semibold text-sm mb-2">처리 목적</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-1">
                <li>서비스 제공 및 운영</li>
                <li>서비스 이용현황 통계분석 및 활용</li>
                <li>서비스 품질 개선 및 신규 기능 개발</li>
                <li>고객 문의 및 불만사항 처리</li>
                <li>사용자 제보 및 문의 내용 검토와 서비스 개선 반영</li>
                <li>일정 잡기 초대 링크 생성 및 참여자 가능 시간 취합</li>
                <li>사용자가 선택한 시간표 공유 링크 생성 및 조회</li>
                <li>사용자가 허용한 경우 서비스 공지 푸시 알림 발송</li>
                <li>운영자 문의·제보 검토를 위한 AI 분류 보조</li>
              </ul>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제2조 개인정보의 처리 및 보유 기간
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p className="text-sm mb-3">
              본 서비스는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터
              개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서
              개인정보를 처리·보유합니다.
            </p>
            <div className="space-y-2">
              <div>
                <p className="font-semibold text-sm mb-1">1. 로컬 스토리지</p>
                <p className="text-sm text-neutral-600">
                  사용자 기기에만 저장되며, 브라우저 데이터 삭제 시 함께
                  삭제됩니다.
                </p>
              </div>
              <div>
                <p className="font-semibold text-sm mb-1">2. Kakao Maps 쿠키</p>
                <p className="text-sm text-neutral-600">
                  Kakao의 정책에 따라 관리됩니다.
                </p>
              </div>
              <div>
                <p className="font-semibold text-sm mb-1">
                  3. 서비스 이용 로그
                </p>
                <p className="text-sm text-neutral-600">
                  서비스 운영 및 통계 분석 목적으로 필요한 기간 동안 보존됩니다.
                </p>
              </div>
              <div>
                <p className="font-semibold text-sm mb-1">
                  4. 문의 및 제보 정보
                </p>
                <p className="text-sm text-neutral-600">
                  서비스 개선 검토 목적 달성 시까지 보존하며, 운영상 필요가
                  없어진 경우 삭제합니다.
                </p>
              </div>
              <div>
                <p className="font-semibold text-sm mb-1">
                  5. 일정 잡기 정보
                </p>
                <p className="text-sm text-neutral-600">
                  일정 방 생성 시점부터 90일까지 보존하며, 만료된 일정 방과
                  참여자 응답은 정리될 수 있습니다.
                </p>
              </div>
              <div>
                <p className="font-semibold text-sm mb-1">
                  6. 푸시 알림 토큰
                </p>
                <p className="text-sm text-neutral-600">
                  알림 발송 목적 달성 시까지 보존하며, 사용자가 알림을 차단하거나
                  토큰이 유효하지 않은 경우 삭제될 수 있습니다.
                </p>
              </div>
              <div>
                <p className="font-semibold text-sm mb-1">
                  7. 시간표 공유 정보
                </p>
                <p className="text-sm text-neutral-600">
                  공유 링크 생성 시점부터 90일까지 보존하며, 만료된 공유 링크는
                  조회되지 않고 정리될 수 있습니다.
                </p>
              </div>
              <div>
                <p className="font-semibold text-sm mb-1">
                  8. 요청 제한 및 알림 중복 방지 기록
                </p>
                <p className="text-sm text-neutral-600">
                  요청 제한 카운터는 해당 요청 제한 구간이 끝날 때까지, 알림
                  중복 발송 방지 기록은 생성 시점부터 최대 14일까지 보존될 수
                  있습니다.
                </p>
              </div>
              <div>
                <p className="font-semibold text-sm mb-1">
                  9. AI 분류 결과
                </p>
                <p className="text-sm text-neutral-600">
                  문의 및 제보 항목의 운영자 검토 목적 달성 시까지 원 접수
                  항목과 함께 보존되며, 운영상 필요가 없어진 경우 삭제합니다.
                </p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-neutral-50 border border-neutral-200 rounded">
              <p className="font-semibold text-sm mb-2">파기 절차 및 방법</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-1">
                <li>
                  서버에 저장된 정보는 보유 목적이 달성되거나 만료 시 Firestore
                  TTL 또는 예약 정리 작업을 통해 삭제합니다.
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

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제3조 처리하는 개인정보의 항목
          </h2>
          <div className="space-y-4 text-neutral-700">
            <div>
              <p className="font-semibold text-sm mb-2">1. 수집 방법</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-1">
                <li>서비스 이용 과정에서 사용자가 직접 입력한 정보</li>
                <li>서비스 이용 과정에서 자동으로 수집되는 정보</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">
                2. 로컬 스토리지 저장 정보 (선택항목)
              </p>
              <p className="text-sm text-neutral-600 mb-2">
                사용자 기기에만 저장되며 서버에 전송되지 않습니다:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-2">
                <li>테마 설정 (다크 모드/라이트 모드)</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">
                3. 자동 생성/수집 정보 (필수항목)
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-2">
                <li>서비스 이용 기록 (앱 사용 이력, 접속 기록)</li>
                <li>접속 IP 주소</li>
                <li>쿠키 (Kakao Maps SDK)</li>
                <li>접속 로그</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">
                4. 문의 및 제보 입력 정보 (선택항목)
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-2">
                <li>문의/제보 제목 및 내용</li>
                <li>관련 페이지 URL 또는 관련 링크</li>
                <li>사용자가 선택적으로 입력한 연락처</li>
                <li>접수 시점의 브라우저 정보(User-Agent)</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">
                5. 일정 잡기 입력 정보 (선택항목)
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-2">
                <li>일정 방 제목 및 설명</li>
                <li>후보 날짜와 시간대</li>
                <li>참여자 닉네임</li>
                <li>참여자가 선택한 가능 시간</li>
                <li>응답 수정을 위한 편집 토큰 해시</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">
                6. 푸시 알림 정보 (선택항목)
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-2">
                <li>Firebase Cloud Messaging 알림 토큰</li>
                <li>알림 구독 시점과 토큰 갱신 시점</li>
                <li>알림 발송 결과 및 실패 기록</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">
                7. 시간표 공유 정보 (선택항목)
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-2">
                <li>공유 링크에 포함된 강의 식별자 목록</li>
                <li>학년도 및 학기 정보</li>
                <li>공유 링크 생성 시점의 브라우저 정보(User-Agent)</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">
                8. 서비스 운영 및 보안 정보
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 ml-2">
                <li>요청 제한 카운터와 만료 시각</li>
                <li>알림 중복 발송 방지 잠금 및 발송 기록</li>
                <li>운영자 검토를 위한 AI 분류 결과와 생성 시점</li>
              </ul>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제4조 개인정보처리의 위탁에 관한 사항
          </h2>
          <div className="space-y-3 text-neutral-700">
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
                      검색 최적화, 분석, Firebase 기반 데이터 저장 및 푸시 알림
                    </td>
                    <td className="border border-gray-300 p-2">
                      Google의 정책에 따름
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
                    <td className="border border-gray-300 p-2">GitHub</td>
                    <td className="border border-gray-300 p-2">
                      소스코드 저장소 제공 및 변경 이력 관리
                    </td>
                    <td className="border border-gray-300 p-2">
                      GitHub의 정책 및 저장소 운영 기간에 따름
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 space-y-3">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="font-semibold text-sm text-blue-900 mb-2">
                  개인정보 제3자 제공
                </p>
                <p className="text-sm text-blue-900">
                  본 서비스는 이용자의 개인정보를 제3자에게 제공하지 않습니다.
                  다만, 이용자가 사전에 동의한 경우, 법령에 특별한 규정이 있는
                  경우, 또는 본 조의 수탁업체를 통한 업무처리에 필요한 경우에는
                  해당 범위 안에서 처리될 수 있습니다.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 p-2 text-left">
                        업체
                      </th>
                      <th className="border border-gray-300 p-2 text-left">
                        국외 처리 가능 항목
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
                        분석 이벤트, Firebase/Firestore 저장 정보, FCM 토큰 및
                        발송 기록
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
                      <td className="border border-gray-300 p-2">GitHub</td>
                      <td className="border border-gray-300 p-2">
                        저장소 이슈, 배포 자동화 로그, 운영자가 직접 등록한 변경
                        이력
                      </td>
                      <td className="border border-gray-300 p-2">
                        소스코드 및 운영 이력 관리
                      </td>
                      <td className="border border-gray-300 p-2">
                        GitHub 정책 및 저장소 운영 기간에 따름
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
                위 업체는 각 사업자가 운영하는 국가 또는 리전의 서버에서 정보를
                처리할 수 있습니다.
              </p>
            </div>
          </div>
        </Card>

        <Card>
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
                Maps 사용 시 Kakao에서 다음의 쿠키를 설정합니다:
              </p>

              <p className="font-semibold text-sm mb-3">Kakao Maps SDK 쿠키</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="font-mono text-xs text-gray-600 font-semibold mb-1">
                    __T_SECURE
                  </p>
                  <p className="text-xs text-gray-700">보안 추적</p>
                </div>
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="font-mono text-xs text-gray-600 font-semibold mb-1">
                    TUID
                  </p>
                  <p className="text-xs text-gray-700">고유 사용자 ID</p>
                </div>
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="font-mono text-xs text-gray-600 font-semibold mb-1">
                    UUID
                  </p>
                  <p className="text-xs text-gray-700">범용 고유 식별자</p>
                </div>
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="font-mono text-xs text-gray-600 font-semibold mb-1">
                    aid
                  </p>
                  <p className="text-xs text-gray-700">광고 ID</p>
                </div>
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="font-mono text-xs text-gray-600 font-semibold mb-1">
                    DSPR
                  </p>
                  <p className="text-xs text-gray-700">기기 설정 저장</p>
                </div>
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="font-mono text-xs text-gray-600 font-semibold mb-1">
                    webid
                  </p>
                  <p className="text-xs text-gray-700">웹 로그인 ID</p>
                </div>
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="font-mono text-xs text-gray-600 font-semibold mb-1">
                    webid_ts
                  </p>
                  <p className="text-xs text-gray-700">웹 ID 타임스탬프</p>
                </div>
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="font-mono text-xs text-gray-600 font-semibold mb-1">
                    _kau
                  </p>
                  <p className="text-xs text-gray-700">사용자 활동 추적</p>
                </div>
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="font-mono text-xs text-gray-600 font-semibold mb-1">
                    _T_ANO
                  </p>
                  <p className="text-xs text-gray-700">익명 사용자 추적</p>
                </div>
              </div>

              <div className="space-y-2 text-sm mb-4 p-3 bg-gray-50 rounded border border-gray-200">
                <p>
                  <span className="font-semibold">쿠키 저장소:</span>
                  <span className="text-neutral-600"> dapi.kakao.com</span>
                </p>
                <p>
                  <span className="font-semibold">목적:</span>
                  <span className="text-neutral-600">
                    지도 기능 제공, 서비스 분석, 사용자 경험 개선
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
                  <li>특정 사이트의 쿠키만 차단 (dapi.kakao.com 등)</li>
                </ul>
                <p className="text-sm text-amber-800 mt-2">
                  다만, Kakao Maps 쿠키를 거부 시 캠퍼스 지도 및 셔틀버스 기능이
                  제한될 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제6조 Google 분석도구 및 외부 처리 도구
          </h2>
          <div className="space-y-4 text-neutral-700">
            <div>
              <p className="font-semibold text-sm mb-2">
                1. Google Analytics 4 (GA4)
              </p>
              <p className="text-sm text-neutral-600 mb-2">
                본 서비스는 사용자 행동 분석 및 서비스 통계를 위해 Google
                Analytics 4를 사용합니다.
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
              <p className="font-semibold text-sm mb-2">
                2. Google Search Console
              </p>
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
              <p className="font-semibold text-sm mb-2">
                3. Firebase 및 Firestore
              </p>
              <p className="text-sm text-neutral-600 mb-2">
                본 서비스는 문의, 꿀팁 제보, 일정 잡기, 푸시 알림 토큰 관리를
                위해 Google Firebase와 Firestore를 사용합니다.
              </p>
              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <p className="text-sm">
                  <span className="font-semibold">처리 정보:</span>
                  <span className="text-neutral-600">
                    {" "}
                    사용자가 직접 입력한 문의·제보·일정 정보, 브라우저 정보,
                    알림 토큰
                  </span>
                </p>
                <p className="text-sm mt-1">
                  <span className="font-semibold">목적:</span>
                  <span className="text-neutral-600">
                    {" "}
                    서비스 운영, 사용자 제보 검토, 일정 조율, 푸시 알림 발송
                  </span>
                </p>
              </div>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">
                4. 운영자 AI 분류 보조
              </p>
              <p className="text-sm text-neutral-600 mb-2">
                운영자가 문의 및 제보를 빠르게 검토할 수 있도록, 설정된 경우 AI
                분류 API를 이용해 접수 항목의 카테고리, 긴급도, 처리 힌트를
                생성할 수 있습니다.
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

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제7조 개인정보의 안전성 확보 조치
          </h2>
          <div className="space-y-3 text-neutral-700">
            <div>
              <p className="font-semibold text-sm mb-2">1. 암호화</p>
              <p className="text-sm text-neutral-600">
                HTTPS 암호화 연결을 통해 데이터 전송 중 보호합니다.
              </p>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">
                2. 클라이언트 중심 저장
              </p>
              <p className="text-sm text-neutral-600">
                설정 정보는 사용자 기기의 로컬 스토리지에 저장되며, 문의 및
                제보 과정에서 사용자가 직접 입력한 정보는 서비스 개선 검토를
                위해 서버에 저장될 수 있습니다. 일정 잡기와 푸시 알림 기능에
                필요한 정보도 사용자가 기능을 이용하거나 권한을 허용한 경우에만
                저장됩니다.
              </p>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">3. 접근 제한</p>
              <p className="text-sm text-neutral-600">
                관리자 기능은 Firebase Authentication과 허용된 관리자 계정을
                통해 접근을 제한하며, 개인정보가 저장된 데이터베이스는 필요한
                서버 API에서만 접근하도록 관리합니다.
              </p>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">4. 기술적 대책</p>
              <p className="text-sm text-neutral-600">
                HTTPS, Firebase 보안 설정, 서버 환경변수 관리, 관리자 인증 등
                서비스 규모에 맞는 기술적 보호조치를 적용합니다.
              </p>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">5. 접속기록 관리</p>
              <p className="text-sm text-neutral-600">
                서비스 운영과 보안 확인에 필요한 범위에서 접속 기록과 처리
                기록을 관리하며, 불필요한 정보는 운영상 필요가 없어진 경우
                정리할 수 있습니다.
              </p>
            </div>
          </div>
        </Card>

        <Card>
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
          </div>
        </Card>

        <Card>
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
              <p className="font-semibold text-sm mb-2">개인정보 보호책임자</p>
              <p className="text-sm text-neutral-600">담당부서: 개발팀</p>
              <p className="text-sm text-neutral-600">담당자: 서상혁</p>
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

        <Card>
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

        <Card>
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
                <strong>최종 개정일</strong>: 2026년 6월 21일
              </p>
            </div>
          </div>
        </Card>
      </div>
    </Container>
  );
}
