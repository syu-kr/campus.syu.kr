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
  },
  {
    id: "cafeteria",
    title: "학식",
    description: "주간 식단 및 영양정보",
    icon: "utensils",
    href: "/campus/cafeteria",
  },
  {
    id: "bus-info",
    title: "버스 정보",
    description: "셔틀버스와 대중교통 안내",
    icon: "bus",
    href: "/campus/bus-info",
  },
  {
    id: "library",
    title: "도서관",
    description: "중앙도서관 열람실 정보",
    icon: "book-open",
    href: "/campus/library",
  },
  {
    id: "map",
    title: "캠퍼스 지도",
    description: "건물 위치 및 시설 안내",
    icon: "map",
    href: "/campus/map",
  },
  {
    id: "gym",
    title: "체육시설",
    description: "헬스장, 스포츠 센터 정보",
    icon: "dumbbell",
    href: "/campus/gym",
  },
  {
    id: "health-center",
    title: "보건소",
    description: "학생 의료 서비스",
    icon: "stethoscope",
    href: "/campus/health-center",
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
                hover={false}
                className="cursor-pointer border border-neutral-200 bg-white transition-colors hover:border-primary-300 hover:bg-primary-50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold mb-1 text-neutral-900">
                      {menu.title}
                    </h3>
                    <p className="text-sm text-neutral-600">
                      {menu.description}
                    </p>
                  </div>
                  <span className="text-primary-600">
                    <Icon
                      name={menu.icon}
                      size={28}
                      strokeWidth={1.75}
                      color="currentColor"
                      title={menu.title}
                    />
                  </span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </Container>
  );
}
