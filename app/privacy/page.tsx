import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import { Metadata } from "next";
import { LegalPageHeader } from "@/app/features/legal/LegalPageLayout";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "SYU CAMPUS 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <Container className="py-6 sm:py-8">
      <LegalPageHeader
        title="개인정보처리방침"
        description="SYU CAMPUS 서비스 개인정보처리방침입니다."
        noticeTitle="시행일"
        notice="본 개인정보처리방침은 2026년 3월 23일부터 적용됩니다."
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
                      검색 최적화 및 분석
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
                </tbody>
              </table>
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
            제6조 Google 분석도구
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
                위해 서버에 저장될 수 있습니다.
              </p>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">3. 접근 제한</p>
              <p className="text-sm text-neutral-600">
                개인정보 취급 직원을 최소화하고, 개인정보를 처리하는
                데이터베이스에 대한 접근 제한을 실시하고 있습니다.
              </p>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">4. 기술적 대책</p>
              <p className="text-sm text-neutral-600">
                보안프로그램을 설치하고 주기적인 갱신·점검을 하며, 외부로부터
                접근이 통제된 구역에 시스템을 설치하고 기술적/물리적으로 감시 및
                차단하고 있습니다.
              </p>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">5. 접속기록의 보관</p>
              <p className="text-sm text-neutral-600">
                개인정보처리시스템에 접속한 기록을 최소 1년 이상 보관하고
                있으며, 접속기록이 위변조 및 도난, 분실되지 않도록 보안기능을
                사용하고 있습니다.
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
              </p>
            </div>
          </div>
        </Card>
      </div>
    </Container>
  );
}
