"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PaginationControls } from "@/app/components/PaginationControls";
import { useUrlHash } from "@/lib/use-url-hash";

export function ServiceNoticePagination({ currentPage, totalPages }: { currentPage: number; totalPages: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const hash = useUrlHash();
  const [pending, startNavigation] = useTransition();
  if (totalPages <= 1) return null;
  const pageHref = (page: number) => {
    const next = new URLSearchParams(params.toString());
    if (page > 1) next.set("page", String(page)); else next.delete("page");
    return `${pathname}${next.size ? `?${next}` : ""}${hash}`;
  };
  return <div className="service-notices-pagination" aria-busy={pending}>
    <PaginationControls currentPage={currentPage} totalPages={totalPages} getPageHref={pageHref}
      onPageChange={page => startNavigation(() => router.push(pageHref(page), { scroll: false }))} />
  </div>;
}
