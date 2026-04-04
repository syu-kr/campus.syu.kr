import { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { Icon } from "@/app/components/Icon";

export const metadata: Metadata = {
  title: "학사",
  description: "학사일정, 공지사항, 학점조회 등 학사 정보",
};

const academicMenus = [
  {
    id: "announcements",
    title: "학사공지",
    description: "학사 관련 공지사항",
    icon: "megaphone",
    href: "/academic/announcements",
    isExternal: false,
    color: "from-blue-400 to-blue-600",
  },
  {
    id: "schedule",
    title: "학사일정",
    description: "수강신청, 시험, 휴무 일정",
    icon: "calendar",
    href: "/academic/schedule",
    isExternal: false,
    color: "from-purple-400 to-purple-600",
  },
  {
    id: "graduation-check",
    title: "졸업요건 확인",
    description: "내 상황에 맞는 졸업요건 체크",
    icon: "check-circle",
    href: "/academic/graduation",
    isExternal: false,
    color: "from-cyan-400 to-cyan-600",
  },
  {
    id: "timetable",
    title: "시간표 짜기",
    description: "학기 시간표 작성 마법사",
    icon: "clock",
    href: "https://lecture.syu.kr/timetable",
    isExternal: true,
    color: "from-pink-400 to-pink-600",
  },
  {
    id: "mock-sugang",
    title: "모의 수강신청",
    description: "수강신청 미리 연습하기",
    icon: "book-open",
    href: "https://sugang.syu.kr/testLogin",
    isExternal: true,
    color: "from-orange-400 to-orange-600",
  },
  {
    id: "basket-competition",
    title: "수강신청 장바구니 경쟁률",
    description: "강의 경쟁률 확인",
    icon: "bar-chart-3",
    href: "https://sugang.syu.kr/basket",
    isExternal: true,
    color: "from-green-400 to-green-600",
  },
];

export default function AcademicPage() {
  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          학사 정보
        </h1>
        <p className="text-neutral-600">학사 관련 정보를 한눈에 확인하세요</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {academicMenus.map((menu) => {
          const cardElement = (
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
                />
              </div>
            </Card>
          );

          if (menu.isExternal) {
            return (
              <a
                key={menu.id}
                href={menu.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {cardElement}
              </a>
            );
          }

          return (
            <Link key={menu.id} href={menu.href}>
              {cardElement}
            </Link>
          );
        })}
      </div>
    </Container>
  );
}
