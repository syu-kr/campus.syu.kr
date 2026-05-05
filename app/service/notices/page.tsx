import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getAllServiceNotices } from "@/lib/serviceNotices";
import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";

export const metadata: Metadata = {
  title: "공지사항",
  description: "SYU CAMPUS 서비스 공지사항",
};

export default async function ServiceNoticesPage() {
  const notices = await getAllServiceNotices();

  return (
    <Container>
      <div className="py-6 md:py-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-2">
            서비스 공지
          </h1>
          <p className="text-neutral-600">
            SYU CAMPUS의 소식과 서비스 업데이트를 확인하세요.
          </p>
        </div>

        {notices.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-neutral-600">아직 서비스 공지가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notices.map((notice) => (
              <Link
                key={notice.slug}
                href={`/service/notices/${notice.slug}`}
                prefetch={false}
              >
                <div className="mb-2">
                  <Card className="hover:shadow-md transition-shadow cursor-pointer border border-neutral-200">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base md:text-lg font-semibold text-neutral-900 mb-2 line-clamp-2">
                          {notice.title}
                        </h3>
                        <p className="text-sm text-neutral-600 mb-3 line-clamp-2">
                          {notice.excerpt}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-neutral-500">
                          <span>{notice.author}</span>
                          <span>•</span>
                          <span>
                            {new Date(notice.date).toLocaleDateString("ko-KR")}
                          </span>
                        </div>
                      </div>
                      <svg
                        className="w-5 h-5 flex-shrink-0 text-neutral-400 mt-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </Card>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Container>
  );
}
