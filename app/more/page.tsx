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
    },
    {
      id: "2",
      title: "서비스 공지",
      description: "SYU CAMPUS 서비스 공지",
      iconName: "megaphone",
      href: "/service/notices",
    },
    {
      id: "3",
      title: "연락처 검색",
      description: "부서 및 담당자 연락처",
      iconName: "phone",
      href: "/more/phone",
    },
    {
      id: "4",
      title: "캠퍼스 꿀팁",
      description: "학교생활에 필요한 링크 모음",
      iconName: "lightbulb",
      href: "/more/campus-tips",
    },
    {
      id: "5",
      title: "일정 잡기",
      description: "초대 링크로 가능한 시간 찾기",
      iconName: "calendar",
      href: "/more/meet",
    },
    {
      id: "6",
      title: "알림 및 개인정보",
      description: "알림 권한과 분석 도구 안내",
      iconName: "info",
      href: "/more/privacy",
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
                    name={menu.iconName}
                    size={28}
                    strokeWidth={1.75}
                    color="currentColor"
                  />
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </Container>
  );
}
