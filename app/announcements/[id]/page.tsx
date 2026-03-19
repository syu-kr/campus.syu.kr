import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchAnnouncements } from "@/lib/api";
import { Container } from "@/app/components/Container";
import { Badge } from "@/app/components/Badge";
import { Metadata } from "next";

interface AnnouncementDetailProps {
  params: {
    id: string;
  };
}

export async function generateMetadata({
  params,
}: AnnouncementDetailProps): Promise<Metadata> {
  const announcements = await fetchAnnouncements();
  const announcement = announcements.find((a) => a.id === params.id);

  if (!announcement) {
    return {
      title: "공지사항 없음",
    };
  }

  return {
    title: announcement.title,
    description: announcement.content.substring(0, 100),
  };
}

async function getAnnouncementDetail(id: string) {
  const announcements = await fetchAnnouncements();
  return announcements.find((a) => a.id === id);
}

async function getRelatedAnnouncements(
  category: string,
  currentId: string,
  limit: number = 3,
) {
  const announcements = await fetchAnnouncements(category);
  return announcements.filter((a) => a.id !== currentId).slice(0, limit);
}

export default async function AnnouncementDetail({
  params,
}: AnnouncementDetailProps) {
  const announcement = await getAnnouncementDetail(params.id);

  if (!announcement) {
    notFound();
  }

  const relatedAnnouncements = await getRelatedAnnouncements(
    announcement.category,
    announcement.id,
  );

  const categoryLabel =
    {
      all: "전체",
      academic: "학사",
      scholarship: "장학",
      campus: "캠퍼스",
      admin: "행정",
      activity: "행사",
    }[announcement.category] || announcement.category;

  return (
    <Container>
      <div className="py-8">
        {/* Back Navigation */}
        <Link
          href="/academic/announcements"
          className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-6 transition-colors"
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
          공지사항 목록으로
        </Link>

        {/* Main Content */}
        <article className="bg-white rounded-lg">
          {/* Header */}
          <div className="border-b border-neutral-200 p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <Badge>{categoryLabel}</Badge>
                <h1 className="text-3xl font-bold text-neutral-900 mt-3 leading-tight">
                  {announcement.title}
                </h1>
              </div>
            </div>

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-600">
              <div className="flex items-center gap-2">
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
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <span>{announcement.author}</span>
              </div>
              <div className="flex items-center gap-2">
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
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span>
                  {new Date(announcement.date).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
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
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                <span>{announcement.views.toLocaleString()} 조회</span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 prose prose-sm max-w-none text-neutral-700 whitespace-pre-wrap">
            {announcement.content}
          </div>

          {/* Divider */}
          <div className="border-t border-neutral-200" />

          {/* Footer Info */}
          <div className="bg-neutral-50 p-6 text-sm text-neutral-600">
            <p>이 글이 도움이 되었나요?</p>
            <div className="flex gap-2 mt-3">
              <button className="px-4 py-2 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-100 transition-colors">
                👍 도움이 됨
              </button>
              <button className="px-4 py-2 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-100 transition-colors">
                👎 도움이 안 됨
              </button>
            </div>
          </div>
        </article>

        {/* Related Announcements */}
        {relatedAnnouncements.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold text-neutral-900 mb-6">
              관련 공지사항
            </h2>
            <div className="space-y-3">
              {relatedAnnouncements.map((related) => (
                <Link
                  key={related.id}
                  href={`/announcements/${related.id}`}
                  className="block p-4 bg-white border border-neutral-200 rounded-lg hover:border-primary-400 hover:shadow-card transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {related.isImportant && (
                        <Badge className="mb-2 bg-red-100 text-red-700">
                          중요
                        </Badge>
                      )}
                      <p className="font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors truncate">
                        {related.title}
                      </p>
                      <p className="text-sm text-neutral-500 mt-1">
                        {new Date(related.date).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                    <svg
                      className="w-4 h-4 text-neutral-400 group-hover:text-primary-600 transition-colors flex-shrink-0 mt-1"
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
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </Container>
  );
}
