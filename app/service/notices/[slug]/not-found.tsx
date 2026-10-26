"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDictionary, useLocale } from "@/app/components/LocaleContext";
import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import { buttonStyles } from "@/app/components/Button";
import { localizePath } from "@/lib/i18n/routing";
import { getAnnouncementListQuery } from "@/lib/announcement-list-query";

function MissingServiceNotice() {
  const locale = useLocale(), text = useDictionary().pages.serviceNotices;
  const params = useSearchParams();
  const page = getAnnouncementListQuery({ page: params.get("listPage") ?? undefined }).page;
  return <Container className="py-8"><Card hover={false}>
    <h1 className="mb-5">{text.notFound}</h1>
    <Link prefetch={false} className={buttonStyles("secondary")} href={localizePath(`/service/notices${page > 1 ? `?page=${page}` : ""}`, locale)}>{text.backToList}</Link>
  </Card></Container>;
}
export default function ServiceNoticeNotFound() {
  return <Suspense fallback={null}><MissingServiceNotice /></Suspense>;
}
