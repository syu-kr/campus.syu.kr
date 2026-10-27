import { createPageMetadata } from "@/lib/page-metadata";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAllServiceNotices } from "@/lib/serviceNotices";
import { Container } from "@/app/components/Container";
import { StateCard } from "@/app/components/StateCard";
import { ServiceNoticePagination } from "./ServiceNoticePagination";
import { ServiceNoticeRow } from "./ServiceNoticeRow";
import { getAnnouncementListQuery, type AnnouncementListSearchParams } from "@/lib/announcement-list-query";
import { replaceListParams } from "@/lib/public-list-query";
import {
  LOCALE_HEADER_NAME,
  getDictionary,
  localizePath,
  normalizeLocale,
  createLocalizedAlternates,
  type Locale,
} from "@/lib/i18n";

async function getCurrentLocale(): Promise<Locale> {
  const headerStore = await headers();
  return normalizeLocale(headerStore.get(LOCALE_HEADER_NAME));
}

type ServiceNoticesPageProps = { searchParams?: Promise<AnnouncementListSearchParams> };
const ITEMS_PER_PAGE = 10;

export async function generateMetadata({ searchParams = Promise.resolve({}) }: ServiceNoticesPageProps = {}): Promise<Metadata> {
  const locale = await getCurrentLocale();
  const text = getDictionary(locale).pages.serviceNotices;
  const { page } = getAnnouncementListQuery(await searchParams);
  const pathname = `/service/notices${page > 1 ? `?page=${page}` : ""}`;

  return {
    ...createPageMetadata({ title: text.metaTitle, description: text.metaDescription, pathname, locale }),
    alternates: createLocalizedAlternates(pathname, locale),
  };
}

export default async function ServiceNoticesPage({ searchParams = Promise.resolve({}) }: ServiceNoticesPageProps = {}) {
  const locale = await getCurrentLocale();
  const text = getDictionary(locale).pages.serviceNotices;
  const notices = await getAllServiceNotices(locale);
  const params = await searchParams;
  const requestedPage = getAnnouncementListQuery(params).page;
  const totalPages = Math.max(1, Math.ceil(notices.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(requestedPage, totalPages);
  const canonicalPage = currentPage > 1 ? String(currentPage) : undefined;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  if (rawPage !== undefined && (rawPage !== canonicalPage || Array.isArray(params.page))) {
    redirect(localizePath(`/service/notices${replaceListParams(params, { page: canonicalPage })}`, locale));
  }
  const visibleNotices = notices.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const dateLocale = locale === "en" ? "en-US" : "ko-KR";

  return (
    <Container className="service-notices-page">
      <header className="service-notices-header">
        <h1>{text.title}</h1>
        <p>{text.description}</p>
      </header>

      {notices.length === 0 ? (
        <StateCard type="info" message={text.empty} />
      ) : (
        <ol className="service-notices-list" aria-label={text.title}>
          {visibleNotices.map((notice) => {
            const date = new Date(notice.date).toLocaleDateString(dateLocale, { timeZone: "Asia/Seoul" });
            return <ServiceNoticeRow key={notice.slug} notice={notice} date={date} dateLabel={text.date} href={localizePath(`/service/notices/${notice.slug}${currentPage > 1 ? `?listPage=${currentPage}` : ""}`, locale)} />;
          })}
        </ol>
      )}
      <ServiceNoticePagination currentPage={currentPage} totalPages={totalPages} />
    </Container>
  );
}
