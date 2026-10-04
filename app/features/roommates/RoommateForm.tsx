"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useLocale } from "@/app/components/LocaleProvider";
import { localizePath } from "@/lib/i18n";
import { getRoommateText } from "@/lib/i18n/roommates";
import { ROOMMATE_DORMS, RoommateError, defaultRecruitDeadline, koreaDate, normalizeRoommatePostInput } from "@/lib/roommates";
import type { RoommateDorm, RoommatePost, RoommatePostInput, RoommatePostSubmission } from "@/types/roommates";
import { RoommateApiError, roommateErrorMessage } from "./client";
import { HabitFields, inputClass, primaryClass, secondaryClass } from "./RoommateShared";

export default function RoommateForm({ post, onSubmit, onCancel }: { post?: RoommatePost; onSubmit: (input: RoommatePostSubmission) => Promise<void>; onCancel?: () => void }) {
  const locale = useLocale(); const text = getRoommateText(locale); const formRef = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState<RoommatePostInput>(() => post ? {
    nickname: post.nickname, dorm: post.dorm, roomSize: post.roomSize, roommatesNeeded: post.roommatesNeeded,
    stayStart: post.stayStart, stayEnd: post.stayEnd, recruitUntil: post.recruitUntil, habits: post.habits,
    description: post.description, openChatUrl: post.openChatUrl,
  } : { nickname: "", dorm: "peniel", roomSize: 2, roommatesNeeded: 1, stayStart: koreaDate(), stayEnd: "", recruitUntil: defaultRecruitDeadline("9999-12-31"), habits: {}, description: "", openChatUrl: "" });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [errorField, setErrorField] = useState("");
  const [disclosureConsent, setDisclosureConsent] = useState(false);
  const roomSizes = ROOMMATE_DORMS.find((dorm) => dorm.value === value.dorm)!.roomSizes;
  const maxDeadline = defaultRecruitDeadline(value.stayEnd || "9999-12-31", post ? Date.parse(post.createdAt) : undefined);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setErrorField(""); setBusy(true);
    try { const normalized = normalizeRoommatePostInput({ ...value, disclosureConsent }, post ? { createdAt: Date.parse(post.createdAt), previousDeadline: post.recruitUntil } : undefined); await onSubmit(normalized); }
    catch (err) {
      setError(err instanceof RoommateError ? text.validation[err.field?.split(".")[0] as keyof typeof text.validation] ?? text.invalid : roommateErrorMessage(err, text, locale));
      const field = err instanceof RoommateError || err instanceof RoommateApiError ? err.field : undefined;
      if (field) { setErrorField(field); formRef.current?.querySelector<HTMLElement>(`[name="${CSS.escape(field)}"]`)?.focus(); }
    } finally { setBusy(false); }
  }
  function update<K extends keyof RoommatePostInput>(field: K, next: RoommatePostInput[K]) { setValue((current) => ({ ...current, [field]: next })); }
  function input(label: string, field: "nickname" | "stayStart" | "stayEnd" | "recruitUntil" | "openChatUrl", props: React.InputHTMLAttributes<HTMLInputElement> = {}) {
    return <label className="block text-sm font-medium text-neutral-800">{label}<input name={field} className={inputClass} value={value[field]} required aria-invalid={errorField === field} aria-describedby={[field === "openChatUrl" ? "roommate-contact-help" : "", errorField === field ? "roommate-form-error" : ""].filter(Boolean).join(" ") || undefined} onChange={(event) => {
      const next = event.target.value;
      if (field === "stayEnd") setValue((current) => ({ ...current, stayEnd: next, recruitUntil: next && next < current.recruitUntil ? next : current.recruitUntil }));
      else update(field, next);
    }} {...props} /></label>;
  }
  return <form ref={formRef} onSubmit={submit} className="space-y-7 rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
    <p className="text-sm leading-relaxed text-neutral-500">{text.requiredHint}</p>
    <fieldset>
      <legend className="mb-4 text-lg font-semibold text-neutral-900">{text.basicInfo}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        {input(text.nickname, "nickname", { minLength: 2, maxLength: 12, autoComplete: "nickname" })}
        <label className="text-sm font-medium text-neutral-800">{text.dorm}<select name="dorm" value={value.dorm} className={inputClass} onChange={(event) => setValue({ ...value, dorm: event.target.value as RoommateDorm, roomSize: 2, roommatesNeeded: 1 })}>{ROOMMATE_DORMS.map((dorm) => <option key={dorm.value} value={dorm.value}>{text.dorms[dorm.value]}</option>)}</select></label>
        <label className="text-sm font-medium text-neutral-800">{text.roomSize}<select name="roomSize" value={value.roomSize} className={inputClass} onChange={(event) => setValue({ ...value, roomSize: Number(event.target.value), roommatesNeeded: Math.min(value.roommatesNeeded, Number(event.target.value) - 1) })}>{roomSizes.map((size) => <option key={size} value={size}>{size} {text.roomUnit}</option>)}</select></label>
        <label className="text-sm font-medium text-neutral-800">{text.people}<select name="roommatesNeeded" value={value.roommatesNeeded} className={inputClass} onChange={(event) => update("roommatesNeeded", Number(event.target.value))}>{Array.from({ length: value.roomSize - 1 }, (_, index) => <option key={index} value={index + 1}>{index + 1} {text.peopleUnit}</option>)}</select></label>
      </div>
    </fieldset>
    <fieldset className="border-t border-neutral-200 pt-6">
      <legend className="pr-3 text-lg font-semibold text-neutral-900">{text.stayPeriod}</legend>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {input(text.stayStart, "stayStart", { type: "date" })}
        {input(text.stayEnd, "stayEnd", { type: "date", min: value.stayStart > koreaDate() ? value.stayStart : koreaDate() })}
        {input(text.recruitUntil, "recruitUntil", { type: "date", min: koreaDate(), max: post && post.recruitUntil < maxDeadline ? post.recruitUntil : maxDeadline })}
      </div>
      {post && <p className="mt-3 text-sm leading-relaxed text-neutral-500">{text.editDeadline}</p>}
    </fieldset>
    <fieldset className="border-t border-neutral-200 pt-6">
      <legend className="pr-3 text-lg font-semibold text-neutral-900">{text.aboutYou} <span className="text-sm font-normal text-neutral-500">({text.optional})</span></legend>
      <p className="mb-4 text-sm leading-relaxed text-neutral-500">{text.optionalHint}</p>
      <HabitFields value={value.habits} onChange={(habits) => update("habits", habits)} />
      <div className="mt-5">
        <div className="flex items-center justify-between gap-3"><label htmlFor="roommate-description" className="text-sm font-medium text-neutral-800">{text.descriptionLabel}</label><span aria-hidden="true" className="text-xs tabular-nums text-neutral-500">{value.description.length}/300</span></div>
        <textarea id="roommate-description" name="description" maxLength={300} rows={4} value={value.description} onChange={(event) => update("description", event.target.value)} className={inputClass} aria-invalid={errorField === "description"} aria-describedby={errorField === "description" ? "roommate-description-help roommate-form-error" : "roommate-description-help"} />
        <p id="roommate-description-help" className="mt-2 text-sm leading-relaxed text-neutral-500">{text.privacyHint}</p>
      </div>
    </fieldset>
    <fieldset className="border-t border-neutral-200 pt-6">
      <legend className="pr-3 text-lg font-semibold text-neutral-900">{text.contactInfo}</legend>
      <p id="roommate-contact-help" className="mb-4 text-sm leading-relaxed text-neutral-500">{text.contactHelp}</p>
      {input(text.openChat, "openChatUrl", { type: "url", maxLength: 200, placeholder: "https://open.kakao.com/o/…" })}
    </fieldset>
    <fieldset className="border-t border-neutral-200 pt-6 text-sm leading-relaxed text-neutral-700">
      <legend className="pr-3 text-lg font-semibold text-neutral-900">{text.disclosureTitle} <span className="text-sm font-normal text-neutral-500">({text.required})</span></legend>
      <dl id="roommate-disclosure-help" className="divide-y divide-neutral-100">
        {([
          [text.disclosureLabels.recipients, text.disclosureRecipients], [text.disclosureLabels.purpose, text.disclosurePurpose],
          [text.disclosureLabels.items, text.disclosureItems], [text.disclosureLabels.period, text.disclosurePeriod],
          [text.disclosureLabels.refusal, text.disclosureRefusal], [text.disclosureLabels.withdrawal, text.disclosureWithdrawal],
        ] as const).map(([label, detail]) => <div key={label} className="grid gap-1 py-3 first:pt-0 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4"><dt className="font-medium text-neutral-900">{label}</dt><dd>{detail}</dd></div>)}
      </dl>
      <Link prefetch={false} href={localizePath("/privacy", locale)} className="inline-flex min-h-11 items-center text-primary-700 underline underline-offset-4">{text.privacyPolicy}</Link>
      <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 rounded-lg bg-neutral-50 p-4 font-medium text-neutral-900">
        <input name="disclosureConsent" type="checkbox" checked={disclosureConsent} disabled={busy}
          aria-invalid={errorField === "disclosureConsent"} aria-describedby={errorField === "disclosureConsent" ? "roommate-disclosure-help roommate-form-error" : "roommate-disclosure-help"}
          onChange={(event) => setDisclosureConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-primary-600" />
        {text.disclosureAgree}
      </label>
    </fieldset>
    {error && <p id="roommate-form-error" role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-3 border-t border-neutral-200 pt-6"><button className={primaryClass} disabled={busy}>{busy ? text.submitting : post ? text.save : text.create}</button>{onCancel && <button type="button" disabled={busy} className={secondaryClass} onClick={onCancel}>{text.cancel}</button>}</div>
  </form>;
}
