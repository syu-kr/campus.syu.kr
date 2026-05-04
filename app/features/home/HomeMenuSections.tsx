import Link from "next/link";
import { Card } from "@/app/components/Card";
import { Icon } from "@/app/components/Icon";

const frequentMenus = [
  { id: "1", iconName: "utensils", label: "학식", path: "/campus/cafeteria" },
  { id: "2", iconName: "bus", label: "버스 정보", path: "/campus/bus-info" },
  {
    id: "3",
    iconName: "map",
    label: "캠퍼스 지도",
    path: "/campus/map",
  },
  {
    id: "4",
    iconName: "calendar",
    label: "학사일정",
    path: "/academic/schedule",
  },
  { id: "5", iconName: "award", label: "장학금", path: "/more/scholarship" },
  { id: "6", iconName: "book-open", label: "도서관", path: "/campus/library" },
];

const relatedLinks = [
  {
    iconName: "bus",
    title: "버스 정보",
    description: "셔틀·시내버스",
    path: "/campus/bus-info",
  },
  {
    iconName: "map",
    title: "캠퍼스 지도",
    description: "건물·시설",
    path: "/campus/map",
  },
  {
    iconName: "megaphone",
    title: "학사공지",
    description: "공지사항",
    path: "/academic/announcements",
  },
  {
    iconName: "book-open",
    title: "도서관",
    description: "이용정보",
    path: "/campus/library",
  },
  {
    iconName: "award",
    title: "장학금",
    description: "공지사항",
    path: "/more/scholarship",
  },
  {
    iconName: "phone",
    title: "연락처",
    description: "부서 검색",
    path: "/more/phone",
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
  return (
    <Card className="bg-gradient-to-br from-primary-500 to-primary-600 text-white">
      <div className="space-y-4">
        <div>
          <p className="mb-1 text-xs opacity-90">팁</p>
          <h3 className="text-lg font-semibold">
            SYU CAMPUS를 앱처럼 설치하여 사용하세요!
          </h3>
          <p className="mt-2 text-xs opacity-80">
            PWA 설치로 더 빠르고 편리하게 접속 가능합니다
          </p>
        </div>
        <Link
          href="/service/notices/005-pwa-installation-guide"
          className="inline-block rounded-lg bg-white bg-opacity-20 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-opacity-30"
        >
          설치 방법 보기
        </Link>
      </div>
    </Card>
  );
}

export function RelatedLinksSection() {
  return (
    <div className="mt-8 border-t border-neutral-200 pt-6">
      <h2 className="mb-4 text-lg font-semibold text-neutral-900">
        더 알아보기
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
