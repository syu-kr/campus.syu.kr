"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale } from "@/app/components/LocaleProvider";
import { getRoommateText } from "@/lib/i18n/roommates";
import { localizePath } from "@/lib/i18n";
import { protectRoommateLinkPrivacy } from "@/lib/roommate-link-privacy";
import { ROOMMATE_CHANNEL, ROOMMATE_CLEAR_EVENT, ROOMMATE_QUERY_KEY, ROOMMATE_REFRESH_INTERVAL_MS, RoommateApiError, roommateRequest } from "./client";
import RoommateLogout from "./RoommateLogout";
import { RoommateHeading } from "./RoommateShared";

export default function RoommateSession({ children, expiresAt, sessionTag }: { children: ReactNode; expiresAt?: string; sessionTag?: string }) {
  const locale = useLocale();
  const text = getRoommateText(locale);
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [failed, setFailed] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [identityVersion, setIdentityVersion] = useState(0);
  const [currentExpiry, setCurrentExpiry] = useState(expiresAt);
  const channel = useRef<BroadcastChannel | null>(null);
  const alive = useRef(true);
  const signingOut = useRef(false);
  const generation = useRef(0);
  const inFlightGeneration = useRef<number | null>(null);
  const identity = useRef(sessionTag ?? expiresAt);
  const privateContents = useRef<HTMLDivElement>(null);
  const verified = useRef(false);
  const needsFreshCheck = useRef(true);
  const lastCheckAt = useRef<number | null>(null);
  const expiry = useRef(expiresAt);

  const clear = useCallback(() => {
    generation.current += 1;
    verified.current = false;
    needsFreshCheck.current = true;
    if (privateContents.current) privateContents.current.hidden = true;
    setReady(false);
    void queryClient.cancelQueries({ queryKey: ROOMMATE_QUERY_KEY });
    queryClient.removeQueries({ queryKey: ROOMMATE_QUERY_KEY });
  }, [queryClient]);
  const leave = useCallback(() => {
    clear();
    window.location.replace(`${localizePath("/campus/roommates/verify", locale)}?next=${encodeURIComponent(window.location.pathname)}`);
  }, [clear, locale]);
  const startLogout = useCallback(() => {
    signingOut.current = true;
    clear();
  }, [clear]);
  const validate = useCallback(async (force = false) => {
    // Expiry still applies when a background tab's timer has been suspended.
    if (expiry.current && Date.parse(expiry.current) <= Date.now()) { leave(); return; }
    if (signingOut.current || inFlightGeneration.current === generation.current) return;
    if (!force && !needsFreshCheck.current && lastCheckAt.current !== null && Date.now() - lastCheckAt.current < ROOMMATE_REFRESH_INTERVAL_MS) return;
    // Ordinary tab returns preserve the screen. Only the initial gate and browser
    // history restoration conceal private contents until a fresh check succeeds.
    if (!verified.current || needsFreshCheck.current) {
      if (privateContents.current) privateContents.current.hidden = true;
      setChecking(true);
    }
    lastCheckAt.current = Date.now();
    const run = ++generation.current;
    inFlightGeneration.current = run;
    try {
      const session = await roommateRequest<{ expiresAt: string; sessionTag?: string }>("auth/session");
      if (alive.current && run === generation.current) {
        if (Date.parse(session.expiresAt) <= Date.now()) { leave(); return; }
        const tag = session.sessionTag ?? session.expiresAt;
        if (identity.current !== tag) {
          clear(); identity.current = tag; setIdentityVersion((value) => value + 1);
        }
        verified.current = true;
        needsFreshCheck.current = false;
        expiry.current = session.expiresAt;
        setCurrentExpiry(session.expiresAt);
        setReady(true); setFailed(false); setChecking(false);
      }
    } catch (error) {
      if (!alive.current || run !== generation.current) return;
      if (error instanceof RoommateApiError && error.status === 401) leave();
      else if (error instanceof RoommateApiError && error.code === "FEATURE_DISABLED") { clear(); setDisabled(true); }
      else { setFailed(true); }
    } finally {
      if (inFlightGeneration.current === run) inFlightGeneration.current = null;
    }
  }, [clear, leave]);

  useEffect(() => {
    alive.current = true;
    protectRoommateLinkPrivacy();
    void validate(true);
    const onClear = (event: Event) => {
      clear();
      if ((event as CustomEvent<{ disabled?: boolean }>).detail?.disabled) setDisabled(true);
      else leave();
    };
    const conceal = () => {
      generation.current += 1;
      needsFreshCheck.current = true;
      if (privateContents.current) privateContents.current.hidden = true;
      setChecking(true);
    };
    const onFocus = () => { if (!document.hidden) void validate(); };
    const onVisibility = () => { if (!document.hidden) void validate(); };
    const onPageShow = (event: PageTransitionEvent) => { void validate(event.persisted); };
    window.addEventListener(ROOMMATE_CLEAR_EVENT, onClear);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("pagehide", conceal);
    document.addEventListener("visibilitychange", onVisibility);
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel(ROOMMATE_CHANNEL);
      channel.current.onmessage = () => leave();
    }
    return () => {
      alive.current = false;
      generation.current += 1;
      window.removeEventListener(ROOMMATE_CLEAR_EVENT, onClear);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("pagehide", conceal);
      document.removeEventListener("visibilitychange", onVisibility);
      channel.current?.close();
      void queryClient.cancelQueries({ queryKey: ROOMMATE_QUERY_KEY });
      queryClient.removeQueries({ queryKey: ROOMMATE_QUERY_KEY });
    };
  }, [clear, leave, queryClient, validate]);

  useEffect(() => {
    if (!currentExpiry) return;
    let timeout: number;
    const scheduleExpiry = () => {
      const remaining = Date.parse(currentExpiry) - Date.now();
      if (remaining <= 0) leave();
      else timeout = window.setTimeout(scheduleExpiry, Math.min(2147483647, remaining));
    };
    scheduleExpiry();
    return () => window.clearTimeout(timeout);
  }, [currentExpiry, leave]);

  return <>
    <RoommateHeading navigationEnabled={ready && !checking && !disabled}><RoommateLogout onStart={startLogout} onSignedOut={leave} /></RoommateHeading>
    {disabled && <p role="status" className="rounded-xl border border-neutral-200 bg-white p-6 text-neutral-700">{text.unavailable}</p>}
    {failed && <div role="alert" className="mb-4 rounded-lg border border-neutral-200 bg-white p-4"><p>{text.failed}</p><button className="mt-2 text-primary-700 underline" type="button" onClick={() => void validate(true)}>{text.retry}</button></div>}
    {ready && !disabled && <div key={identityVersion} ref={privateContents} hidden={checking}>{children}</div>}
    {(!ready || checking) && !failed && !disabled && <p role="status" className="py-8 text-neutral-600">{text.loading}</p>}
  </>;
}
