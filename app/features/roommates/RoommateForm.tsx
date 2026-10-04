"use client";

import { useRef, useState, type FormEvent } from "react";
import { useLocale } from "@/app/components/LocaleProvider";
import { getRoommateText } from "@/lib/i18n/roommates";
import { ROOMMATE_DORMS, RoommateError, defaultRecruitDeadline, koreaDate, normalizeRoommatePostInput } from "@/lib/roommates";
import type { RoommateDorm, RoommatePost, RoommatePostInput } from "@/types/roommates";
import { RoommateApiError, roommateErrorMessage } from "./client";
import { HabitFields, inputClass, primaryClass, secondaryClass } from "./RoommateShared";

export default function RoommateForm({ post, onSubmit, onCancel }: { post?: RoommatePost; onSubmit: (input: RoommatePostInput) => Promise<void>; onCancel?: () => void }) {
  const locale = useLocale(); const text = getRoommateText(locale); const formRef = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState<RoommatePostInput>(() => post ? {
    nickname: post.nickname, dorm: post.dorm, roomSize: post.roomSize, roommatesNeeded: post.roommatesNeeded,
    stayStart: post.stayStart, stayEnd: post.stayEnd, recruitUntil: post.recruitUntil, habits: post.habits,
    description: post.description, openChatUrl: post.openChatUrl,
  } : { nickname: "", dorm: "peniel", roomSize: 2, roommatesNeeded: 1, stayStart: koreaDate(), stayEnd: "", recruitUntil: defaultRecruitDeadline("9999-12-31"), habits: {}, description: "", openChatUrl: "" });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [errorField, setErrorField] = useState("");
  const roomSizes = ROOMMATE_DORMS.find((dorm) => dorm.value === value.dorm)!.roomSizes;
  const maxDeadline = defaultRecruitDeadline(value.stayEnd || "9999-12-31", post ? Date.parse(post.createdAt) : undefined);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setErrorField(""); setBusy(true);
    try { const normalized = normalizeRoommatePostInput(value, post ? { createdAt: Date.parse(post.createdAt), previousDeadline: post.recruitUntil } : undefined); await onSubmit(normalized); }
    catch (err) {
      setError(err instanceof RoommateError ? text.validation[err.field?.split(".")[0] as keyof typeof text.validation] ?? text.invalid : roommateErrorMessage(err, text, locale));
      const field = err instanceof RoommateError || err instanceof RoommateApiError ? err.field : undefined;
      if (field) { setErrorField(field); formRef.current?.querySelector<HTMLElement>(`[name="${CSS.escape(field)}"]`)?.focus(); }
    } finally { setBusy(false); }
  }
  function update<K extends keyof RoommatePostInput>(field: K, next: RoommatePostInput[K]) { setValue((current) => ({ ...current, [field]: next })); }
  function input(label: string, field: "nickname" | "stayStart" | "stayEnd" | "recruitUntil" | "openChatUrl", props: React.InputHTMLAttributes<HTMLInputElement> = {}) {
    return <label className="text-sm font-medium">{label}<input name={field} className={inputClass} value={value[field]} required aria-invalid={errorField === field} aria-describedby={errorField === field ? "roommate-form-error" : undefined} onChange={(event) => {
      const next = event.target.value;
      if (field === "stayEnd") setValue((current) => ({ ...current, stayEnd: next, recruitUntil: next && next < current.recruitUntil ? next : current.recruitUntil }));
      else update(field, next);
    }} {...props} /></label>;
  }
  return <form ref={formRef} onSubmit={submit} className="space-y-6 rounded-xl border border-neutral-200 bg-white p-5 sm:p-6"><div className="grid gap-4 sm:grid-cols-2">
    {input(text.nickname, "nickname", { minLength: 2, maxLength: 12, autoComplete: "nickname" })}
    <label className="text-sm font-medium">{text.dorm}<select name="dorm" value={value.dorm} className={inputClass} onChange={(event) => setValue({ ...value, dorm: event.target.value as RoommateDorm, roomSize: 2, roommatesNeeded: 1 })}>{ROOMMATE_DORMS.map((dorm) => <option key={dorm.value} value={dorm.value}>{text.dorms[dorm.value]}</option>)}</select></label>
    <label className="text-sm font-medium">{text.roomSize}<select name="roomSize" value={value.roomSize} className={inputClass} onChange={(event) => setValue({ ...value, roomSize: Number(event.target.value), roommatesNeeded: Math.min(value.roommatesNeeded, Number(event.target.value) - 1) })}>{roomSizes.map((size) => <option key={size} value={size}>{size} {text.roomUnit}</option>)}</select></label>
    <label className="text-sm font-medium">{text.people}<select name="roommatesNeeded" value={value.roommatesNeeded} className={inputClass} onChange={(event) => update("roommatesNeeded", Number(event.target.value))}>{Array.from({ length: value.roomSize - 1 }, (_, index) => <option key={index} value={index + 1}>{index + 1} {text.peopleUnit}</option>)}</select></label>
    {input(text.stayStart, "stayStart", { type: "date" })}{input(text.stayEnd, "stayEnd", { type: "date", min: value.stayStart > koreaDate() ? value.stayStart : koreaDate() })}{input(text.recruitUntil, "recruitUntil", { type: "date", min: koreaDate(), max: post && post.recruitUntil < maxDeadline ? post.recruitUntil : maxDeadline })}
  </div>{post && <p className="text-sm text-neutral-500">{text.editDeadline}</p>}
    <fieldset><legend className="mb-3 font-semibold">{text.habits} <span className="text-sm font-normal text-neutral-500">({text.optional})</span></legend><HabitFields value={value.habits} onChange={(habits) => update("habits", habits)} /></fieldset>
    <div><label htmlFor="roommate-description" className="text-sm font-medium">{text.descriptionLabel}</label><textarea id="roommate-description" name="description" maxLength={300} rows={4} value={value.description} onChange={(event) => update("description", event.target.value)} className={inputClass} aria-describedby="roommate-description-help" /><p id="roommate-description-help" className="mt-2 text-sm text-neutral-500">{text.privacyHint}</p></div>
    {input(text.openChat, "openChatUrl", { type: "url", maxLength: 200, placeholder: "https://open.kakao.com/o/…" })}
    <p className="text-sm leading-relaxed text-neutral-600">{text.publishHint}</p>
    {error && <p id="roommate-form-error" role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-2"><button className={primaryClass} disabled={busy}>{busy ? text.submitting : post ? text.save : text.create}</button>{onCancel && <button type="button" disabled={busy} className={secondaryClass} onClick={onCancel}>{text.cancel}</button>}</div>
  </form>;
}
