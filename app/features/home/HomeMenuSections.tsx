"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/app/components/Card";
import { Icon } from "@/app/components/Icon";

const PWA_INSTALL_DISMISSED_KEY = "syu-campus:pwa-install-dismissed";

const frequentMenus = [
  { id: "1", iconName: "utensils", label: "학식", path: "/campus/cafeteria" },
  { id: "2", iconName: "bus", label: "버스 정보", path: "/campus/bus-info" },
  {
    id: "3",
    iconName: "lightbulb",
    label: "캠퍼스 꿀팁",
    path: "/more/campus-tips",
  },
  { id: "4", iconName: "award", label: "장학금", path: "/more/scholarship" },
  {
    id: "5",
    iconName: "map",
    label: "캠퍼스 지도",
    path: "/campus/map",
  },
  { id: "6", iconName: "book-open", label: "도서관", path: "/campus/library" },
];

const relatedLinks = [
  {
    iconName: "book-open",
    title: "학사 정보",
    description: "공지·일정·졸업요건",
    path: "/academic",
  },
  {
    iconName: "building",
    title: "캠퍼스 정보",
    description: "생활·시설·교통",
    path: "/campus",
  },
  {
    iconName: "more-horizontal",
    title: "더보기",
    description: "장학금·연락처·도구",
    path: "/more",
  },
  {
    iconName: "megaphone",
    title: "서비스 공지",
    description: "업데이트 안내",
    path: "/service/notices",
  },
];

export function FrequentMenuGrid() {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-neutral-700">
        자주 사용하는 메뉴
      </h2>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {frequentMenus.map((menu) => (
          <Link
            key={menu.id}
            href={menu.path}
            className="flex flex-col items-center justify-center rounded-lg py-4 transition-colors hover:bg-primary-50"
          >
            <Icon
              name={menu.iconName}
              size={32}
              color="rgb(37, 99, 235)"
              className="mb-2"
            />
            <span className="text-center text-xs font-medium text-neutral-900">
              {menu.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function PwaInstallCard() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(localStorage.getItem(PWA_INSTALL_DISMISSED_KEY) !== "true");
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(PWA_INSTALL_DISMISSED_KEY, "true");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <Card className="border border-primary-100 bg-primary-50" hover={false}>
      <div className="flex items-start gap-3">
        <Icon
          name="info"
          size={20}
          color="rgb(37, 99, 235)"
          className="mt-0.5 flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">
            자주 쓰는 경우 앱처럼 열 수 있습니다
          </p>
          <p className="mt-1 text-xs leading-5 text-neutral-600">
            설치는 선택 사항이며, 브라우저에서도 같은 기능을 사용할 수 있습니다.
          </p>
          <Link
            href="/service/notices/005-pwa-installation-guide"
            className="mt-3 inline-flex rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-50"
          >
            앱처럼 쓰는 방법
          </Link>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-white hover:text-neutral-900"
          aria-label="앱 설치 안내 숨기기"
        >
          <Icon name="x" size={16} color="currentColor" />
        </button>
      </div>
    </Card>
  );
}

export function RelatedLinksSection() {
  return (
    <div className="mt-8 border-t border-neutral-200 pt-6">
      <h2 className="mb-4 text-lg font-semibold text-neutral-900">
        주요 서비스 바로가기
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {relatedLinks.map((link) => (
          <Link
            key={link.path}
            href={link.path}
            className="rounded-lg border border-neutral-200 p-4 transition-all hover:border-primary-500 hover:bg-primary-50"
          >
            <Icon
              name={link.iconName}
              size={24}
              color="rgb(37, 99, 235)"
              className="mb-2"
            />
            <p className="text-sm font-medium text-neutral-900">{link.title}</p>
            <p className="text-xs text-neutral-600">{link.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
