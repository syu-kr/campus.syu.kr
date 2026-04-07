import { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { Icon } from "@/app/components/Icon";

export const metadata: Metadata = {
  title: "캠퍼스 정보 | SYU CAMPUS",
  description:
    "삼육대학교 캠퍼스 정보 센터. 학식, 동아리, 식당, 도서관, 체육관, 보건센터, 셔틀버스 및 실내 스포츠 시설 정보를 한 방에 다른 정보를 제공합니다.",
  keywords: "캠퍼스,동아리,식당,도서관,셔틀버스,캠퍼스 지도",
  openGraph: {
    title: "캠퍼스 정보 | SYU CAMPUS",
    description: "캠퍼스 내 모든 정보를 한눈에 확인할 수 있는 캠퍼스 정보",
    type: "website",
    url: "https://campus.syu.kr/campus",
  },
};

const campusMenus = [
  {
    id: "announcements",
    title: "캠퍼스공지",
    description: "캠퍼스 생활 공지사항",
    icon: "megaphone",
    href: "/campus/announcements",
    color: "from-indigo-400 to-indigo-600",
  },
  {
    id: "cafeteria",
    title: "학식",
    description: "주간 식단 및 영양정보",
    icon: "utensils",
    href: "/campus/cafeteria",
    color: "from-orange-400 to-orange-600",
  },
  {
    id: "bus-info",
    title: "버스 정보",
    description: "셔틀버스와 대중교통 안내",
    icon: "bus",
    href: "/campus/bus-info",
    color: "from-blue-400 to-blue-600",
  },
  {
    id: "library",
    title: "도서관",
    description: "중앙도서관 열람실 정보",
    icon: "book-open",
    href: "/campus/library",
    color: "from-purple-400 to-purple-600",
  },
  {
    id: "map",
    title: "캠퍼스 지도",
    description: "건물 위치 및 시설 안내",
    icon: "map",
    href: "/campus/map",
    color: "from-cyan-400 to-blue-600",
  },
  {
    id: "gym",
    title: "체육시설",
    description: "헬스장, 스포츠 센터 정보",
    icon: "dumbbell",
    href: "/campus/gym",
    color: "from-red-400 to-red-600",
  },
  {
    id: "health-center",
    title: "보건소",
    description: "학생 의료 서비스",
    icon: "stethoscope",
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
        {campusMenus.map((menu) => {
          return (
            <Link key={menu.id} href={menu.href}>
              <Card
                className={`bg-gradient-to-br ${menu.color} text-white cursor-pointer hover:shadow-card-hover transition-all transform hover:scale-105`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold mb-1">{menu.title}</h3>
                    <p className="text-sm opacity-90">{menu.description}</p>
                  </div>
                  <Icon
                    name={menu.icon}
                    size={40}
                    strokeWidth={1.5}
                    color="white"
                    title={menu.title}
                  />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* 관련 정보 */}
      <div className="mt-8 pt-6 border-t border-neutral-200">
        <h3 className="text-base font-semibold text-neutral-900 mb-4">
          도움이 될 만한 정보
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/academic/schedule"
            className="p-4 rounded-lg bg-blue-50 border border-blue-200 hover:border-blue-500 transition-colors"
          >
            <p className="text-sm font-medium text-neutral-900">📅 학사일정</p>
            <p className="text-xs text-neutral-600 mt-1">
              캠퍼스 행사와 학사 일정 확인
            </p>
          </Link>
          <Link
            href="/more/phone"
            className="p-4 rounded-lg bg-green-50 border border-green-200 hover:border-green-500 transition-colors"
          >
            <p className="text-sm font-medium text-neutral-900">
              📞 시설 관련 문의
            </p>
            <p className="text-xs text-neutral-600 mt-1">
              건물 관리 및 지원 부서 연락처
            </p>
          </Link>
        </div>
      </div>
    </Container>
  );
}
