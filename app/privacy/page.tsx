import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "SYU CAMPUS 개인정보처리방침",
};

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">
          개인정보처리방침
        </h1>
        <p className="text-neutral-600">
          SYU CAMPUS 개인정보처리방침입니다. 2025년 4월 1일 시행
        </p>
      </div>

      <div className="space-y-6 mb-8">
        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제1조 개인정보 수집 항목
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p className="font-semibold text-sm mb-2">
              학교는 다음의 개인정보를 수집합니다:
            </p>
            <ul className="space-y-2 text-sm text-neutral-600">
              <li className="flex gap-2">
                <span className="font-semibold text-neutral-900">
                  필수정보:
                </span>
                <span>학번, 성명, 소속 학과, 학년, 연락처(이메일, 휴대폰)</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-neutral-900">
                  선택정보:
                </span>
                <span>프로필 이미지, 관심 분야</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-neutral-900">
                  자동수집정보:
                </span>
                <span>
                  IP 주소, 쿠키, 접속 시간, 서비스 이용 기록, 디바이스 정보
                </span>
              </li>
            </ul>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제2조 개인정보의 수집 목적
          </h2>
          <p className="text-neutral-700 leading-relaxed mb-4">
            학교는 수집한 개인정보를 다음의 목적으로 이용합니다:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-neutral-600 ml-2">
            <li>서비스 제공 및 계약 이행</li>
            <li>이용자 식별 및 본인 확인</li>
            <li>학사평가 및 학적 관리</li>
            <li>장학금 추천 및 맞춤형 정보 제공</li>
            <li>서비스 개선 및 신규 서비스 개발</li>
            <li>법령에서 요구하는 개인정보 보관 및 관리</li>
            <li>마케팅, 서비스 소개 및 이벤트 공지 (동의 후)</li>
          </ul>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제3조 개인정보의 보유 및 이용 기간
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p>
              <span className="font-semibold">1. 기본 원칙</span>
              <br />
              <span className="text-sm text-neutral-600 block mt-1">
                개인정보는 수집 목적이 달성되면 즉시 파기합니다. 단, 관련 법령에
                의해 보관이 필요한 경우는 해당 기간 동안 보관합니다.
              </span>
            </p>
            <p>
              <span className="font-semibold">2. 보유 기간</span>
            </p>
            <div className="text-sm text-neutral-600 space-y-1 ml-2">
              <p>• 재학생 정보: 재학 중 보유, 졸업 후 15년</p>
              <p>• 회원 가입 정보: 가입 후 5년</p>
              <p>• 비정상 이용 기록: 발생 후 1년</p>
              <p>• 쿠키: 사용자 동의에 따라 최대 1년</p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제4조 개인정보의 제3자 제공
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p>
              학교는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다.
              다만, 다음의 경우는 예외입니다:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-600 ml-2">
              <li>법령의 규정에 의한 경우</li>
              <li>이용자의 명시적 동의가 있는 경우</li>
              <li>공공기관의 요청이 있는 경우</li>
              <li>협력 업체의 업무 수행을 위해 필요한 경우</li>
            </ul>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제5조 개인정보의 안전성 확보
          </h2>
          <p className="text-neutral-700 mb-4">
            학교는 개인정보 보호를 위해 다음과 같은 기술적, 관리적 조치를
            취합니다:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-neutral-600 ml-2">
            <li>데이터 암호화 및 보안 프로토콜 적용</li>
            <li>정기적인 보안 감사 및 취약점 진단</li>
            <li>접근 권한 제한 및 관리</li>
            <li>개인정보 취급자 교육 및 감독</li>
            <li>보안 솔루션 도입 및 운영</li>
            <li>HTTPS 등 전송 구간 암호화</li>
          </ul>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제6조 개인정보 주체의 권리
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p className="text-sm mb-2">
              이용자는 다음의 권리를 행사할 수 있습니다:
            </p>
            <ul className="space-y-2 text-sm text-neutral-600">
              <li>
                <span className="font-semibold text-neutral-900">
                  조회 및 열람
                </span>
                : 자신의 개인정보 조회 및 열람 요청
              </li>
              <li>
                <span className="font-semibold text-neutral-900">정정:</span>{" "}
                부정확한 개인정보의 정정 요청
              </li>
              <li>
                <span className="font-semibold text-neutral-900">
                  삭제 또는 파기
                </span>
                : 개인정보 삭제 또는 파기 요청
              </li>
              <li>
                <span className="font-semibold text-neutral-900">
                  처리 정지
                </span>
                : 개인정보 처리 정지 요청
              </li>
              <li>
                <span className="font-semibold text-neutral-900">
                  이의 제기
                </span>
                : 부당한 처리에 대한 이의 제기
              </li>
            </ul>
            <p className="text-xs text-neutral-500 mt-3">
              요청은 support_team@syu.kr 로 연락 바랍니다.
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제7조 쿠키 및 추적 기술
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p>
              <span className="font-semibold">1. 쿠키의 사용</span>
              <br />
              <span className="text-sm text-neutral-600 block mt-1">
                학교는 서비스 제공 및 개선을 위해 쿠키를 사용합니다. 이용자는
                브라우저 설정을 통해 쿠키 사용을 거부할 수 있습니다.
              </span>
            </p>
            <p>
              <span className="font-semibold">2. 추적 거부</span>
              <br />
              <span className="text-sm text-neutral-600 block mt-1">
                학교는 이용자의 추적 거부(Do Not Track) 요청을 존중합니다.
              </span>
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제8조 아동의 개인정보 보호
          </h2>
          <p className="text-neutral-700 text-sm">
            학교는 만 14세 미만의 아동으로부터 개인정보를 수집하지 않습니다.
            부모 또는 법정대리인은 자녀의 개인정보가 부정당하게 수집되었다고
            판단되는 경우 학교에 통지할 수 있습니다.
          </p>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제9조 개인정보 침해 대응
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p>
              <span className="font-semibold">1. 사고 발생 시 조치</span>
              <br />
              <span className="text-sm text-neutral-600 block mt-1">
                학교는 개인정보 침해 사고 발생 시 이용자에게 즉시 통지하고
                필요한 조치를 취합니다.
              </span>
            </p>
            <p>
              <span className="font-semibold">2. 피해 보상</span>
              <br />
              <span className="text-sm text-neutral-600 block mt-1">
                개인정보 침해로 인한 손해배상은 관련 법령에 따릅니다.
              </span>
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제10조 개인정보 담당자
          </h2>
          <div className="space-y-2 text-neutral-700 text-sm">
            <p>
              <span className="font-semibold">개인정보 보호책임자</span>
              <br />
              <span className="text-neutral-600 ml-4 block">
                직책: 정보관리팀장
                <br />
                연락처: 02-3708-8000
              </span>
            </p>
            <p>
              <span className="font-semibold">개인정보 처리 담당</span>
              <br />
              <span className="text-neutral-600 ml-4 block">
                이메일: support_team@syu.kr
                <br />
                전화: 02-3708-2000
              </span>
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제11조 방침의 변경
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p>
              <span className="font-semibold">1.</span> 이 방침은 필요시 변경될
              수 있습니다.
            </p>
            <p>
              <span className="font-semibold">2.</span> 중요한 변경사항이 있을
              경우 최소 7일 전에 공지합니다.
            </p>
            <p>
              <span className="font-semibold">3.</span> 변경된 내용에 동의하지
              않는 이용자는 서비스 이용을 중단할 수 있습니다.
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제12조 준거법 및 관할
          </h2>
          <div className="space-y-3 text-neutral-700">
            <p>
              <span className="font-semibold">1.</span> 이 방침은 대한민국의
              개인정보보호법을 따릅니다.
            </p>
            <p>
              <span className="font-semibold">2.</span> 개인정보 침해로 인한
              분쟁은 서울의 일반법원에 제소할 수 있습니다.
            </p>
            <p>
              <span className="font-semibold">3.</span> 기타 문의는
              support_team@syu.kr 로 연락 바랍니다.
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            제13조 외부 링크 및 제3자 정보
          </h2>
          <p className="text-neutral-700 text-sm">
            서비스에 포함된 외부 링크나 제3자 콘텐츠에 대해서는 학교가 책임지지
            않습니다. 링크 이용 시 해당 웹사이트의 개인정보처리방침을 확인하시기
            바랍니다.
          </p>
        </Card>

        <div className="text-center text-sm text-neutral-600 mt-8 pt-6 border-t border-neutral-200">
          <p>개인정보처리방침 시행일: 2025년 4월 1일</p>
          <p>최종 수정일: 2025년 4월 1일</p>
        </div>
      </div>
    </Container>
  );
}
