import { headers } from "next/headers";
import Link from "next/link";

import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
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

export default async function MorePage() {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const moreMenus = [
    {
      id: "service-notices",
      title: dictionary.more.menus.serviceTitle,
      description: dictionary.more.menus.serviceDescription,
      iconName: "megaphone",
      href: "/service/notices",
    },
    {
      id: "meet",
      title: dictionary.more.menus.meetTitle,
      description: dictionary.more.menus.meetDescription,
      iconName: "calendar",
      href: "/more/meet",
    },
    {
      id: "privacy",
      title: dictionary.more.menus.privacyTitle,
      description: dictionary.more.menus.privacyDescription,
      iconName: "info",
      href: "/more/privacy",
    },
  ];

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          {dictionary.more.title}
        </h1>
        <p className="text-neutral-600">{dictionary.more.description}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {moreMenus.map((menu) => (
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

      <Card
        hover={false}
        className="mt-6 border border-neutral-200 bg-neutral-50"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-neutral-900">
              {dictionary.more.translationTitle}
            </h2>
            <p className="mt-1 text-sm leading-6 text-neutral-600">
              {dictionary.more.translationDescription}
            </p>
          </div>
          <span className="text-primary-600">
            <Icon name="info" size={24} strokeWidth={1.75} color="currentColor" />
          </span>
        </div>
      </Card>
    </Container>
  );
}
