import { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";

export const metadata: Metadata = {
  title: "학사",
  description: "학사일정, 공지사항, 학점조회 등 학사 정보",
};

const academicMenus = [
  {
    id: "announcements",
    title: "학사공지",
    description: "학사 관련 공지사항",
    icon: "📢",
    href: "/academic/announcements",
    color: "from-blue-400 to-blue-600",
  },
  {
    id: "schedule",
    title: "학사일정",
    description: "수강신청, 시험, 휴무 일정",
    icon: "📅",
    href: "/academic/schedule",
    color: "from-purple-400 to-purple-600",
  },
  {
    id: "timetable",
    title: "시간표 짜기",
    description: "학기 시간표 작성 마법사",
    icon: "⏰",
    href: "/academic/timetable",
    color: "from-pink-400 to-pink-600",
  },
  {
    id: "graduation",
    title: "졸업요건",
    description: "졸업 요건 및 체크리스트",
    icon: "🎓",
    href: "/academic/graduation",
    color: "from-orange-400 to-orange-600",
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
        {academicMenus.map((menu) => (
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

      {/* 학사 정보 요약 */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">
          학적 현황
        </h2>
        <Card>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-neutral-600 mb-1">학적상태</p>
              <p className="font-bold text-primary-600">정상</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-neutral-600 mb-1">GPA</p>
              <p className="font-bold text-primary-600">3.85</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-neutral-600 mb-1">이수학점</p>
              <p className="font-bold text-primary-600">115 / 130</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-neutral-600 mb-1">졸업예정</p>
              <p className="font-bold text-primary-600">2025년 2월</p>
            </div>
          </div>
        </Card>
      </div>
    </Container>
  );
}
