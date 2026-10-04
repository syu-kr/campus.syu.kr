"use client";

import { useState } from "react";
import { Modal } from "@/app/components/Modal";
import { getRoommateText } from "@/lib/i18n/roommates";
import type { AdminPostAction, AdminRoommatePost, AdminRoommateReport, AdminReportStatus } from "@/lib/server/roommate-admin";
import { formatDateTime } from "./AdminSubmissionDetail";

export const reportStatuses: Record<AdminReportStatus, string> = { pending: "미처리", reviewing: "검토 중", done: "처리 완료", rejected: "기각" };
const text = getRoommateText("ko");
const buttonClass = "rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-primary-600 disabled:opacity-50";

export function RoommateReportDetail({ item, busy, onSave, onOpenPost }: { item: AdminRoommateReport; busy: boolean; onSave: (status: AdminReportStatus, memo: string) => Promise<void>; onOpenPost: () => void }) {
  const [status, setStatus] = useState(item.status);
  const [memo, setMemo] = useState(item.memo);
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-5" aria-label="룸메이트 신고 상세">
      <h3 className="font-bold text-neutral-950">{text.reasons[item.reason as keyof typeof text.reasons] || item.reason}</h3>
      <p className="mt-2 text-sm text-neutral-600">접수 {formatDateTime(item.createdAt)} · 근거 정리 예정 {formatDateTime(item.expiresAt)}</p>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm">{item.description || "추가 설명 없음"}</p>
      <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm">
        <h4 className="font-semibold">접수 당시 글 (version {item.evidence.version})</h4>
        <p className="mt-2">{item.evidence.nickname} · {text.dorms[item.evidence.dorm as keyof typeof text.dorms] || item.evidence.dorm} {item.evidence.roomSize}인실</p>
        <p className="mt-2 whitespace-pre-wrap break-words">{item.evidence.description || "소개 없음"}</p>
        <a href={item.evidence.openChatUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block break-all text-primary-700 underline">접수 당시 오픈채팅 링크</a>
      </div>
      <button type="button" onClick={onOpenPost} disabled={busy} className={`${buttonClass} mt-3`}>현재 글 관리 열기</button>
      <form className="mt-4 space-y-3 border-t border-neutral-200 pt-4" onSubmit={(event) => { event.preventDefault(); void onSave(status, memo); }}>
        <label className="block text-sm font-semibold">신고 처리 상태<select className="mt-1 block w-full rounded-md border border-neutral-300 p-2 font-normal" value={status} onChange={(event) => setStatus(event.target.value as AdminReportStatus)}>{Object.entries(reportStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="block text-sm font-semibold">처리 메모 (선택, 최대 300자)<textarea value={memo} onChange={(event) => setMemo(event.target.value)} maxLength={300} rows={3} className="mt-1 block w-full rounded-md border border-neutral-300 p-2 font-normal" /></label>
        <p className="text-xs text-neutral-600">신고 처리와 글 숨김은 별도 조치입니다. 메모를 바꿔도 근거 보존 기한은 연장되지 않습니다.</p>
        <button disabled={busy} type="submit" className={buttonClass}>{busy ? "처리 중…" : "신고 처리 저장"}</button>
      </form>
    </section>
  );
}

export function RoommatePostDetail({ item, busy, onAction }: { item: AdminRoommatePost; busy: boolean; onAction: (action: AdminPostAction, reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [action, setAction] = useState<AdminPostAction | null>(null);
  const actionLabels = { hide: "글 숨김 · 작성 30일 보류", restore: "숨김 글 복구", delete: "글 삭제", release_hold: "보류 해제", extend_hold: "작성 보류 30일 연장" };
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-5" aria-label="룸메이트 글 상세">
      <h3 className="font-bold">{text.dorms[item.dorm]} {item.roomSize}인실 · {item.nickname}</h3>
      <p className="mt-2 text-sm">{text.statuses[item.status]} · version {item.version} · {item.roommatesNeeded}명 모집</p>
      <p className="mt-2 text-sm text-neutral-600">거주 {item.stayStart} ~ {item.stayEnd} · 모집 마감 {item.recruitUntil}</p>
      <p className="mt-1 text-sm text-neutral-600">원문 정리 예정 {formatDateTime(item.expiresAt)}</p>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">{Object.entries(text.habitLabels).map(([key, label]) => { const value = item.habits[key as keyof typeof item.habits]; const values = Array.isArray(value) ? value : value ? [value] : []; return <div key={key}><dt className="font-semibold">{label}</dt><dd className="text-neutral-600">{values.length ? values.map((option) => text.options[option as keyof typeof text.options]).join(", ") : text.unspecified}</dd></div>; })}</dl>
      <p className="mt-4 whitespace-pre-wrap break-words text-sm">{item.description || "소개 없음"}</p>
      <a href={item.openChatUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block break-all text-sm text-primary-700 underline">오픈채팅 링크</a>
      {item.holdUntil && <p className="mt-4 rounded-md bg-orange-50 p-3 text-sm text-orange-900">작성 보류 종료 {formatDateTime(item.holdUntil)} · {item.holdReason}</p>}
      <label className="mt-4 block text-sm font-semibold">조치 사유 (숨김 시 필수, 최대 300자)<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} rows={2} className="mt-1 block w-full rounded-md border border-neutral-300 p-2 font-normal" /></label>
      <div className="mt-3 flex flex-wrap gap-2">{(["hide", "restore", "delete"] as const).map((value) => <button type="button" key={value} className={buttonClass} disabled={busy || (value === "hide" && (item.status !== "recruiting" || !reason.trim())) || (value === "restore" && item.status !== "hidden") || (value === "delete" && item.status === "deleted")} onClick={() => setAction(value)}>{actionLabels[value]}</button>)}</div>
      <p className="mt-3 text-xs text-neutral-600">복구는 마감 전 숨김 글에만 가능하며 다른 활성 글이 없어야 합니다. 글 복구는 작성 보류를 해제하지 않습니다. 완료·삭제 글은 복구할 수 없습니다.</p>
      <Modal isOpen={Boolean(action)} title={action ? `${actionLabels[action]} 조치를 진행할까요?` : "조치 확인"} onClose={() => { if (!busy) setAction(null); }} size="sm">
        <p className="text-sm text-neutral-700">{action === "delete" ? "연락과 열람을 차단하고 이 글은 복구할 수 없습니다." : action === "hide" ? "글을 숨기고 작성자를 기본 30일 보류합니다. 기존 보류를 단축하지 않습니다." : "글만 복구합니다. 작성 보류는 별도 해제해야 합니다."}</p>
        <div className="mt-5 flex justify-end gap-2"><button type="button" className={buttonClass} disabled={busy} onClick={() => setAction(null)}>취소</button><button type="button" className={buttonClass} disabled={busy} onClick={() => { if (action) void onAction(action, reason).then(() => setAction(null)); }}>조치 확인</button></div>
      </Modal>
    </section>
  );
}
