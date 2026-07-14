"use client";

import { useLinkStatus } from "next/link";
import clsx from "clsx";

import { useDictionary } from "./LocaleProvider";

interface NavigationPendingIndicatorProps {
  className?: string;
}

export function NavigationPendingIndicator({
  className,
}: NavigationPendingIndicatorProps) {
  const { pending } = useLinkStatus();
  const dictionary = useDictionary();

  return (
    <>
      <span
        aria-hidden="true"
        className={clsx(
          "navigation-pending-indicator pointer-events-none absolute h-0.5 origin-left rounded-full",
          className,
        )}
        data-pending={pending}
      />
      {pending && (
        <span className="sr-only" role="status" aria-live="polite">
          {dictionary.errorBoundary.loading}
        </span>
      )}
    </>
  );
}
