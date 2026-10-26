"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";

import { koDictionary } from "@/lib/i18n/ko";
import { enDictionary } from "@/lib/i18n/en";
import { getLocaleFromPathname, type Locale } from "@/lib/i18n/routing";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const [locale, setLocale] = useState<Locale>("ko");
  const text = (locale === "en" ? enDictionary : koDictionary).errorBoundary;

  useEffect(() => {
    setLocale(getLocaleFromPathname(window.location.pathname));
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang={locale}>
      <body>
        <main style={{ margin: "0 auto", maxWidth: 640, padding: "80px 24px", textAlign: "center" }}>
          <h1>{text.globalTitle}</h1>
          <p>{text.globalMessage}</p>
          <button type="button" onClick={() => error?.name === "ChunkLoadError" ? window.location.reload() : retry()}>
            {text.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
