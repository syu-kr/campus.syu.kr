"use client";

import { getDictionary } from "@/lib/i18n";

const text = getDictionary("ko").errorBoundary;

export default function GlobalError({ reset }: { reset: () => void }) {
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
