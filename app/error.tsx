"use client";

import { useDictionary } from "@/app/components/LocaleProvider";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const text = useDictionary().errorBoundary;

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-2xl font-bold text-neutral-900">
        {text.pageTitle}
      </h1>
      <p className="mt-3 text-sm leading-6 text-neutral-600">
        {text.pageMessage}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      >
        {text.retry}
      </button>
    </main>
  );
}
