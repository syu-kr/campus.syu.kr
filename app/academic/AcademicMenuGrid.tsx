import Link from "next/link";

import { Card } from "@/app/components/Card";
import { Icon } from "@/app/components/Icon";

const academicMenus = [
  {
    id: "announcements",
    title: "학사공지",
    description: "학사 관련 공지사항",
    icon: "megaphone",
    href: "/academic/announcements",
    isExternal: false,
  },
  {
    id: "schedule",
    title: "학사일정",
    description: "수강신청, 시험, 휴무 일정",
    icon: "calendar",
    href: "/academic/schedule",
    isExternal: false,
  },
  {
    id: "scholarship",
    title: "장학금",
    description: "장학금 공지 및 신청",
    icon: "award",
    href: "/academic/scholarship",
    isExternal: false,
  },
  {
    id: "graduation-check",
    title: "졸업요건 확인",
    description: "내 상황에 맞는 졸업요건 체크",
    icon: "check-circle",
    href: "/academic/graduation",
    isExternal: false,
  },
  {
    id: "timetable",
    title: "시간표 짜기",
    description: "학기 시간표 작성 마법사",
    icon: "clock",
    href: "/academic/timetable",
    isExternal: false,
  },
  {
    id: "mock-sugang",
    title: "모의 수강신청",
    description: "수강신청 미리 연습하기",
    icon: "book-open",
    href: "https://sugang.syu.kr/testLogin",
    isExternal: true,
  },
  {
    id: "basket-competition",
    title: "수강신청 장바구니 경쟁률",
    description: "강의 경쟁률 확인",
    icon: "bar-chart-3",
    href: "https://sugang.syu.kr/basket",
    isExternal: true,
  },
];

export function AcademicMenuGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {academicMenus.map((menu) => {
        const cardElement = (
          <Card
            hover={false}
            className="cursor-pointer border border-neutral-200 bg-white transition-colors hover:border-primary-300 hover:bg-primary-50"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="mb-1 text-lg font-bold text-neutral-900">
                  {menu.title}
                </h3>
                <p className="text-sm text-neutral-600">{menu.description}</p>
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
        );

        if (menu.isExternal) {
          return (
            <a
              key={menu.id}
              href={menu.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              {cardElement}
            </a>
          );
        }

        return (
          <Link key={menu.id} href={menu.href} className="block">
            {cardElement}
          </Link>
        );
      })}
    </div>
  );
}
