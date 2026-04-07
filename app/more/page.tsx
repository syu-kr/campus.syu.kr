"use client";

import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import Link from "next/link";
import { Icon } from "@/app/components/Icon";

export default function MorePage() {
  const moreMenus = [
    {
      id: "1",
      title: "장학금",
      description: "장학금 공지 및 신청",
      iconName: "award",
      href: "/more/scholarship",
      color: "from-blue-400 to-blue-600",
    },
    {
      id: "2",
      title: "서비스 공지",
      description: "SYU CAMPUS 서비스 공지",
      iconName: "megaphone",
      href: "/service/notices",
      color: "from-green-400 to-green-600",
    },
    {
      id: "3",
      title: "연락처 검색",
      description: "부서 및 담당자 연락처",
      iconName: "phone",
      href: "/more/phone",
      color: "from-purple-400 to-purple-600",
    },
  ];

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          더보기
        </h1>
        <p className="text-neutral-600">추가 기능을 확인하세요</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {moreMenus.map((menu) => (
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
                  name={menu.iconName}
                  size={40}
                  strokeWidth={1.5}
                  color="white"
                />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* 관련 정보 */}
      <div className="mt-8 pt-6 border-t border-neutral-200">
        <h3 className="text-base font-semibold text-neutral-900 mb-4">자주 가는 메뉴</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Link
            href="/campus/cafeteria"
            className="p-4 rounded-lg bg-green-50 border border-green-200 hover:border-green-500 transition-colors text-center"
          >
            <p className="text-xl mb-2">🍽️</p>
            <p className="text-sm font-medium text-neutral-900">학식</p>
          </Link>
          <Link
            href="/campus/bus-info"
            className="p-4 rounded-lg bg-blue-50 border border-blue-200 hover:border-blue-500 transition-colors text-center"
          >
            <p className="text-xl mb-2">🚍</p>
            <p className="text-sm font-medium text-neutral-900">버스</p>
          </Link>
          <Link
            href="/campus/library"
            className="p-4 rounded-lg bg-purple-50 border border-purple-200 hover:border-purple-500 transition-colors text-center"
          >
            <p className="text-xl mb-2">📚</p>
            <p className="text-sm font-medium text-neutral-900">도서관</p>
          </Link>
        </div>
      </div>

      <Card className="mt-8 bg-blue-50 border border-blue-200">
        <p className="text-sm text-blue-900">
          <strong>개발 예정:</strong> 더 많은 기능이 준비 중입니다.
        </p>
      </Card>
    </Container>
  );
}
