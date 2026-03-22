import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";

export default function HealthCenterPage() {
  const services = [
    {
      title: "외상처치",
      description: "상처 및 외상 응급처치 제공",
      icon: "🩹",
    },
    {
      title: "의약품 제공",
      description: "일반의약품 제공 및 투약 교육",
      icon: "💊",
    },
    {
      title: "건강 측정",
      description: "혈압, 혈당, 체온 측정",
      icon: "🌡️",
    },
    {
      title: "신체 계측",
      description: "키, 몸무게 계측",
      icon: "📏",
    },
    {
      title: "안정실",
      description: "남녀 안정실 각 3침상",
      icon: "🛏️",
    },
    {
      title: "심장제세동기",
      description: "AED 비치 및 응급 대비",
      icon: "❤️",
    },
  ];

  const schedule = [
    { day: "월~목", time: "08:30 ~ 17:30" },
    { day: "금", time: "08:30 ~ 15:00" },
    { day: "점심시간", time: "12:00 ~ 13:00" },
    { day: "토, 일, 법정휴일", time: "휴무" },
  ];

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          건강증진센터
        </h1>
        <p className="text-neutral-600">
          건강한 대학생활을 위한 1차 건강관리를 지원합니다
        </p>
      </div>

      {/* 위치 및 연락처 */}
      <Card className="mb-6 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200">
        <h2 className="text-lg font-bold text-blue-900 mb-4">
          📍 위치 및 연락처
        </h2>
        <div className="space-y-4">
          <div>
            <p className="font-semibold text-blue-900">위치</p>
            <p className="text-blue-800">체육문화센터 1층 로비</p>
          </div>
          <div>
            <p className="font-semibold text-blue-900">담당자</p>
            <p className="text-blue-800">김연희 간호사</p>
          </div>
          <div>
            <p className="font-semibold text-blue-900">전화</p>
            <a
              href="tel:0233993182"
              className="text-blue-600 hover:underline font-semibold text-lg"
            >
              02-3399-3182
            </a>
          </div>
        </div>
      </Card>

      {/* 운영시간 */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-neutral-900 mb-4">🕐 운영시간</h2>
        <Card>
          <div className="space-y-3">
            {schedule.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="font-medium text-neutral-900">{item.day}</span>
                <span className="text-neutral-600">{item.time}</span>
              </div>
            ))}
            <div className="text-xs text-neutral-500 border-t pt-3 mt-3">
              ※ 방학 중 근무시간이 변동될 수 있습니다.
              <br />※ 방학 중에는 점심시간에 운영하지 않습니다.
            </div>
          </div>
        </Card>
      </div>

      {/* 제공 서비스 */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-neutral-900 mb-4">
          🏥 제공 서비스
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {services.map((service, idx) => (
            <Card
              key={idx}
              className="hover:shadow-card-hover transition-shadow"
            >
              <div className="text-center">
                <span className="text-3xl block mb-2">{service.icon}</span>
                <h3 className="font-semibold text-neutral-900 text-sm mb-1">
                  {service.title}
                </h3>
                <p className="text-xs text-neutral-600">
                  {service.description}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* 이용절차 */}
      <Card className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
        <h2 className="text-lg font-bold text-green-900 mb-4">📋 이용절차</h2>
        <div className="grid grid-cols-4 gap-4">
          {[
            { num: "01", title: "방문", desc: "보건실 방문" },
            { num: "02", title: "기록", desc: "방문기록지 작성" },
            { num: "03", title: "설명", desc: "증상 설명" },
            { num: "04", title: "처치", desc: "처치 및 의약품 제공" },
          ].map((step, idx) => (
            <div key={idx} className="text-center">
              <div className="bg-green-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold mx-auto mb-2 text-lg">
                {step.num}
              </div>
              <p className="font-semibold text-green-900 text-sm mb-1">
                {step.title}
              </p>
              <p className="text-xs text-green-800">{step.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* 주요 안내 */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-neutral-900 mb-4">
          💡 주요 안내
        </h2>
        <Card>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-neutral-900 mb-2">
                ▪️ 보건증 발급
              </h3>
              <p className="text-sm text-neutral-600">
                보건증은 시, 군, 구에서 운영하는 보건소에서 검사 후 발급받을 수
                있습니다.
                <br />
                <span className="text-xs text-neutral-500">
                  ※ 대학교 보건실에서는 발급되지 않습니다.
                </span>
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-2">
                ▪️ 안정실 운영
              </h3>
              <p className="text-sm text-neutral-600">
                남녀 안정실을 각각 3침상으로 운영합니다.
                <br />
                <span className="text-xs text-neutral-500">
                  ※ 방학 중이나 일요일 점심시간에는 운영하지 않습니다.
                </span>
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-2">
                ▪️ 구급약품낭 대여
              </h3>
              <p className="text-sm text-neutral-600">
                교직원행사나 학교주최행사에서 대여 가능합니다.
                <br />
                <span className="text-xs text-neutral-500">
                  대여료: 2만원 (반납 시 환급)
                </span>
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-2">
                ▪️ 심장자동제세동기(AED)
              </h3>
              <p className="text-sm text-neutral-600">
                보건실에 AED가 비치되어 있습니다. 누구든지 사용 가능합니다.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </Container>
  );
}
