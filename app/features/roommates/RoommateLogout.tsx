"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale } from "@/app/components/LocaleProvider";
import { localizePath } from "@/lib/i18n";
import { getRoommateText } from "@/lib/i18n/roommates";
import { clearRoommateAuth } from "@/lib/firebaseRoommates";
import { ROOMMATE_CHANNEL, ROOMMATE_QUERY_KEY, clearPendingEmail, roommateRequest } from "./client";

export default function RoommateLogout({ onStart, onSignedOut }: { onStart?: () => void; onSignedOut?: () => void }) {
  const locale = useLocale(); const text = getRoommateText(locale); const queryClient = useQueryClient();
  const [pending, setPending] = useState(false); const [failed, setFailed] = useState(false);
  async function logout() {
    setPending(true); setFailed(false); onStart?.();
    void queryClient.cancelQueries({ queryKey: ROOMMATE_QUERY_KEY }); queryClient.removeQueries({ queryKey: ROOMMATE_QUERY_KEY });
    try {
      await roommateRequest("auth/logout", { method: "POST", body: "{}" });
      clearPendingEmail(); await clearRoommateAuth();
      if (typeof BroadcastChannel !== "undefined") { const channel = new BroadcastChannel(ROOMMATE_CHANNEL); channel.postMessage("cleared"); channel.close(); }
      if (onSignedOut) onSignedOut(); else window.location.replace(localizePath("/campus", locale));
    } catch { setFailed(true); setPending(false); }
  }
  return <div className="text-right"><button type="button" onClick={logout} disabled={pending} className="inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:opacity-50 sm:text-base">{pending ? text.submitting : text.logout}</button>{failed && <p role="alert" className="mt-2 text-sm text-red-700">{text.failed}</p>}</div>;
}
