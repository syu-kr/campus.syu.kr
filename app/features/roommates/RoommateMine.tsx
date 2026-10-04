"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "@/app/components/LocaleProvider";
import { Modal } from "@/app/components/Modal";
import { ContactModal } from "@/app/components/ContactModal";
import { localizePath } from "@/lib/i18n";
import { getRoommateText } from "@/lib/i18n/roommates";
import type { RoommateMyPost, RoommatePostSubmission } from "@/types/roommates";
import { ROOMMATE_REFRESH_INTERVAL_MS, jsonRequest, roommateErrorMessage, roommateRequest } from "./client";
import { HabitValues, postTitle, primaryClass, secondaryClass } from "./RoommateShared";
import RoommateForm from "./RoommateForm";
import { useRoommateClock } from "./use-roommate-clock";

export default function RoommateMine() {
  const locale = useLocale(); const text = getRoommateText(locale); const queryClient = useQueryClient();
  const now = useRoommateClock();
  const query = useQuery({ queryKey: ["roommates", "mine"], queryFn: ({ signal }) => roommateRequest<RoommateMyPost>("posts/me", { signal }), retry: false, gcTime: 0, staleTime: ROOMMATE_REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: (query) => Date.now() - query.state.errorUpdatedAt >= ROOMMATE_REFRESH_INTERVAL_MS });
  const [editing, setEditing] = useState(false); const [action, setAction] = useState<"complete" | "delete" | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [contactOpen, setContactOpen] = useState(false);
  const post = query.data?.post; const held = !!query.data?.holdUntil && Date.parse(query.data.holdUntil) > now;
  async function refresh() { setEditing(false); setAction(null); await queryClient.invalidateQueries({ queryKey: ["roommates"] }); }
  async function update(input: RoommatePostSubmission) {
    if (!post) return;
    await roommateRequest(`posts/${encodeURIComponent(post.id)}`, jsonRequest("PATCH", { action: "update", expectedVersion: post.version, ...input })); await refresh();
  }
  async function confirm() {
    if (!post || !action) return; setBusy(true); setError("");
    try { await roommateRequest(`posts/${encodeURIComponent(post.id)}`, jsonRequest(action === "delete" ? "DELETE" : "PATCH", { ...(action === "complete" ? { action: "complete" } : {}), expectedVersion: post.version })); await refresh(); }
    catch (err) { setError(roommateErrorMessage(err, text, locale)); if ((err as { status?: number }).status === 409) void query.refetch(); } finally { setBusy(false); }
  }
  return <>
    {query.isPending && <p role="status">{text.loading}</p>}
    {query.error && <div role="alert"><p>{roommateErrorMessage(query.error, text, locale)}</p><button type="button" className="mt-2 text-primary-700 underline" onClick={() => void query.refetch()}>{text.retry}</button></div>}
    {held && <aside className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold text-amber-900">{text.hold}</h2><p className="mt-2 text-sm text-amber-900">{text.holdHelp}</p><p className="mt-2 text-sm text-amber-900">{text.holdUntil}: {new Intl.DateTimeFormat(locale, { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(query.data!.holdUntil!))}</p>{query.data?.holdReason && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-amber-900">{query.data.holdReason}</p>}<button type="button" onClick={() => setContactOpen(true)} className="mt-3 text-sm underline">{text.inquiry}</button></aside>}
    {!query.isPending && !query.error && !post && <div className="rounded-xl border border-neutral-200 bg-white p-6"><p className="text-neutral-600">{text.noMine}</p>{!held && <Link prefetch={false} href={localizePath("/campus/roommates/new", locale)} className={`${primaryClass} mt-4`}>{text.create}</Link>}</div>}
    {post && !query.error && (editing && !held && post.status === "recruiting" ? <RoommateForm key={`${post.id}:${post.version}`} post={post} onSubmit={update} onCancel={() => setEditing(false)} /> : <article className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6"><p className="text-sm font-medium text-neutral-600">{text.statuses[post.status]}</p><h2 className="mt-2 text-xl font-bold">{postTitle(post, text)}</h2><p className="mt-2 text-neutral-600">{post.nickname} · {post.stayStart} – {post.stayEnd}</p><p className="mb-5 mt-2 text-sm text-neutral-500">{text.deadline}: {post.recruitUntil}</p><HabitValues habits={post.habits} />{post.description && <p className="mt-5 whitespace-pre-wrap break-words text-neutral-700">{post.description}</p>}<div className="mt-5 flex flex-wrap gap-2">{post.status === "recruiting" && <>{!held && <button type="button" onClick={() => setEditing(true)} className={primaryClass}>{text.edit}</button>}<button type="button" onClick={() => setAction("complete")} className={secondaryClass}>{text.complete}</button></>}{post.status !== "deleted" && <button type="button" onClick={() => setAction("delete")} className={secondaryClass}>{text.delete}</button>}{post.status !== "recruiting" && !held && <Link prefetch={false} href={localizePath("/campus/roommates/new", locale)} className={primaryClass}>{text.create}</Link>}</div></article>)}
    <p className="mt-5 text-sm leading-relaxed text-neutral-500">{text.termsHint}</p>
    <Modal isOpen={!!action} title={action === "delete" ? text.deleteTitle : text.completeTitle} description={action === "delete" ? text.deleteHelp : text.completeHelp} onClose={() => { if (!busy) setAction(null); }} size="sm">{error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}<div className="flex gap-2"><button type="button" disabled={busy} onClick={confirm} className={primaryClass}>{busy ? text.submitting : action === "delete" ? text.delete : text.complete}</button><button type="button" disabled={busy} onClick={() => setAction(null)} className={secondaryClass}>{text.cancel}</button></div></Modal>
    <ContactModal isOpen={contactOpen} onClose={() => setContactOpen(false)} />
  </>;
}
