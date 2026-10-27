"use client";

import { Children, cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import ReactMarkdown from "react-markdown";
import type { ContentAction, ManagedBannerDraft, ManagedContentDraft, ManagedContentKind, ManagedContentRecord } from "@/types/managed-content";
import { Button } from "@/app/components/Button";
import { Modal } from "@/app/components/Modal";
import { M3Select } from "@/app/components/M3Select";
import { getAdminErrorMessage, readAdminApiResponse } from "./AdminSubmissionDetail";

export function publicationLabel(item: ManagedContentRecord, now = Date.now()) {
  if (item.archived) return "보관";
  if (!item.published) return "초안";
  if (item.published.startsAt && Date.parse(item.published.startsAt) > now) return "예약";
  if (item.published.endsAt && Date.parse(item.published.endsAt) <= now) return "종료";
  return "게시 중";
}
export function toSeoulInput(value: string | null) { return value ? new Date(Date.parse(value) + 9 * 3_600_000).toISOString().slice(0, 16) : ""; }
export function fromSeoulInput(value: string) { const date = value && new Date(`${value}+09:00`); return date && Number.isFinite(date.getTime()) ? date.toISOString() : null; }
function fresh(kind: ManagedContentKind): ManagedContentRecord {
  const uuid = crypto.randomUUID();
  const draft: ManagedContentDraft = kind === "notice"
    ? { kind, slug: `notice-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${uuid.slice(0, 8)}`, title: "", summary: "", content: "", startsAt: null, endsAt: null }
    : { kind, category: "event", placement: "home", title: "", description: "", imageDesktop: "", imageMobile: "", imageAlt: "", link: "", priority: 0, dismissible: true, startsAt: null, endsAt: null };
  return { id: kind === "banner" ? uuid : "", draft, published: null, publishedAt: null, revision: 0, updatedAt: new Date().toISOString(), archived: false, source: "database" };
}
const copy = { notice: "공지", banner: "배너" };
const actionNames: Record<Exclude<ContentAction, "save">, string> = { publish: "게시", unpublish: "노출 중단", archive: "보관", restore: "복원" };

export function ManagedContentManager({ kind, user, items, mediaAvailable, onSaved, onReload, onAccessLost }: {
  kind: ManagedContentKind; user: User; items: ManagedContentRecord[]; mediaAvailable: boolean;
  onSaved: (item: ManagedContentRecord) => void; onReload: () => void; onAccessLost?: () => void;
}) {
  const [editing, setEditing] = useState<ManagedContentRecord | null>(null);
  const [draft, setDraft] = useState<ManagedContentDraft | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Exclude<ContentAction, "save"> | null>(null);
  const [switchTo, setSwitchTo] = useState<ManagedContentRecord | null>(null);
  const [englishReviewed, setEnglishReviewed] = useState(false);
  const [accessLost, setAccessLost] = useState(false);
  const active = useRef(false); const request = useRef<AbortController | null>(null);
  const requestTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    active.current = true; setEditing(null); setDraft(null); setError(""); setNotice(""); setConfirm(null); setSwitchTo(null); setBusy(false); setAccessLost(false);
    return () => { active.current = false; request.current?.abort(); if (requestTimeout.current) clearTimeout(requestTimeout.current); requestTimeout.current = null; };
  }, [user]);
  const dirty = editing && draft && JSON.stringify(editing.draft) !== JSON.stringify(draft);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function choose(item: ManagedContentRecord) {
    if (dirty) { setSwitchTo(item); return; }
    setEditing(item); setDraft(structuredClone(item.draft)); setError(""); setNotice(""); setEnglishReviewed(false);
  }
  function update(patch: Partial<ManagedContentDraft>) { setDraft(current => current ? { ...current, ...patch } as ManagedContentDraft : current); setEnglishReviewed(false); setNotice(""); }
  async function mutate(action: ContentAction) {
    if (!editing || !draft || busy) return;
    if (!editing.id && draft.kind === "notice" && items.some(item => item.id === draft.slug)) { setError("이미 사용 중인 공지 주소입니다. 다른 주소를 입력하거나 기존 공지를 선택해 수정해 주세요."); return; }
    const controller = new AbortController(); request.current = controller; setBusy(true); setError(""); setNotice("");
    const timeout = setTimeout(() => {
      controller.abort("timeout");
      if (active.current && request.current === controller) { setError("처리 결과를 확인하지 못했습니다. 입력 내용은 유지했습니다. 목록을 다시 확인해 주세요."); setBusy(false); request.current = null; requestTimeout.current = null; }
    }, 20_000);
    requestTimeout.current = timeout;
    try {
      const token = await user.getIdToken();
      if (!active.current || controller.signal.aborted) return;
      const response = await fetch("/api/admin/content", { method: "POST", signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id || (draft.kind === "notice" ? draft.slug : ""), expectedRevision: editing.revision, action, ...(["save", "publish"].includes(action) ? { draft } : {}), ...(action === "publish" && draft.kind === "notice" && draft.english && englishReviewed ? { englishReviewed: true } : {}) }),
      });
      if (!active.current || controller.signal.aborted) return;
      if (response.status === 401 || response.status === 403) { setEditing(null); setDraft(null); setConfirm(null); setAccessLost(true); onAccessLost?.(); return; }
      if (response.status === 409) { setError("다른 창에서 내용이 변경되었습니다. 입력 내용은 유지했습니다. 목록을 새로고침한 뒤 최신 항목과 비교해 주세요."); return; }
      const result = await readAdminApiResponse<{ item: ManagedContentRecord }>(response);
      if (!result.item || result.item.id !== (editing.id || (draft.kind === "notice" ? draft.slug : "")) || !Number.isSafeInteger(result.item.revision) || !result.item.draft) throw new Error("Invalid mutation response");
      if (!active.current || controller.signal.aborted) return;
      onSaved(result.item); setEditing(result.item); setDraft(structuredClone(result.item.draft));
      setNotice(action === "save" ? "초안을 저장했습니다. 현재 게시본은 유지됩니다." : `${actionNames[action]} 처리를 완료했습니다.`);
      setConfirm(null);
    } catch (failure) { if (active.current && request.current === controller && !controller.signal.aborted) setError(getAdminErrorMessage(failure, "처리 결과를 확인하지 못했습니다. 입력 내용은 유지했습니다. 목록을 다시 확인해 주세요.")); }
    finally { clearTimeout(timeout); if (requestTimeout.current === timeout) requestTimeout.current = null; if (active.current && request.current === controller) setBusy(false); if (request.current === controller) request.current = null; }
  }
  async function upload(field: "imageDesktop" | "imageMobile", file: File) {
    if (busy || draft?.kind !== "banner") return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError("");
    const timeout = setTimeout(() => {
      controller.abort("timeout");
      if (active.current && request.current === controller) { setError("이미지를 올리지 못했습니다. 선택한 파일을 확인하고 다시 시도해 주세요."); setBusy(false); request.current = null; requestTimeout.current = null; }
    }, 30_000);
    requestTimeout.current = timeout;
    try {
      const token = await user.getIdToken(); if (!active.current || controller.signal.aborted) return;
      const body = new FormData(); body.set("file", file);
      const response = await fetch("/api/admin/content/media", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body, signal: controller.signal });
      if (!active.current || controller.signal.aborted) return;
      if (response.status === 401 || response.status === 403) { setEditing(null); setDraft(null); setConfirm(null); setAccessLost(true); onAccessLost?.(); return; }
      const result = await readAdminApiResponse<{ url: string }>(response);
      if (!/^\/api\/content-media\/[0-9a-f-]{36}$/i.test(result.url)) throw new Error("Invalid media response");
      if (active.current && !controller.signal.aborted) update({ [field]: result.url });
    } catch (failure) { if (active.current && request.current === controller && !controller.signal.aborted) setError(getAdminErrorMessage(failure, "이미지를 올리지 못했습니다. 선택한 파일을 확인하고 다시 시도해 주세요.")); }
    finally { clearTimeout(timeout); if (requestTimeout.current === timeout) requestTimeout.current = null; if (active.current && request.current === controller) setBusy(false); if (request.current === controller) request.current = null; }
  }
  if (accessLost) return <p role="alert" className="admin-content-error">관리자 세션 또는 권한을 확인하지 못했습니다. 다시 로그인해 주세요.</p>;
  const filtered = items.filter(item => item.draft.kind === kind && `${item.draft.title} ${publicationLabel(item)}`.toLowerCase().includes(query.toLowerCase().trim()));
  return <section className="admin-content-manager">
    <div className="admin-content-heading"><div><h2>{copy[kind]} 관리</h2><p>초안과 게시본을 나누어 관리합니다. 시간은 모두 한국 시간입니다.</p></div><Button onClick={() => choose(fresh(kind))} disabled={busy}>새 {copy[kind]}</Button></div>
    <div className="admin-content-workspace">
      <aside className="admin-content-list"><label><span>{copy[kind]} 검색</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="제목 또는 상태 검색" /></label>
        <Button variant="ghost" onClick={onReload} disabled={busy}>목록 새로고침</Button>
        {filtered.length === 0 && <p>표시할 {copy[kind]}가 없습니다.</p>}
        <ul>{filtered.map(item => <li key={item.id}><button type="button" disabled={busy} aria-pressed={editing?.id === item.id} onClick={() => choose(item)}><strong>{item.draft.title}</strong><span>{publicationLabel(item)}{item.published && JSON.stringify(item.draft) !== JSON.stringify(item.published) ? " · 수정 초안" : ""}</span></button></li>)}</ul>
      </aside>
      {!draft || !editing ? <div className="admin-content-empty">수정할 {copy[kind]}를 선택하거나 새로 작성하세요.</div> : <div className="admin-content-editor">
        <form onSubmit={event => { event.preventDefault(); void mutate("save"); }}>
          <fieldset disabled={busy}><legend>{copy[kind]} 편집</legend>
            <Field label="제목"><input value={draft.title} required maxLength={120} onChange={event => update({ title: event.target.value })} /></Field>
            {draft.kind === "notice" ? <>
              <Field label="공지 주소"><input value={draft.slug} required pattern="[A-Za-z0-9][A-Za-z0-9-]*" maxLength={120} disabled={editing.revision > 0 || editing.source === "repository"} onChange={event => update({ slug: event.target.value })} /></Field>
              <Field label="목록 소개"><textarea value={draft.summary} maxLength={300} rows={2} onChange={event => update({ summary: event.target.value })} /></Field>
              <Field label="본문"><textarea value={draft.content} maxLength={50_000} rows={12} onChange={event => update({ content: event.target.value })} /><small>제목·목록·링크는 Markdown으로 작성할 수 있습니다.</small></Field>
              <details><summary>영문 작성</summary><label className="admin-content-check"><input type="checkbox" checked={Boolean(draft.english)} onChange={event => update({ english: event.target.checked ? { title: "", summary: "", content: "" } : undefined })} />영문본 포함</label>
                {draft.english && <><Field label="영문 제목"><input value={draft.english.title} maxLength={120} onChange={event => update({ english: { ...draft.english!, title: event.target.value } })} /></Field><Field label="영문 소개"><textarea value={draft.english.summary} maxLength={300} onChange={event => update({ english: { ...draft.english!, summary: event.target.value } })} /></Field><Field label="영문 본문"><textarea value={draft.english.content} maxLength={50_000} rows={8} onChange={event => update({ english: { ...draft.english!, content: event.target.value } })} /></Field></>}
              </details>
            </> : <>
              <SelectField id="banner-category" label="배너 유형" value={draft.category} onChange={value => update({ category: value as ManagedBannerDraft["category"] })} options={[["notice", "서비스 공지"], ["event", "행사·모집"], ["ad", "광고·제휴"]]} />
              <SelectField id="banner-placement" label="노출 위치" value={draft.placement} onChange={value => update({ placement: value as ManagedBannerDraft["placement"], ...(value === "popup" ? { dismissible: true } : {}) })} options={[["home", "홈 카드 배너"], ["site-top", "사이트 상단 안내"], ["popup", "팝업 공지"]]} />
              <Field label="안내 문구"><textarea value={draft.description} maxLength={500} rows={3} onChange={event => update({ description: event.target.value })} /></Field>
              <UploadField key={`${editing.id}-desktop`} label="데스크톱 이미지" value={draft.imageDesktop} available={mediaAvailable} busy={busy} onUpload={file => void upload("imageDesktop", file)} onClear={() => update({ imageDesktop: "", imageMobile: "" })} />
              <UploadField key={`${editing.id}-mobile`} label="모바일 이미지" value={draft.imageMobile} available={mediaAvailable} busy={busy || !draft.imageDesktop} onUpload={file => void upload("imageMobile", file)} onClear={() => update({ imageMobile: "" })} />
              <Field label="이미지 설명"><input value={draft.imageAlt} maxLength={180} onChange={event => update({ imageAlt: event.target.value })} /><small>이미지의 핵심 내용을 적어주세요.</small></Field>
              <Field label="연결 주소"><input value={draft.link} maxLength={2048} placeholder="/service/notices 또는 https://…" onChange={event => update({ link: event.target.value })} /></Field>
              <Field label="노출 우선순위"><input type="number" min={0} max={1000} value={draft.priority} onChange={event => update({ priority: Number(event.target.value) })} /><small>숫자가 클수록 먼저 표시합니다.</small></Field>
              <label className="admin-content-check"><input type="checkbox" checked={draft.placement === "popup" || draft.dismissible} disabled={draft.placement === "popup"} onChange={event => update({ dismissible: event.target.checked })} />닫기 허용</label>
              {draft.placement === "popup" && <small>팝업은 항상 닫을 수 있으며, 방문자가 오늘 하루 보지 않기를 선택할 수 있습니다.</small>}
            </>}
            <div className="admin-content-dates"><Field label="노출 시작"><input type="datetime-local" value={toSeoulInput(draft.startsAt)} onChange={event => update({ startsAt: fromSeoulInput(event.target.value) })} /></Field><Field label="노출 종료"><input type="datetime-local" value={toSeoulInput(draft.endsAt)} onChange={event => update({ endsAt: fromSeoulInput(event.target.value) })} /></Field></div>
            <small>비워두면 게시 즉시 시작하며, 종료 시간을 지정하지 않으면 계속 표시합니다.</small>
          </fieldset>
          {error && !confirm && <p className="admin-content-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
          <div className="admin-content-actions"><Button type="submit" variant="secondary" disabled={busy || !draft.title.trim()}>초안 저장</Button><Button disabled={busy || !draft.title.trim() || editing.archived} onClick={() => { setEnglishReviewed(false); setConfirm("publish"); }}>게시 검토</Button>
            {editing.published && <Button variant="secondary" disabled={busy} onClick={() => setConfirm("unpublish")}>노출 중단</Button>}
            <Button variant="ghost" disabled={busy || !editing.id || (editing.revision === 0 && editing.source === "database")} onClick={() => setConfirm(editing.archived ? "restore" : "archive")}>{editing.archived ? "복원" : "보관"}</Button>
          </div>
        </form>
        <aside className="admin-content-preview"><h3>게시 미리보기</h3><ContentPreview draft={draft} /></aside>
      </div>}
    </div>
    <Modal isOpen={Boolean(confirm && draft)} title={`${copy[kind]} ${confirm ? actionNames[confirm] : ""} 검토`} onClose={() => { if (!busy) setConfirm(null); }} size="lg">
      {draft && <><p>{confirm === "publish" ? "아래 내용을 확인한 뒤 게시하세요. 지정한 노출 기간에 맞춰 사이트에 표시됩니다." : "현재 표시 상태가 변경됩니다. 초안은 보존합니다."}</p><ContentPreview draft={draft} />
        {confirm === "publish" && draft.kind === "notice" && draft.english && <label className="admin-content-check"><input type="checkbox" checked={englishReviewed} onChange={event => setEnglishReviewed(event.target.checked)} />한국어 원문과 영문 내용을 함께 확인했습니다.</label>}
        {error && <p role="alert" className="admin-content-error">{error}</p>}
        <div className="admin-content-actions"><Button variant="secondary" disabled={busy} onClick={() => setConfirm(null)}>취소</Button><Button disabled={busy || (confirm === "publish" && draft.kind === "notice" && Boolean(draft.english) && !englishReviewed)} onClick={() => { if (confirm) void mutate(confirm); }}>{busy ? "처리 중…" : confirm ? `${actionNames[confirm]}하기` : "확인"}</Button></div>
      </>}
    </Modal>
    <Modal isOpen={Boolean(switchTo)} title="작성 중인 내용 변경" onClose={() => setSwitchTo(null)} size="sm"><p>저장하지 않은 내용을 버리고 다른 항목을 열까요?</p><div className="admin-content-actions"><Button variant="secondary" onClick={() => setSwitchTo(null)}>계속 작성</Button><Button onClick={() => { if (switchTo) { const item = switchTo; setSwitchTo(null); setEditing(item); setDraft(structuredClone(item.draft)); setError(""); setNotice(""); } }}>변경하기</Button></div></Modal>
  </section>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId(), helpId = `${id}-help`;
  const nodes = Children.toArray(children);
  const hasHelp = nodes.some(node => isValidElement(node) && node.type === "small");
  return <div className="admin-content-field"><label htmlFor={id}>{label}</label>{nodes.map(node => {
    if (!isValidElement<{ id?: string; "aria-describedby"?: string }>(node)) return node;
    if (node.type === "input" || node.type === "textarea") return cloneElement(node, { id, "aria-describedby": hasHelp ? helpId : undefined });
    return node.type === "small" ? cloneElement(node, { id: helpId }) : node;
  })}</div>;
}
function SelectField({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: string[][]; onChange: (value: string) => void }) { return <div className="admin-content-field"><label id={`${id}-label`} htmlFor={id}>{label}</label><M3Select id={id} value={value} onValueChange={onChange} options={options.map(([option, text]) => ({ value: option, label: text }))} /></div>; }
function UploadField({ label, value, busy, available, onUpload, onClear }: { label: string; value: string; busy: boolean; available: boolean; onUpload: (file: File) => void; onClear: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  return <div className="admin-content-field"><label><span>{label}</span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || !available} onChange={event => setFile(event.target.files?.[0] ?? null)} /></label><small>{available ? "PNG·JPEG·WebP, 최대 5MB. 업로드 후 초안을 저장하세요." : "이미지 저장소 연결을 확인해야 합니다. 기존 이미지는 유지됩니다."}</small><small>업로드한 이미지는 게시 여부와 관계없이 이미지 주소로 볼 수 있습니다.</small><div className="admin-content-actions"><Button variant="secondary" disabled={busy || !file || !available} onClick={() => { if (file) onUpload(file); }}>{label} 업로드</Button>{value && <Button variant="ghost" disabled={busy} onClick={onClear}>이미지 제외</Button>}</div>{value && <p>이미지 준비됨</p>}</div>;
}
function ContentPreview({ draft }: { draft: ManagedContentDraft }) {
  return <article className="admin-content-preview-surface">
    {draft.kind === "banner" && draft.placement === "popup" && <p>팝업 공지 · 방문 시 배경 위에 표시합니다.</p>}
    {draft.kind === "banner" && draft.category === "ad" && <span className="admin-content-ad-label">광고</span>}
    {draft.kind === "banner" && draft.imageDesktop && <picture>{draft.imageMobile && <source media="(max-width:599px)" srcSet={draft.imageMobile} />}<img src={draft.imageDesktop} alt={draft.imageAlt || "이미지 설명을 입력해 주세요"} /></picture>}
    <h3>{draft.title || "제목 미리보기"}</h3><p>{draft.kind === "notice" ? draft.summary : draft.description}</p>
    {draft.kind === "notice" && <div className="admin-content-markdown"><ReactMarkdown skipHtml components={{ a: props => <a {...props} target="_blank" rel="noopener noreferrer" /> }}>{draft.content}</ReactMarkdown></div>}
    {draft.kind === "banner" && draft.link && <p className="admin-content-preview-link">연결: {draft.link}</p>}
    {draft.startsAt && <small>시작: {new Date(draft.startsAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</small>}{draft.endsAt && <small>종료: {new Date(draft.endsAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</small>}
  </article>;
}
