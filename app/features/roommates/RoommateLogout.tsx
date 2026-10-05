"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale } from "@/app/components/LocaleProvider";
import { Button } from "@/app/components/Button";
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
  return <div className="text-right"><Button variant="ghost" onClick={logout} disabled={pending}>{pending ? text.submitting : text.logout}</Button>{failed && <p role="alert" className="mt-2 text-sm text-red-700">{text.failed}</p>}</div>;
}
