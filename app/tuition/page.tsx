import { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";

export const metadata: Metadata = {
  title: "등록금 및 장학금",
  description: "등록금 일정, 장학금 정보",
};

const tuitionMenus = [
  {
    id: "schedule",
    title: "등록금 일정",
    description: "등록금 납부 기간 안내",
    icon: "📅",
    href: "/tuition/schedule",
    color: "from-blue-400 to-blue-600",
  },
  {
    id: "scholarship",
    title: "장학금",
    description: "교내/외 장학금 정보",
    icon: "🎓",
    href: "/tuition/scholarship",
    color: "from-green-400 to-green-600",
  },
  {
    id: "loan",
    title: "학자금 대출",
    description: "학생 대출 및 이자 정보",
    icon: "💳",
    href: "/tuition/loan",
    color: "from-purple-400 to-purple-600",
  },
  {
    id: "refund",
    title: "환급 안내",
    description: "수강포기 및 환급 정책",
    icon: "💰",
    href: "/tuition/refund",
    color: "from-orange-400 to-orange-600",
  },
];

export default function TuitionPage() {
  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          등록금 및 장학금
        </h1>
        <p className="text-neutral-600">여러분의 학비 정보를 확인하세요</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tuitionMenus.map((menu) => (
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
