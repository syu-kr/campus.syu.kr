"use client";

import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";

export default function GymPage() {
  const gym1f = [
    {
      name: "수영장",
      description: "성인풀 25m × 5레인, 유아풀",
      specs: "수심: 성인 1.2~1.5m, 유아 0.7m",
    },
    {
      name: "헬스장",
      description: "83평 규모",
      specs: "런닝머신 외 49종 기구, 체력측정실 운영",
    },
    {
      name: "골프연습장",
      description: "실내 골프 연습",
      specs: "일반타석 6대(좌타석 1대), 스크린타석 2대",
    },
    {
      name: "탁구장",
      description: "34평 규모",
      specs: "탁구대 5대 설치",
    },
    {
      name: "무도관",
      description: "64평 규모",
      specs: "필라테스, 한국무용, 어린이발레 강습",
    },
  ];

  const gym2f = [
    {
      name: "주경기장",
      description: "324평 규모",
      specs: "농구코트 1면, 배구코트 1면, 배드민턴코트 4면",
    },
    {
      name: "스쿼시장",
      description: "83평 규모",
      specs: "스쿼시 코트",
    },
  ];

  const compound = [
    {
      name: "인조잔디축구장",
      description: "실외 축구 경기",
      specs: "국제 규격 축구장",
    },
    {
      name: "농구장",
      description: "실외 농구 경기",
      specs: "표준 농구 코트",
    },
    {
      name: "배구장/족구장",
      description: "실외 네트 스포츠",
      specs: "배구 및 족구 경기용",
    },
    {
      name: "육상트랙",
      description: "실외 육상 시설",
      specs: "370m 트랙",
    },
  ];

  const contactInfo = [
    { title: "고객센터", phone: "02-3399-3711" },
    { title: "대관 문의", phone: "02-3399-3713" },
    { title: "등록 문의", phone: "02-3399-3715" },
  ];

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          체육시설
        </h1>
        <p className="text-neutral-600">건강한 신체에 건강한 정신이 깃듭니다</p>
      </div>

      <Card className="mb-6 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200">
        <h2 className="text-lg font-bold text-blue-900 mb-4">위치 및 연락처</h2>
        <div className="space-y-4">
          <div>
            <p className="font-semibold text-blue-900">위치</p>
            <p className="text-blue-800">삼육대학교 체육문화센터</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-blue-200">
            {contactInfo.map((info) => (
              <div key={info.title}>
                <p className="text-xs font-medium text-blue-700 mb-1">
                  {info.title}
                </p>
                <a
                  href={`tel:${info.phone.replace(/-/g, "")}`}
                  className="text-blue-600 hover:underline font-semibold"
                >
                  {info.phone}
                </a>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="mb-6 border border-amber-200 bg-amber-50" hover={false}>
        <p className="text-sm leading-6 text-amber-900">
          운영시간, 요금, 환불정책은 변경될 수 있습니다. 등록이나 대관 전에는
          체육문화센터 공식 안내 또는 전화로 최신 정보를 확인하세요.
        </p>
      </Card>

      <div className="mb-8">
        <h2 className="text-xl font-bold text-neutral-900 mb-4 border-b-2 border-primary-600 pb-2">
          체육관 1층
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gym1f.map((facility) => (
            <Card key={facility.name}>
              <div className="mb-3">
                <h3 className="text-lg font-bold text-neutral-900 mb-2">
                  {facility.name}
                </h3>
                <p className="text-sm text-neutral-600 mb-2">
                  {facility.description}
                </p>
                <p className="text-xs text-neutral-500">{facility.specs}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-bold text-neutral-900 mb-4 border-b-2 border-primary-600 pb-2">
          체육관 2층
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gym2f.map((facility) => (
            <Card key={facility.name}>
              <div className="mb-3">
                <h3 className="text-lg font-bold text-neutral-900 mb-2">
                  {facility.name}
                </h3>
                <p className="text-sm text-neutral-600 mb-2">
                  {facility.description}
                </p>
                <p className="text-xs text-neutral-500">{facility.specs}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-bold text-neutral-900 mb-4 border-b-2 border-primary-600 pb-2">
          종합운동장
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {compound.map((facility) => (
            <Card key={facility.name}>
              <div className="mb-3">
                <h3 className="text-lg font-bold text-neutral-900 mb-2">
                  {facility.name}
                </h3>
                <p className="text-sm text-neutral-600 mb-2">
                  {facility.description}
                </p>
                <p className="text-xs text-neutral-500">{facility.specs}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Card className="mb-6 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200">
        <h2 className="text-lg font-bold text-amber-900 mb-4">이용안내</h2>
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-semibold text-amber-900 mb-2">등록 안내</h3>
            <ul className="text-amber-800 space-y-1 ml-4 list-disc">
              <li>기존회원: 매월 20일부터 등록</li>
              <li>신규회원: 매월 25일부터 (선착순 마감)</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-amber-900 mb-2">등록시간</h3>
            <ul className="text-amber-800 space-y-1 ml-4 list-disc">
              <li>월~목: 06:30 ~ 07:30</li>
              <li>금: 06:30 ~ 11:50</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-amber-900 mb-2">환불정책</h3>
            <ul className="text-amber-800 space-y-1 ml-4 list-disc">
              <li>접수 후 개강 전: 10% 위약금 공제</li>
              <li>개강 후 환불: 위약금 + 강좌일수 공제</li>
              <li>환불 신청: 매월 15일까지</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-amber-900 mb-2">반 변경</h3>
            <ul className="text-amber-800 space-y-1 ml-4 list-disc">
              <li>동일 종목 내 시간대 변경만 가능</li>
              <li>신청: 매월 7일까지</li>
              <li>정원 허락 범위 내에서 가능</li>
            </ul>
          </div>
        </div>
      </Card>

      <Card className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
        <h2 className="text-lg font-bold text-green-900 mb-3">
          프로그램 및 자세한 정보
        </h2>
        <p className="text-green-800 text-sm mb-4">
          다양한 체육 프로그램과 상세한 이용 정보는 아래 버튼을 눌러 확인하세요.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="https://www.syu.ac.kr/sportscenter/program/program-guide/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
          >
            외부 사이트에서 프로그램 보기 →
          </a>
          <a
            href="https://www.syu.ac.kr/sportscenter/facilities/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
          >
            외부 사이트에서 시설 상세정보 →
          </a>
        </div>
      </Card>
    </Container>
  );
}
