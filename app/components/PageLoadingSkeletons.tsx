"use client";

import type { ReactNode } from "react";

import { useDictionary } from "./LocaleProvider";
import { Skeleton } from "./Skeleton";

export function LoadingStatus({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  const dictionary = useDictionary();

  return (
    <div
      className={className}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{dictionary.errorBoundary.loading}</span>
      {children}
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <LoadingStatus className="mx-auto max-w-4xl space-y-6 px-4 pb-5 pt-6 sm:pb-8">
      <section className="space-y-3">
        <Skeleton variant="text" width="34%" height="24px" />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} height="96px" />
          ))}
        </div>
      </section>

      {Array.from({ length: 2 }).map((_, index) => (
        <section key={index} className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <Skeleton variant="text" width="34%" height="24px" />
            <Skeleton variant="text" width="18%" height="18px" />
          </div>
          <Skeleton height={index === 0 ? "216px" : "132px"} />
        </section>
      ))}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} height="96px" />
        ))}
      </div>
    </LoadingStatus>
  );
}

export function AnnouncementDetailSkeleton() {
  return (
    <LoadingStatus className="mx-auto max-w-4xl px-4 py-6 md:py-8">
      <Skeleton variant="text" width="24%" height="20px" className="mb-6" />
      <div className="rounded-card border border-neutral-200 bg-white p-5 sm:p-6">
        <Skeleton variant="text" width="16%" height="24px" className="mb-4" />
        <Skeleton variant="text" width="88%" height="36px" className="mb-4" />
        <Skeleton variant="text" width="56%" height="18px" className="mb-6" />
        <div className="space-y-3 border-t border-neutral-200 pt-6">
          <Skeleton variant="text" width="100%" />
          <Skeleton variant="text" width="96%" />
          <Skeleton variant="text" width="92%" />
          <Skeleton variant="text" width="72%" />
        </div>
      </div>
    </LoadingStatus>
  );
}
