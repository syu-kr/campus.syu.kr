"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useLocale } from "@/app/components/LocaleProvider";
import { Container } from "@/app/components/Container";
import { getRoommateText } from "@/lib/i18n/roommates";
import { getDictionary, localizePath } from "@/lib/i18n";
import { clearPendingEmail, readPendingEmail, roommateErrorMessage, roommateRequest, safeRoommatePath, savePendingEmail } from "./client";
import { inputClass, primaryClass } from "./RoommateShared";

export default function RoommateVerify() {
  const locale = useLocale(); const text = getRoommateText(locale);
  const footer = getDictionary(locale).footer;
  const [email, setEmail] = useState(""); const [remember, setRemember] = useState(true);
  const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@syuin\.ac\.kr$/.test(address)) { setError(text.emailInvalid); document.getElementById("roommate-email")?.focus(); return; }
    setBusy(true);
    try {
      await roommateRequest("auth/request-link", { method: "POST", body: JSON.stringify({ email: address, locale }) });
      const next = new URLSearchParams(window.location.search).get("next");
      savePendingEmail({ email: address, remember, next: safeRoommatePath(next, locale) });
      setSent(true);
    } catch (err) { setError(roommateErrorMessage(err, text, locale)); }
    finally { setBusy(false); }
  }
  return <Container size="sm" className="py-8"><Link href={localizePath("/campus", locale)} onClick={clearPendingEmail} className="text-sm text-neutral-600 hover:underline">{text.campus}</Link><h1 className="mt-4 text-2xl font-bold">{text.verifyTitle}</h1><p className="mt-2 text-neutral-600">{text.verifyHelp}</p>
    <form onSubmit={submit} className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
      <label htmlFor="roommate-email" className="text-sm font-medium">{text.email}</label><input id="roommate-email" type="email" inputMode="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => { setEmail(event.target.value); setSent(false); }} placeholder="name@syuin.ac.kr" className={inputClass} aria-describedby="roommate-email-help" aria-invalid={!!error} />
      <p id="roommate-email-help" className="mt-2 text-sm text-neutral-500">{text.emailHint}</p>
      <label className="mt-5 flex min-h-11 items-center gap-3"><input type="checkbox" checked={remember} onChange={(event) => { setRemember(event.target.checked); const pending = readPendingEmail(); if (pending && pending.email === email.trim().toLowerCase()) savePendingEmail({ ...pending, remember: event.target.checked }); }} className="h-4 w-4 accent-primary-600" /><span className="text-sm font-medium">{text.remember}</span></label><p className="mb-5 text-sm text-neutral-500">{text.rememberHelp}</p>
      {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className={`${primaryClass} w-full`}>{busy ? text.submitting : sent ? text.resend : text.send}</button>
      {sent && <div role="status" className="mt-4 rounded-lg bg-primary-50 p-4"><p className="font-medium text-primary-900">{text.sent}</p><p className="mt-2 text-sm text-primary-800">{text.sentHelp}</p></div>}
    </form>
    <div className="mt-5 space-y-3 text-sm text-neutral-600"><p>{text.mailPrivacy}</p><a href="https://www.syu.ac.kr/blog/2026%ED%95%99%EB%85%84%EB%8F%84-%EC%8B%A0-%ED%8E%B8%EC%9E%85%EC%83%9D-%EC%A0%95%EB%B3%B4%EC%84%9C%EB%B9%84%EC%8A%A4-%EC%9D%B4%EC%9A%A9-%EC%95%88%EB%82%B4/" target="_blank" rel="noopener noreferrer" className="inline-block text-primary-700 underline">{text.mailGuide}</a><p>{text.scopeHint}</p><p>{text.termsHint}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <Link href={localizePath("/terms", locale)} className="text-primary-700 underline">{footer.terms}</Link>
        <Link href={localizePath("/privacy", locale)} className="text-primary-700 underline">{footer.privacy}</Link>
      </div>
    </div>
  </Container>;
}
