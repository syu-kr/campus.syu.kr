import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getServiceNoticeBySlug } from "@/lib/serviceNotices";
import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import ReactMarkdown from "react-markdown";

interface ServiceNoticeDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({
  params,
}: ServiceNoticeDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const notice = await getServiceNoticeBySlug(slug);

  return {
    title: notice?.title || "공지사항",
    description: notice?.content || "공지사항 상세",
  };
}

export default async function ServiceNoticeDetailPage({
  params,
}: ServiceNoticeDetailPageProps) {
  const { slug } = await params;
  const notice = await getServiceNoticeBySlug(slug);

  if (!notice) {
    return (
      <Container>
        <div className="py-8">
          <p className="text-neutral-600 mb-4">공지를 찾을 수 없습니다.</p>
          <Link
            href="/service/notices"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            ← 목록으로 돌아가기
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="py-6 md:py-8">
        <Link
          href="/service/notices"
          className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium mb-6 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          목록으로 돌아가기
        </Link>

        <Card className="mb-6 md:mb-8">
          <article className="prose prose-sm md:prose max-w-none">
            <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-4">
              {notice.title}
            </h1>

            <div className="flex flex-wrap items-center gap-3 md:gap-4 py-4 border-b border-neutral-200 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-600">작성자:</span>
                <span className="text-sm font-medium text-neutral-900">
                  {notice.author}
                </span>
              </div>
              <span className="text-neutral-300">•</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-600">작성일:</span>
                <time className="text-sm font-medium text-neutral-900">
                  {new Date(notice.date).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              </div>
            </div>

            <div className="prose prose-sm md:prose max-w-none dark:prose-invert prose-headings:text-neutral-900 prose-headings:font-bold prose-a:text-primary-600 prose-a:no-underline hover:prose-a:underline prose-code:bg-neutral-100 prose-code:text-neutral-900 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-img:rounded-lg prose-img:shadow">
              <ReactMarkdown
                components={{
                  h1: ({ ...props }) => (
                    <h1 className="text-2xl font-bold mt-6 mb-4" {...props} />
                  ),
                  h2: ({ ...props }) => (
                    <h2 className="text-xl font-bold mt-5 mb-3" {...props} />
                  ),
                  h3: ({ ...props }) => (
                    <h3 className="text-lg font-bold mt-4 mb-2" {...props} />
                  ),
                  p: ({ ...props }) => (
                    <p className="text-base leading-7 mb-4" {...props} />
                  ),
                  ul: ({ ...props }) => (
                    <ul
                      className="list-disc list-inside mb-4 space-y-1"
                      {...props}
                    />
                  ),
                  ol: ({ ...props }) => (
                    <ol
                      className="list-decimal list-inside mb-4 space-y-1"
                      {...props}
                    />
                  ),
                  li: ({ ...props }) => <li className="text-base" {...props} />,
                  blockquote: ({ ...props }) => (
                    <blockquote
                      className="border-l-4 border-primary-600 pl-4 italic text-neutral-600 mb-4"
                      {...props}
                    />
                  ),
                }}
              >
                {notice.content}
              </ReactMarkdown>
            </div>
          </article>
        </Card>
      </div>
    </Container>
  );
}
