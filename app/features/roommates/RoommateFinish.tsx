"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Container } from "@/app/components/Container";
import { useLocale } from "@/app/components/LocaleProvider";
import { localizePath } from "@/lib/i18n";
import { getRoommateText } from "@/lib/i18n/roommates";
import { clearRoommateAuth, getRoommateAuth } from "@/lib/firebaseRoommates";
import { protectRoommateLinkPrivacy } from "@/lib/roommate-link-privacy";
import { ROOMMATE_CHANNEL, ROOMMATE_QUERY_KEY, RoommateApiError, clearPendingEmail, readPendingEmail, roommateRequest, safeRoommatePath } from "./client";
import { inputClass, primaryClass } from "./RoommateShared";

export default function RoommateFinish() {
  const locale = useLocale(); const text = getRoommateText(locale); const queryClient = useQueryClient();
  const [email, setEmail] = useState(""); const [remember, setRemember] = useState(true);
  const [stage, setStage] = useState<"initial" | "email" | "working" | "retry" | "invalid" | "expired">("initial");
  const link = useRef(""); const next = useRef(""); const working = useRef(false); const consumed = useRef(false); const authTime = useRef(0); const mounted = useRef(true); const canceled = useRef(false); const initialized = useRef(false);

  const complete = useCallback(async (address: string, keep: boolean) => {
    if (working.current) return;
    working.current = true; setStage("working");
    try {
      const auth = await getRoommateAuth();
      if (canceled.current || !mounted.current) { await clearRoommateAuth(); return; }
      if (!consumed.current) {
        if (!isSignInWithEmailLink(auth, link.current)) { setStage("invalid"); return; }
        await signInWithEmailLink(auth, address.trim().toLowerCase(), link.current);
        consumed.current = true;
        if (canceled.current || !mounted.current) { await clearRoommateAuth(); return; }
        // Remove OOB values before any session request, navigation or further UI work.
        window.history.replaceState(null, "", window.location.pathname);
      }
      if (!auth.currentUser) { setStage("expired"); return; }
      const token = await auth.currentUser.getIdTokenResult();
      if (canceled.current || !mounted.current) { await clearRoommateAuth(); return; }
      authTime.current = Number(token.claims.auth_time) * 1000;
      if (!Number.isFinite(authTime.current) || Date.now() - authTime.current > 300000) {
        clearPendingEmail(); await clearRoommateAuth(); setStage("expired"); return;
      }
      await roommateRequest("auth/session", { method: "POST", body: JSON.stringify({ idToken: token.token, remember: keep }) });
      clearPendingEmail(); await clearRoommateAuth();
      if (canceled.current || !mounted.current) {
        // Await the non-idempotent session request, then remove any cookie it issued.
        await roommateRequest("auth/logout", { method: "POST", body: "{}" }).catch(() => {});
        return;
      }
      await queryClient.cancelQueries({ queryKey: ROOMMATE_QUERY_KEY }); queryClient.removeQueries({ queryKey: ROOMMATE_QUERY_KEY });
      if (canceled.current || !mounted.current) {
        await roommateRequest("auth/logout", { method: "POST", body: "{}" }).catch(() => {});
        return;
      }
      if (typeof BroadcastChannel !== "undefined") { const channel = new BroadcastChannel(ROOMMATE_CHANNEL); channel.postMessage("cleared"); channel.close(); }
      window.location.replace(safeRoommatePath(next.current, locale));
    } catch (error) {
      if (mounted.current && !canceled.current) {
        if (error instanceof RoommateApiError && error.code === "RECENT_AUTH_REQUIRED") { await clearRoommateAuth(); clearPendingEmail(); setStage("expired"); }
        else if (error instanceof RoommateApiError && [400, 401, 403].includes(error.status)) { await clearRoommateAuth(); clearPendingEmail(); setStage("invalid"); }
        else setStage(consumed.current ? "retry" : "invalid");
      } else await clearRoommateAuth();
    } finally { working.current = false; }
  }, [locale, queryClient]);

  useEffect(() => {
    mounted.current = true;
    if (!initialized.current) {
      initialized.current = true; link.current = window.location.href;
      // Retain the link in memory only while asking for an email or completing it.
      window.history.replaceState(null, "", window.location.pathname);
    }
    protectRoommateLinkPrivacy();
    const pending = readPendingEmail(); next.current = safeRoommatePath(pending?.next, locale);
    if (pending) { setEmail(pending.email); setRemember(pending.remember); void complete(pending.email, pending.remember); }
    else setStage("email");
    return () => {
      mounted.current = false;
      // StrictMode immediately mounts again; a real departure clears temporary credentials.
      queueMicrotask(() => {
        if (!mounted.current) { clearPendingEmail(); void clearRoommateAuth(); link.current = ""; }
      });
    };
  }, [complete, locale]);

  useEffect(() => {
    if (stage !== "retry") return;
    const timer = window.setTimeout(() => { clearPendingEmail(); void clearRoommateAuth(); setStage("expired"); }, Math.max(0, authTime.current + 300000 - Date.now()));
    return () => window.clearTimeout(timer);
  }, [stage]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (/^[^\s@]+@syuin\.ac\.kr$/.test(email.trim().toLowerCase())) void complete(email, remember);
    else document.getElementById("roommate-finish-email")?.focus();
  }
  function cancel() { canceled.current = true; clearPendingEmail(); void clearRoommateAuth(); }
  return <Container size="sm" className="py-8"><h1 className="text-2xl font-bold">{text.finishTitle}</h1><div className="mt-5 rounded-xl border border-neutral-200 bg-white p-5">
    {(stage === "initial" || stage === "working") && <p role="status">{text.completing}</p>}
    {stage === "email" && <form onSubmit={submit}><p className="mb-4 text-neutral-600">{text.finishHelp}</p><label htmlFor="roommate-finish-email">{text.email}</label><input id="roommate-finish-email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} pattern="[^\s@]+@syuin\.ac\.kr" className={inputClass} /><label className="my-4 flex min-h-11 items-center gap-2"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />{text.remember}</label><p className="mb-4 text-sm text-neutral-500">{text.rememberHelp}</p><button className={primaryClass}>{text.finish}</button></form>}
    {stage === "retry" && <div role="alert"><p>{text.sessionRetry}</p><button type="button" onClick={() => void complete(email, remember)} className={`${primaryClass} mt-4`}>{text.retrySession}</button></div>}
    {(stage === "invalid" || stage === "expired") && <div role="alert"><p>{stage === "expired" ? text.retryExpired : text.invalidLink}</p><Link onClick={cancel} href={localizePath("/campus/roommates/verify", locale)} className={`${primaryClass} mt-4`}>{text.freshLink}</Link></div>}
  </div><Link onClick={cancel} href={localizePath("/campus", locale)} className="mt-5 inline-block text-sm text-neutral-600 underline">{text.cancel}</Link></Container>;
}
