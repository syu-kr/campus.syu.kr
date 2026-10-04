"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocale } from "@/app/components/LocaleProvider";
import { Button } from "@/app/components/Button";
import { localizePath } from "@/lib/i18n";
import { getRoommateText } from "@/lib/i18n/roommates";
import { RoommateError, koreaDate } from "@/lib/roommates";
import type { RoommatePostFilters, RoommatePostList } from "@/types/roommates";
import { ROOMMATE_REFRESH_INTERVAL_MS, RoommateApiError, roommateErrorMessage, roommateRequest } from "./client";
import { HabitSummary, postTitle, secondaryClass } from "./RoommateShared";
import RoommateFilters from "./RoommateFilters";
import { readRoommateFilterUrl, serializeRoommateFilters } from "./roommate-filters";
import { useRoommateClock } from "./use-roommate-clock";

export default function RoommateList() {
  const text = getRoommateText(useLocale());
  return <Suspense fallback={<p role="status">{text.loading}</p>}><RoommateListContent /></Suspense>;
}

function RoommateListContent() {
  const locale = useLocale(); const text = getRoommateText(locale); const now = useRoommateClock();
  const pathname = usePathname(); const search = useSearchParams().toString();
  const urlState = useMemo(() => {
    try { return { ...readRoommateFilterUrl(search), error: null }; }
    catch (error) { return { filters: {}, query: "", cursor: "", error: error instanceof RoommateError ? new RoommateApiError(error.status, error.code, error.field) : error }; }
  }, [search]);
  const query = useInfiniteQuery({
    queryKey: ["roommates", "list", urlState.query, urlState.cursor], initialPageParam: urlState.cursor,
    enabled: !urlState.error,
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams(urlState.query); if (pageParam) params.set("cursor", pageParam);
      return roommateRequest<RoommatePostList>(`posts?${params}`, { signal });
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    retry: false, gcTime: 0, staleTime: ROOMMATE_REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: (query) => Date.now() - query.state.errorUpdatedAt >= ROOMMATE_REFRESH_INTERVAL_MS,
  });
  const error = urlState.error ?? query.error;
  const posts = error ? [] : [...new Map((query.data?.pages.flatMap((page) => page.items) ?? []).map((post) => [post.id, post])).values()]
    .filter((post) => post.status === "recruiting" && post.recruitUntil >= koreaDate(now));

  function apply(filters: RoommatePostFilters) {
    const params = serializeRoommateFilters(filters);
    // New conditions start from the first page. Next keeps native history and URL hooks in sync.
    window.history.pushState(null, "", `${pathname}${params.size ? `?${params}` : ""}`);
  }

  return <>
    <RoommateFilters key={search} initialFilters={urlState.filters} onApply={apply} />
    {query.isPending && !error && <div role="status" aria-label={text.loading} className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl bg-neutral-100" />)}</div>}
    {error && <div role="alert" className="mb-4 rounded-xl border border-neutral-200 bg-white p-4"><p>{roommateErrorMessage(error, text, locale)}</p>{!urlState.error && <Button variant="secondary" onClick={() => void query.refetch()} className="mt-2">{text.retry}</Button>}</div>}
    {!query.isPending && !error && posts.length === 0 && <p role="status" className="rounded-xl border border-neutral-200 bg-white p-6 text-neutral-600">{query.hasNextPage ? text.moreCandidates : text.empty}</p>}
    <div className="space-y-3">{posts.map((post) => <article key={post.id} className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm"><span className="rounded-md bg-primary-50 px-2 py-1 font-medium text-primary-700">{text.statuses.recruiting}</span><span className="text-neutral-500">{post.nickname}</span></div>
      <h2 className="text-lg font-semibold"><Link prefetch={false} href={localizePath(`/campus/roommates/${post.id}`, locale)} className="text-neutral-900 hover:text-primary-700 hover:underline">{postTitle(post, text)}</Link></h2>
      <p className="mt-2 text-sm text-neutral-600">{post.stayStart} – {post.stayEnd}</p><p className="mt-1 text-sm text-neutral-500">{text.deadline}: {post.recruitUntil}</p>
      <HabitSummary habits={post.habits} />
    </article>)}</div>
    {query.hasNextPage && !error && <button type="button" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()} className={`${secondaryClass} mt-5 w-full`}>{query.isFetchingNextPage ? text.loading : text.more}</button>}
    <p className="mt-6 text-sm leading-relaxed text-neutral-500">{text.scopeHint}</p>
  </>;
}
