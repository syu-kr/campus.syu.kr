"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import type { AdminPostAction, AdminRoommateHold, AdminRoommatePost, AdminRoommateReport } from "@/lib/server/roommate-admin";
import { getRoommateText } from "@/lib/i18n/roommates";
import { formatDateTime, readAdminApiResponse } from "./AdminSubmissionDetail";
import { RoommatePostDetail, RoommateReportDetail, reportStatuses } from "./RoommateAdminDetail";

interface PostPage { items: AdminRoommatePost[]; holds: AdminRoommateHold[]; nextCursor: string | null; holdsNextCursor: string | null; recruitingCount: number; mailRequests: { dateUtc: string; count: number; partial: boolean } }
interface ReportPage { items: AdminRoommateReport[]; nextCursor: string | null; pendingCount: number }
const buttonClass = "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-primary-600 disabled:opacity-50";
const text = getRoommateText("ko");

export function RoommateAdmin({ user }: { user: User }) {
  const [view, setView] = useState<"reports" | "posts" | "holds">("reports");
  const [reportFilter, setReportFilter] = useState("pending");
  const [postFilter, setPostFilter] = useState("all");
  const [posts, setPosts] = useState<PostPage | null>(null);
  const [reports, setReports] = useState<ReportPage | null>(null);
  const [selectedReport, setSelectedReport] = useState<AdminRoommateReport | null>(null);
  const [selectedPost, setSelectedPost] = useState<AdminRoommatePost | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const identityRef = useRef(user.uid);
  useEffect(() => { identityRef.current = user.uid; return () => { identityRef.current = ""; }; }, [user.uid]);

  const request = useCallback(async <T,>(endpoint: string, init?: RequestInit) => {
    const token = await user.getIdToken();
    const response = await fetch(`/api/admin/${endpoint}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) }, cache: "no-store" });
    const data = await readAdminApiResponse<T & { error?: string }>(response);
    if (!response.ok) throw new Error(data.error || "룸메이트 관리 요청에 실패했습니다.");
    return data;
  }, [user]);

  const load = useCallback(async (signal?: AbortSignal) => {
    const identity = user.uid;
    setBusy(true); setError("");
    try {
      const [nextReports, nextPosts] = await Promise.all([request<ReportPage>(`roommate-reports?status=${reportFilter}`, { signal }), request<PostPage>(`roommate-posts?status=${postFilter}`, { signal })]);
      if (signal?.aborted || identityRef.current !== identity) return;
      setReports(nextReports); setPosts(nextPosts); setSelectedReport(null); setSelectedPost(null);
    } catch (failure) { if (!signal?.aborted && identityRef.current === identity) setError(failure instanceof Error ? failure.message : "목록을 불러오지 못했습니다."); }
    finally { if (!signal?.aborted && identityRef.current === identity) setBusy(false); }
  }, [postFilter, reportFilter, request, user.uid]);
  useEffect(() => { const controller = new AbortController(); setReports(null); setPosts(null); setSelectedReport(null); setSelectedPost(null); void load(controller.signal); return () => controller.abort(); }, [load]);

  const mutate = async (endpoint: string, body: unknown) => {
    setBusy(true); setError(""); setNotice("");
    try { await request(endpoint, { method: "PATCH", body: JSON.stringify(body) }); await load(); setNotice("조치와 감사 기록을 저장했습니다."); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "저장하지 못했습니다."); throw failure; }
    finally { setBusy(false); }
  };
  const more = async () => {
    setBusy(true); setError("");
    try {
      if (view === "reports" && reports?.nextCursor) { const next = await request<ReportPage>(`roommate-reports?status=${reportFilter}&cursor=${encodeURIComponent(reports.nextCursor)}`); setReports({ ...next, items: [...reports.items, ...next.items] }); }
      if (view === "posts" && posts?.nextCursor) { const next = await request<PostPage>(`roommate-posts?status=${postFilter}&cursor=${encodeURIComponent(posts.nextCursor)}`); setPosts({ ...next, items: [...posts.items, ...next.items] }); }
      if (view === "holds" && posts?.holdsNextCursor) { const next = await request<PostPage>(`roommate-posts?holdsCursor=${encodeURIComponent(posts.holdsNextCursor)}`); setPosts({ ...posts, holds: [...posts.holds, ...next.holds], holdsNextCursor: next.holdsNextCursor }); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "목록을 불러오지 못했습니다."); }
    finally { setBusy(false); }
  };
  const openPost = async (id: string) => {
    setBusy(true); setError("");
    try { const page = await request<PostPage>(`roommate-posts?id=${encodeURIComponent(id)}`); if (!page.items[0]) throw new Error("원문 글은 보존 기한에 따라 정리되었습니다. 신고 당시 근거는 신고 상세에서 확인하세요."); setSelectedPost(page.items[0]); setView("posts"); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "글을 불러오지 못했습니다."); }
    finally { setBusy(false); }
  };

  return (
    <section className="mb-8 rounded-lg border border-neutral-200 bg-neutral-50 p-4 sm:p-5" aria-labelledby="roommate-admin-heading" aria-busy={busy}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="roommate-admin-heading" className="text-xl font-bold text-neutral-950">룸메이트 관리</h2><p className="mt-1 text-sm text-neutral-600">미처리 신고와 근거 정리 예정일을 먼저 확인하세요. 게시판이 중지되어도 관리할 수 있습니다.</p></div><button type="button" disabled={busy} onClick={() => void load()} className={buttonClass}>룸메이트 새로고침</button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3"><p className="rounded-md border border-neutral-200 bg-white p-3 text-sm">미처리·검토 중 <strong className="block text-xl">{reports?.pendingCount ?? "—"}</strong></p><p className="rounded-md border border-neutral-200 bg-white p-3 text-sm">현재 모집 중 <strong className="block text-xl">{posts?.recruitingCount ?? "—"}</strong></p><div className="rounded-md border border-neutral-200 bg-white p-3 text-sm">오늘 사이트 인증 메일 요청 <strong className="block text-xl">{posts ? `${posts.mailRequests.count}${posts.mailRequests.partial ? "+" : ""}` : "—"}</strong><p className="mt-1 text-xs text-neutral-600">UTC 기준. 실패 포함 앱 요청 수이며 실제 수신·Firebase 잔여 한도가 아닙니다.</p></div></div>
      <div className="my-4 flex flex-wrap gap-2">{([["reports", "신고"], ["posts", "모집글"], ["holds", "작성 보류"]] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={view === value} className={`${buttonClass} ${view === value ? "border-primary-500 text-primary-700" : ""}`} onClick={() => setView(value)}>{label}</button>)}</div>
      {error && <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="mb-4 text-sm text-primary-700">{notice}</p>}{busy && <p role="status" className="mb-3 text-sm text-neutral-600">처리 중…</p>}
      {view === "reports" && <><label className="mb-3 block text-sm font-semibold">신고 상태<select value={reportFilter} onChange={(event) => setReportFilter(event.target.value)} className="ml-2 rounded-md border border-neutral-300 bg-white p-2"><option value="all">전체</option>{Object.entries(reportStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="grid gap-4 lg:grid-cols-2"><ul className="space-y-2">{reports?.items.map((item) => <li key={item.id}><button type="button" className={`${buttonClass} w-full text-left ${selectedReport?.id === item.id ? "border-primary-500" : ""}`} onClick={() => setSelectedReport(item)}><span className="block">{item.evidence.nickname} · {text.reasons[item.reason as keyof typeof text.reasons] || item.reason} · {reportStatuses[item.status]}</span><span className="mt-1 block text-xs font-normal text-neutral-600">접수 {formatDateTime(item.createdAt)} / 근거 정리 {formatDateTime(item.expiresAt)}</span></button></li>)}{reports && !reports.items.length && <li className="p-3 text-sm text-neutral-600">선택한 상태의 신고가 없습니다.</li>}</ul>{selectedReport && <RoommateReportDetail key={`${selectedReport.id}:${selectedReport.version}`} item={selectedReport} busy={busy} onSave={(status, memo) => mutate("roommate-reports", { id: selectedReport.id, expectedVersion: selectedReport.version, status, memo }).catch(() => undefined)} onOpenPost={() => void openPost(selectedReport.postId)} />}</div></>}
      {view === "posts" && <><label className="mb-3 block text-sm font-semibold">글 상태<select value={postFilter} onChange={(event) => setPostFilter(event.target.value)} className="ml-2 rounded-md border border-neutral-300 bg-white p-2"><option value="all">전체</option>{(["recruiting", "hidden", "completed", "deleted"] as const).map((value) => <option key={value} value={value}>{text.statuses[value]}</option>)}</select></label><div className="grid gap-4 lg:grid-cols-2"><ul className="space-y-2">{posts?.items.map((item) => <li key={item.id}><button type="button" className={`${buttonClass} w-full text-left ${selectedPost?.id === item.id ? "border-primary-500" : ""}`} onClick={() => setSelectedPost(item)}>{text.dorms[item.dorm]} {item.roomSize}인실 · {item.nickname} · {text.statuses[item.status]}<span className="mt-1 block text-xs font-normal text-neutral-600">마감 {item.recruitUntil} / 등록 {formatDateTime(item.createdAt)}</span></button></li>)}{posts && !posts.items.length && <li className="p-3 text-sm text-neutral-600">현재 페이지에 보존 중인 글이 없습니다. 다음 후보가 있으면 더 보기를 눌러주세요.</li>}</ul>{selectedPost && <RoommatePostDetail key={`${selectedPost.id}:${selectedPost.version}`} item={selectedPost} busy={busy} onAction={(action: AdminPostAction, reason) => mutate("roommate-posts", { id: selectedPost.id, expectedVersion: selectedPost.version, action, reason }).catch(() => undefined)} />}</div></>}
      {view === "holds" && <><label className="block text-sm font-semibold">연장 사유 (필수, 최대 300자)<textarea maxLength={300} rows={2} value={holdReason} onChange={(event) => setHoldReason(event.target.value)} className="mt-1 block w-full rounded-md border border-neutral-300 p-2" /></label><p className="mt-2 text-xs text-neutral-600">글 정리 이후에도 보류를 관리할 수 있습니다. 보류 해제는 숨김 글을 복구하지 않습니다.</p><ul className="mt-3 space-y-3">{posts?.holds.map((hold) => <li key={hold.ownerKey} className="rounded-md border border-neutral-200 bg-white p-3 text-sm"><p>종료 {formatDateTime(hold.holdUntil)} · {hold.reason}</p><p className="mt-1 break-all text-xs text-neutral-600">작성자 식별 키 {hold.ownerKey}</p><div className="mt-2 flex flex-wrap gap-2"><button disabled={busy} type="button" className={buttonClass} onClick={() => void mutate("roommate-posts", { ownerKey: hold.ownerKey, expectedOwnerVersion: hold.version, action: "release_hold" }).catch(() => undefined)}>보류 해제</button><button disabled={busy || !holdReason.trim()} type="button" className={buttonClass} onClick={() => void mutate("roommate-posts", { ownerKey: hold.ownerKey, expectedOwnerVersion: hold.version, action: "extend_hold", reason: holdReason }).catch(() => undefined)}>30일 연장</button></div></li>)}{posts && !posts.holds.length && <li className="text-sm text-neutral-600">유효한 작성 보류가 없습니다.</li>}</ul></>}
      {(view === "reports" ? reports?.nextCursor : view === "posts" ? posts?.nextCursor : posts?.holdsNextCursor) && <button type="button" className={`${buttonClass} mt-4`} disabled={busy} onClick={() => void more()}>더 보기</button>}
    </section>
  );
}
