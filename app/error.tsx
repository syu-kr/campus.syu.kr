"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { useDictionary } from "@/app/components/LocaleProvider";
import { Button } from "@/app/components/Button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const text = useDictionary().errorBoundary;

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-2xl font-bold text-neutral-900">
        {text.pageTitle}
      </h1>
      <p className="mt-3 text-sm leading-6 text-neutral-600">
        {text.pageMessage}
      </p>
      <Button
        type="button"
        onClick={reset}
        className="mt-6"
      >
        {text.retry}
      </Button>
    </section>
  );
}
