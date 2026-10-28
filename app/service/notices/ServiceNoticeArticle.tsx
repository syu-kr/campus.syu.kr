"use client";

import { useMemo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import type { ServiceNoticeDetail } from "@/lib/serviceNotices";
import type { Locale } from "@/lib/i18n/routing";
import { localizePath } from "@/lib/i18n/routing";
import { markdownTranslationFields, markdownTranslationPlugin } from "@/lib/markdown-translation";
import { useContentTranslation } from "@/app/components/ContentTranslation";

type HeadingNode = { type: string; depth?: number; children?: HeadingNode[] };

function serviceNoticeHeadings() {
  return (tree: unknown) => {
    const headings: HeadingNode[] = [];
    function visit(node: HeadingNode) {
      if (node.type === "heading") headings.push(node);
      node.children?.forEach(visit);
    }
    visit(tree as HeadingNode);
    // A body title belongs below the article title; keep its subsections nested.
    if (headings.some(heading => heading.depth === 1)) {
      headings.forEach(heading => { heading.depth = Math.min(6, (heading.depth ?? 1) + 1); });
    }
  };
}

export function ServiceNoticeArticle({ notice, locale, children }: { notice: ServiceNoticeDetail; locale: Locale; children: ReactNode }) {
  const fields = useMemo(() => notice.lang === "en" ? {} : { title: notice.title, ...markdownTranslationFields(notice.content) }, [notice.lang, notice.title, notice.content]);
  const translation = useContentTranslation({ kind: "service-notice", id: notice.slug }, fields);
  const lang = notice.lang === "en" ? "en" : translation.lang;
  return <article className="prose prose-sm md:prose max-w-none">
    <h1 lang={lang} className="text-2xl md:text-3xl font-bold text-neutral-900 mb-4">{translation.text("title", notice.title)}</h1>
    {children}
    <div lang={lang} className="prose prose-sm md:prose max-w-none dark:prose-invert prose-headings:text-neutral-900 prose-headings:font-bold prose-a:text-primary-600 prose-a:no-underline hover:prose-a:underline prose-code:bg-neutral-100 prose-code:text-neutral-900 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-img:rounded-lg prose-img:shadow">
      <ReactMarkdown remarkPlugins={[serviceNoticeHeadings, markdownTranslationPlugin(translation.text)]} components={{
        h2: ({ children }) => <h2 className="text-xl font-bold mt-5 mb-3">{children}</h2>,
        h3: ({ children }) => <h3 className="text-lg font-bold mt-4 mb-2">{children}</h3>,
        p: ({ children }) => <p className="text-base leading-7 mb-4">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>,
        ol: ({ children, start }) => <ol start={start} className="list-decimal list-inside mb-4 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="text-base">{children}</li>,
        blockquote: ({ children }) => <blockquote className="border-l-4 border-primary-600 pl-4 italic text-neutral-600 mb-4">{children}</blockquote>,
        a: ({ href, title, children }) => <a href={href?.startsWith("/") ? localizePath(href, locale) : href} title={title}>{children}</a>,
      }}>{notice.content}</ReactMarkdown>
    </div>
  </article>;
}
