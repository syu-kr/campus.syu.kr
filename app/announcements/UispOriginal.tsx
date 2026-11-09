import { createElement, type ReactNode } from "react";
import { getDictionary, type Locale } from "@/lib/i18n";
import { readUispNotice } from "@/lib/server/uisp-notices";
import type { UispContentNode } from "@/lib/server/uisp-notice-parser";

export async function UispOriginal({ id, locale }: { id: string; locale: Locale }) {
  const text = getDictionary(locale).pages.announcements;
  const notice = await readUispNotice(id);

  if (!notice) {
    return <p role="status" className="text-neutral-700">{text.uispOriginalUnavailable}</p>;
  }

  return (
    <>
      <section className="space-y-3" aria-label={text.uispOriginalTitle}>
        <h2 className="text-lg font-semibold text-neutral-900">{text.uispOriginalTitle}</h2>
        <div lang="ko" className="max-w-full space-y-3 overflow-x-auto break-words leading-7 text-neutral-800 [&_ol]:list-decimal [&_ol]:ps-6 [&_p+p]:mt-3 [&_ul]:list-disc [&_ul]:ps-6">
          {renderNodes(notice.content, text.uispPoster)}
        </div>
      </section>
      {notice.attachments.length > 0 && (
        <section className="mt-8 border-t border-neutral-200 pt-5" aria-label={text.uispAttachments}>
          <h2 className="mb-2 text-lg font-semibold text-neutral-900">{text.uispAttachments}</h2>
          <ul className="divide-y divide-neutral-200">
            {notice.attachments.map(({ index, name }) => (
              <li key={index}>
                <a
                  href={`/api/uisp-assets/${encodeURIComponent(id)}/attachment/${index}`}
                  className="flex min-h-12 items-center break-all rounded px-2 py-2 text-primary-700 underline underline-offset-4 focus-visible:outline focus-visible:outline-2"
                >
                  <span lang="ko">{name}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function renderNodes(nodes: UispContentNode[], posterAlt: string): ReactNode[] {
  return nodes.map((node, key) => {
    switch (node.type) {
      case "text":
        return node.text;
      case "link":
        return (
          <a key={key} href={node.href} target="_blank" rel="noopener noreferrer" className="break-all text-primary-700 underline underline-offset-4">
            {renderNodes(node.children, posterAlt)}
          </a>
        );
      case "image":
        // The asset handler bounds and validates the raster before serving it.
        // eslint-disable-next-line @next/next/no-img-element
        return <img key={key} src={node.src} alt={node.alt && !/\.(?:jpe?g|png|gif|webp)$/i.test(node.alt) ? node.alt : posterAlt} loading="lazy" className="h-auto max-w-full rounded" />;
      case "element":
        return node.tag === "br"
          ? <br key={key} />
          : createElement(node.tag, { key }, renderNodes(node.children, posterAlt));
    }
  });
}
