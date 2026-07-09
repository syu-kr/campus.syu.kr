"use client";

import Link from "next/link";

import { Card } from "@/app/components/Card";
import { Icon } from "@/app/components/Icon";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { localizePath } from "@/lib/i18n";

export function AcademicMenuGrid() {
  const locale = useLocale();
  const dictionary = useDictionary();
  const academicMenus = [
    {
      id: "announcements",
      title: dictionary.academic.menus.announcementsTitle,
      description: dictionary.academic.menus.announcementsDescription,
      icon: "megaphone",
      href: "/academic/announcements",
      isExternal: false,
    },
    {
      id: "schedule",
      title: dictionary.academic.menus.scheduleTitle,
      description: dictionary.academic.menus.scheduleDescription,
      icon: "calendar",
      href: "/academic/schedule",
      isExternal: false,
    },
    {
      id: "competitions",
      title: dictionary.academic.menus.competitionsTitle,
      description: dictionary.academic.menus.competitionsDescription,
      icon: "lightbulb",
      href: "/academic/competitions",
      isExternal: false,
    },
    {
      id: "scholarship",
      title: dictionary.academic.menus.scholarshipTitle,
      description: dictionary.academic.menus.scholarshipDescription,
      icon: "award",
      href: "/academic/scholarship",
      isExternal: false,
    },
    {
      id: "graduation-check",
      title: dictionary.academic.menus.graduationTitle,
      description: dictionary.academic.menus.graduationDescription,
      icon: "check-circle",
      href: "/academic/graduation",
      isExternal: false,
    },
    {
      id: "timetable",
      title: dictionary.academic.menus.timetableTitle,
      description: dictionary.academic.menus.timetableDescription,
      icon: "clock",
      href: "/academic/timetable",
      isExternal: false,
    },
    {
      id: "mock-sugang",
      title: dictionary.academic.menus.mockSugangTitle,
      description: dictionary.academic.menus.mockSugangDescription,
      icon: "book-open",
      href: "https://sugang.syu.kr/testLogin",
      isExternal: true,
    },
    {
      id: "basket-competition",
      title: dictionary.academic.menus.basketCompetitionTitle,
      description: dictionary.academic.menus.basketCompetitionDescription,
      icon: "bar-chart-3",
      href: "https://sugang.syu.kr/basket",
      isExternal: true,
    },
  ];

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
          <Link
            key={menu.id}
            href={localizePath(menu.href, locale)}
            className="block"
          >
            {cardElement}
          </Link>
        );
      })}
    </div>
  );
}
