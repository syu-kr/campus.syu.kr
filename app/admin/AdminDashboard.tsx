"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import type { AdminContentResponse, ManagedContentRecord } from "@/types/managed-content";
import type { SubmissionStatus } from "@/types/submissions";
import { Button } from "@/app/components/Button";
import { ManagedContentManager, publicationLabel } from "./ManagedContentManager";
import { getAdminErrorMessage, readAdminApiResponse } from "./AdminSubmissionDetail";
import "@/app/styles/m3/admin-dashboard.css";

const sections = [
  ["overview", "대시보드"], ["notices", "서비스 공지"], ["banners", "배너"],
  ["submissions", "문의·제보"], ["roommates", "룸메이트"],
] as const;
type Section = typeof sections[number][0];

export function AdminDashboard({ user, counts, children, roommates, refreshKey = 0, countsReady = true, submissionScope = "문의·제보", onAccessLost }: {
  user: User; counts: Record<SubmissionStatus, number>; children: ReactNode; roommates: ReactNode; refreshKey?: number; countsReady?: boolean; submissionScope?: string; onAccessLost?: () => void;
}) {
  const [section, setSection] = useState<Section>("overview");
  const [data, setData] = useState<AdminContentResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [accessLost, setAccessLost] = useState(false);
  useEffect(() => { setData(null); setSection("overview"); setAccessLost(false); }, [user]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort("timeout");
      if (!disposed) { setError("관리 콘텐츠를 불러오지 못했습니다. 다시 시도해 주세요."); setLoading(false); }
    }, 20_000);
    setLoading(true); setError("");
    void (async () => {
      try {
        const token = await user.getIdToken();
        if (controller.signal.aborted) return;
        const response = await fetch("/api/admin/content", { cache: "no-store", signal: controller.signal, headers: { Authorization: `Bearer ${token}` } });
        if (controller.signal.aborted) return;
        if (response.status === 401 || response.status === 403) { setData(null); setAccessLost(true); onAccessLost?.(); return; }
        const result = await readAdminApiResponse<AdminContentResponse>(response);
        if (!Array.isArray(result.items) || typeof result.mediaAvailable !== "boolean") throw new Error("Invalid content response");
        if (!controller.signal.aborted) setData(result);
      } catch (failure) {
        if (!disposed && !controller.signal.aborted) setError(getAdminErrorMessage(failure, "관리 콘텐츠를 불러오지 못했습니다. 다시 시도해 주세요."));
      } finally { clearTimeout(timeout); if (!disposed && !controller.signal.aborted) setLoading(false); }
    })();
    return () => { disposed = true; clearTimeout(timeout); controller.abort(); };
  }, [user, attempt, refreshKey, onAccessLost]);
  const saveItem = useCallback((item: ManagedContentRecord) => setData(current => current ? { ...current, items: [item, ...current.items.filter(row => row.id !== item.id)] } : current), []);
  const notices = data?.items.filter(item => item.draft.kind === "notice");
  const banners = data?.items.filter(item => item.draft.kind === "banner");

  if (accessLost) return <p role="alert" className="admin-content-error">관리자 세션 또는 권한을 확인하지 못했습니다. 다시 로그인해 주세요.</p>;

  return <div className="admin-dashboard">
    <nav className="admin-dashboard-nav" aria-label="관리자 메뉴">
      {sections.map(([value, label]) => <button type="button" key={value} aria-current={section === value ? "page" : undefined} onClick={() => setSection(value)}>{label}</button>)}
      <a href="/" target="_blank" rel="noopener noreferrer">사이트 보기 ↗</a>
    </nav>
    <div className="admin-dashboard-main">
      <div hidden={section !== "overview"}>
        <h2>운영 현황</h2>
        <p className="admin-dashboard-help">게시할 콘텐츠와 확인이 필요한 접수 내역을 관리하세요.</p>
        <div className="admin-dashboard-metrics">
          <button type="button" onClick={() => setSection("notices")}><span>서비스 공지</span><strong>{notices?.length ?? "—"}</strong><small>초안·게시·보관 포함</small></button>
          <button type="button" onClick={() => setSection("banners")}><span>게시 중 배너</span><strong>{banners?.filter(item => publicationLabel(item, now) === "게시 중").length ?? "—"}</strong><small>위치별 우선순위 상위 3개 노출</small></button>
          <button type="button" onClick={() => setSection("submissions")}><span>대기 중 {submissionScope}</span><strong>{countsReady ? counts.pending : "—"}</strong><small>현재 유형의 접수 내역</small></button>
          <button type="button" onClick={() => setSection("banners")}><span>예약 콘텐츠</span><strong>{data?.items.filter(item => publicationLabel(item, now) === "예약").length ?? "—"}</strong><small>시작 시간에 맞춰 노출</small></button>
        </div>
        <section className="admin-dashboard-start">
          <h3>콘텐츠 관리</h3><p>초안을 저장해도 현재 게시본은 바뀌지 않습니다. 미리보기를 확인한 뒤 게시하세요.</p>
          <div><Button onClick={() => setSection("notices")}>공지 관리</Button><Button variant="secondary" onClick={() => setSection("banners")}>배너 관리</Button></div>
        </section>
      </div>
      {(section === "overview" || section === "notices" || section === "banners") && <>
        {loading && <p role="status">관리 콘텐츠를 확인하는 중입니다.</p>}
        {error && <div className="admin-content-error" role="alert"><p>{error}</p><Button variant="secondary" onClick={() => setAttempt(value => value + 1)}>관리 콘텐츠 다시 불러오기</Button></div>}
      </>}
      {data && <>
        <div hidden={section !== "notices"}><ManagedContentManager kind="notice" user={user} items={data.items} mediaAvailable={data.mediaAvailable} onSaved={saveItem} onReload={() => setAttempt(value => value + 1)} onAccessLost={() => { setData(null); setAccessLost(true); onAccessLost?.(); }} /></div>
        <div hidden={section !== "banners"}><ManagedContentManager kind="banner" user={user} items={data.items} mediaAvailable={data.mediaAvailable} onSaved={saveItem} onReload={() => setAttempt(value => value + 1)} onAccessLost={() => { setData(null); setAccessLost(true); onAccessLost?.(); }} /></div>
      </>}
      <div hidden={section !== "submissions"}>{children}</div>
      {section === "roommates" && roommates}
    </div>
  </div>;
}
