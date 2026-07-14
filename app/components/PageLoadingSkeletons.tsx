"use client";

import type { ReactNode } from "react";

import { useDictionary } from "./LocaleProvider";
import { Skeleton } from "./Skeleton";

function LoadingStatus({
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

function PageHeaderSkeleton() {
  return (
    <div className="mb-8 space-y-3">
      <Skeleton variant="text" width="42%" height="32px" />
      <Skeleton variant="text" width="70%" height="20px" />
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <LoadingStatus className="mx-auto max-w-4xl space-y-6 px-4 py-5 sm:py-8">
      <Skeleton height="48px" className="rounded-xl" />

      {Array.from({ length: 4 }).map((_, index) => (
        <section key={index} className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <Skeleton variant="text" width="34%" height="24px" />
            <Skeleton variant="text" width="18%" height="18px" />
          </div>
          <Skeleton height={index === 2 ? "216px" : "132px"} />
        </section>
      ))}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} height="96px" />
        ))}
      </div>
    </LoadingStatus>
  );
}

export function CafeteriaPageSkeleton() {
  return (
    <LoadingStatus className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <PageHeaderSkeleton />
      <Skeleton height="220px" className="mb-8" />
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <Skeleton height="112px" />
        <Skeleton height="112px" />
      </div>
      <Skeleton variant="text" width="32%" height="24px" className="mb-4" />
      <Skeleton count={3} height="200px" />
    </LoadingStatus>
  );
}

export function SchedulePageSkeleton() {
  return (
    <LoadingStatus className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <PageHeaderSkeleton />
      <Skeleton height="52px" className="mb-6" />
      <Skeleton height="520px" className="mb-8" />
      <Skeleton variant="text" width="36%" height="24px" className="mb-4" />
      <Skeleton count={3} height="104px" />
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

export function ShuttleSectionSkeleton() {
  return (
    <LoadingStatus className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <PageHeaderSkeleton />
      <Skeleton height="152px" className="mb-6" />
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} height="44px" />
        ))}
      </div>
      <Skeleton count={3} height="132px" />
    </LoadingStatus>
  );
}
