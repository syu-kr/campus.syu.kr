import { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { Icon } from "@/app/components/Icon";
import {
  LOCALE_HEADER_NAME,
  getDictionary,
  localizePath,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n";

async function getRequestLocale(): Promise<Locale> {
  const headerStore = await headers();
  return normalizeLocale(headerStore.get(LOCALE_HEADER_NAME));
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);

  return {
    title: `${dictionary.campus.title} | SYU CAMPUS`,
    description: dictionary.campus.metaDescription,
    keywords:
      locale === "en"
        ? "campus, cafeteria, library, shuttle bus, campus map"
        : "캠퍼스,동아리,식당,도서관,셔틀버스,캠퍼스 지도",
    openGraph: {
      title: `${dictionary.campus.title} | SYU CAMPUS`,
      description: dictionary.campus.metaDescription,
      type: "website",
      url: `https://campus.syu.kr${localizePath("/campus", locale)}`,
    },
  };
}

export default async function CampusPage() {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const campusMenus = [
    {
      id: "announcements",
      title: dictionary.campus.menus.announcementsTitle,
      description: dictionary.campus.menus.announcementsDescription,
      icon: "megaphone",
      href: "/campus/announcements",
    },
    {
      id: "cafeteria",
      title: dictionary.campus.menus.cafeteriaTitle,
      description: dictionary.campus.menus.cafeteriaDescription,
      icon: "utensils",
      href: "/campus/cafeteria",
    },
    {
      id: "bus-info",
      title: dictionary.campus.menus.busTitle,
      description: dictionary.campus.menus.busDescription,
      icon: "bus",
      href: "/campus/bus-info",
    },
    {
      id: "library",
      title: dictionary.campus.menus.libraryTitle,
      description: dictionary.campus.menus.libraryDescription,
      icon: "book-open",
      href: "/campus/library",
    },
    {
      id: "map",
      title: dictionary.campus.menus.mapTitle,
      description: dictionary.campus.menus.mapDescription,
      icon: "map",
      href: "/campus/map",
    },
    {
      id: "phone",
      title: dictionary.campus.menus.phoneTitle,
      description: dictionary.campus.menus.phoneDescription,
      icon: "phone",
      href: "/campus/phone",
    },
    {
      id: "campus-tips",
      title: dictionary.campus.menus.campusTipsTitle,
      description: dictionary.campus.menus.campusTipsDescription,
      icon: "lightbulb",
      href: "/campus/campus-tips",
    },
    {
      id: "gym",
      title: dictionary.campus.menus.gymTitle,
      description: dictionary.campus.menus.gymDescription,
      icon: "dumbbell",
      href: "/campus/gym",
    },
    {
      id: "health-center",
      title: dictionary.campus.menus.healthCenterTitle,
      description: dictionary.campus.menus.healthCenterDescription,
      icon: "stethoscope",
      href: "/campus/health-center",
    },
  ];

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          {dictionary.campus.title}
        </h1>
        <p className="text-neutral-600">{dictionary.campus.description}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {campusMenus.map((menu) => {
          return (
            <Link
              key={menu.id}
              href={localizePath(menu.href, locale)}
              className="block"
            >
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
                      name={menu.icon}
                      size={28}
                      strokeWidth={1.75}
                      color="currentColor"
                      title={menu.title}
                    />
                  </span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </Container>
  );
}
