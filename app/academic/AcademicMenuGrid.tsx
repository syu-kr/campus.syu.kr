"use client";

import { useState } from "react";
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
  const [showGraduationModal, setShowGraduationModal] = useState(false);

  return (
    <>
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
          );

          if (menu.id === "graduation-check") {
            return (
              <button
                key={menu.id}
                type="button"
                onClick={() => setShowGraduationModal(true)}
                className="block text-left"
              >
                {cardElement}
              </button>
            );
          }

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

      {showGraduationModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="graduation-renewal-title"
          onClick={() => setShowGraduationModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="graduation-renewal-title"
              className="text-lg font-bold text-neutral-900"
            >
              졸업요건 확인 준비중
            </h2>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              현재 졸업요건 확인 기능은 정확도 개선을 위한 리뉴얼 작업 중입니다.
              정식 반영 전까지는 SU-WINGs와 학과사무실을 통해 확인해 주세요.
            </p>
            <button
              type="button"
              onClick={() => setShowGraduationModal(false)}
              className="mt-5 w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
