"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "@/app/components/LocaleProvider";
import { Modal } from "@/app/components/Modal";
import { localizePath } from "@/lib/i18n";
import { getRoommateText } from "@/lib/i18n/roommates";
import { ROOMMATE_REPORT_REASONS, recruitDeadlineMillis } from "@/lib/roommates";
import type { RoommatePost, RoommateReportReason } from "@/types/roommates";
import { ROOMMATE_REFRESH_INTERVAL_MS, jsonRequest, roommateErrorMessage, roommateRequest } from "./client";
import { HabitValues, inputClass, postTitle, primaryClass, secondaryClass } from "./RoommateShared";
import { useRoommateClock } from "./use-roommate-clock";

export default function RoommateDetail({ postId }: { postId: string }) {
  const locale = useLocale(); const text = getRoommateText(locale);
  const now = useRoommateClock();
  const query = useQuery({ queryKey: ["roommates", "post", postId], queryFn: ({ signal }) => roommateRequest<{ post: RoommatePost }>(`posts/${encodeURIComponent(postId)}`, { signal }), retry: false, gcTime: 0, staleTime: ROOMMATE_REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: (query) => Date.now() - query.state.errorUpdatedAt >= ROOMMATE_REFRESH_INTERVAL_MS });
  const [reportOpen, setReportOpen] = useState(false); const [reason, setReason] = useState<RoommateReportReason>("spam"); const [description, setDescription] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [reported, setReported] = useState(false); const [ended, setEnded] = useState(false);
  const post = query.data?.post;
  useEffect(() => {
    if (!post) return;
    let timer: number;
    const check = () => {
      const remaining = recruitDeadlineMillis(post.recruitUntil) - Date.now();
      if (remaining <= 0) { setEnded(true); setReportOpen(false); setDescription(""); }
      else timer = window.setTimeout(check, Math.min(2147483647, remaining));
    };
    check();
    return () => window.clearTimeout(timer);
  }, [post]);
  async function report(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await roommateRequest(`posts/${encodeURIComponent(postId)}/reports`, jsonRequest("POST", { reason, description })); setReported(true); setReportOpen(false); setDescription(""); }
    catch (err) { setError(roommateErrorMessage(err, text, locale)); } finally { setBusy(false); }
  }
  return <>
    {query.isPending && <p role="status" className="py-8 text-neutral-600">{text.loading}</p>}
    {query.error && <div role="alert" className="rounded-xl border border-neutral-200 bg-white p-5"><p>{roommateErrorMessage(query.error, text, locale)}</p><button type="button" className="mt-2 text-primary-700 underline" onClick={() => void query.refetch()}>{text.retry}</button></div>}
    {post && !query.error && (ended || post.status !== "recruiting" || recruitDeadlineMillis(post.recruitUntil) <= now ? <p role="status">{text.closed}</p> : <article className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6"><span className="text-sm font-medium text-primary-700">{text.statuses.recruiting}</span><h2 className="mt-2 text-xl font-bold">{postTitle(post, text)}</h2><p className="mt-2 text-neutral-600">{post.nickname} · {post.stayStart} – {post.stayEnd}</p><p className="mt-2 text-sm text-neutral-500">{text.deadline}: {post.recruitUntil}</p><h3 className="mb-3 mt-6 font-semibold">{text.habits}</h3><HabitValues habits={post.habits} />{post.description && <div className="mt-6"><h3 className="mb-2 font-semibold">{text.descriptionLabel}</h3><p className="whitespace-pre-wrap break-words text-neutral-700">{post.description}</p></div>}<div className="mt-6 flex flex-wrap gap-2"><a href={post.openChatUrl} target="_blank" rel="noopener noreferrer" className={primaryClass}>{text.contact}</a>{post.isOwner ? <Link prefetch={false} href={localizePath("/campus/roommates/me", locale)} className={secondaryClass}>{text.mine}</Link> : <button type="button" disabled={reported} onClick={() => setReportOpen(true)} className={secondaryClass}>{reported ? text.reportSent : text.report}</button>}</div></article>)}
    <p className="mt-6 text-sm leading-relaxed text-neutral-500">{text.scopeHint}</p>
    <Modal isOpen={reportOpen} title={text.reportTitle} description={text.reportHelp} onClose={() => { if (!busy) setReportOpen(false); }} size="sm"><form onSubmit={report} className="space-y-4"><label className="block text-sm font-medium">{text.reason}<select className={inputClass} value={reason} onChange={(event) => setReason(event.target.value as RoommateReportReason)}>{ROOMMATE_REPORT_REASONS.map((item) => <option key={item} value={item}>{text.reasons[item]}</option>)}</select></label><label className="block text-sm font-medium">{text.reportDescription}<textarea className={inputClass} maxLength={300} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} /></label>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<button disabled={busy} className={primaryClass}>{busy ? text.submitting : text.report}</button></form></Modal>
  </>;
}
