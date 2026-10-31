"use client";

import { useEffect, useState } from "react";
import { Button } from "@/app/components/Button";
import { useLocale } from "@/app/components/LocaleProvider";
import { pilotCopy } from "@/lib/i18n/shuttle-pilot";

export default function PilotDiagnostics({closed, etaStatus}:{closed:boolean; etaStatus:string}) {
  const copy = pilotCopy[useLocale()];
  const [recording, setRecording] = useState(false), [result, setResult] = useState("");
  const [checked, setChecked] = useState<boolean|null>(null);
  useEffect(() => {
    if (!recording || closed) return;
    const controller = new AbortController();
    let timer:ReturnType<typeof setTimeout>;
    async function sample() {
      try {
        const {auth} = await import("@/lib/firebase");
        await auth.authStateReady();
        const token = await auth.currentUser?.getIdToken();
        if (controller.signal.aborted) return;
        if (!token) { setResult("login"); setRecording(false); return; }
        const response = await fetch("/campus/bus-info/preview/locations", {
          method:"POST", cache:"no-store", headers:{Authorization:`Bearer ${token}`}, signal:controller.signal,
        });
        if (controller.signal.aborted) return;
        if (response.status === 401 || response.status === 403) { setResult("login"); setRecording(false); return; }
        if (!response.ok) throw new Error("Collection failed");
        const {collection} = await response.json();
        if (controller.signal.aborted) return;
        setResult(collection);
        if (collection === "closed" || collection === "local") { setRecording(false); return; }
        timer = setTimeout(sample, 60_000);
      } catch { if (!controller.signal.aborted) { setResult("error"); setRecording(false); } }
    }
    void sample();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [recording, closed]);
  async function check() {
    try {
      const res = await fetch("/campus/bus-info/preview/eta?check=1",{cache:"no-store"});
      setChecked(res.ok && (await res.json()).passed === true);
    } catch { setChecked(false); }
  }
  return <details className="shuttle-service-disclosure border border-neutral-200">
    <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">{copy.title}</summary>
    <div className="space-y-2 px-4 pb-4 text-sm">
      <p>{closed ? copy.closed : copy.scope}</p>
      <p>{etaStatus === "collecting" ? copy.noModel : copy.requirements}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={closed && !recording} onClick={()=>{setResult("");setRecording(!recording);}}>{recording?copy.stop:copy.start}</Button>
        <Button variant="ghost" onClick={()=>void check()}>{copy.check}</Button>
      </div>
      <p role="status">{closed ? "" : copy.states[result] ?? ""} {checked === null ? "" : checked ? copy.pass : copy.fail}</p>
    </div>
  </details>;
}
