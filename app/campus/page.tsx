import { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";

export const metadata: Metadata = {
  title: "캠퍼스",
  description: "학식, 셔틀버스, 시설 정보 등",
};

const campusMenus = [
  {
    id: "cafeteria",
    title: "학식",
    description: "주간 식단 및 영양정보",
    icon: "🍽️",
    href: "/campus/cafeteria",
    color: "from-orange-400 to-orange-600",
  },
  {
    id: "shuttle",
    title: "셔틀버스",
    description: "셔틀버스 운행 시간표",
    icon: "🚌",
    href: "/campus/shuttle",
    color: "from-blue-400 to-blue-600",
  },
  {
    id: "facilities",
    title: "편의시설",
    description: "ATM, 편의점, 카페 위치",
    icon: "🏪",
    href: "/campus/facilities",
    color: "from-green-400 to-green-600",
  },
  {
    id: "gym",
    title: "체육시설",
    description: "헬스장, 스포츠 센터 정보",
    icon: "🏋️",
    href: "/campus/gym",
    color: "from-red-400 to-red-600",
  },
  {
    id: "library",
    title: "도서관",
    description: "중앙도서관 열람실 정보",
    icon: "📚",
    href: "/campus/library",
    color: "from-purple-400 to-purple-600",
  },
  {
    id: "health-center",
    title: "보건소",
    description: "학생 의료 서비스",
    icon: "⚕️",
    href: "/campus/health-center",
    color: "from-pink-400 to-pink-600",
  },
];

export default function CampusPage() {
  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          캠퍼스 정보
        </h1>
        <p className="text-neutral-600">
          캠퍼스 생활에 필요한 정보를 확인하세요
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {campusMenus.map((menu) => (
          <Link key={menu.id} href={menu.href}>
            <Card
              className={`bg-gradient-to-br ${menu.color} text-white cursor-pointer hover:shadow-card-hover transition-all transform hover:scale-105`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold mb-1">{menu.title}</h3>
                  <p className="text-sm opacity-90">{menu.description}</p>
                </div>
                <span className="text-4xl">{menu.icon}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </Container>
  );
}
