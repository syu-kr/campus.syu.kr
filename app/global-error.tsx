"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { getDictionary } from "@/lib/i18n";

const text = getDictionary("ko").errorBoundary;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body>
        <main style={{ margin: "0 auto", maxWidth: 640, padding: "80px 24px", textAlign: "center" }}>
          <h1>{text.globalTitle}</h1>
          <p>{text.globalMessage}</p>
          <button type="button" onClick={reset}>
            {text.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
