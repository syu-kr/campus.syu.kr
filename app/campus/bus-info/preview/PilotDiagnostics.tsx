"use client";

import { useEffect, useState } from "react";
import { Button } from "@/app/components/Button";
import { useLocale } from "@/app/components/LocaleProvider";
import { pilotCopy } from "@/lib/i18n/shuttle-pilot";
import { M3Select } from "@/app/components/M3Select";
import { pilotVisits, type PilotFieldEvent } from "@/lib/shuttle-observations";
import type { BusLocation } from "@/types";
import { shuttleRefreshDelay } from "@/lib/shuttle-polling";

async function saveSample(signal?: AbortSignal, event?: PilotFieldEvent): Promise<string> {
  const {auth} = await import("@/lib/firebase");
  await auth.authStateReady();
  const token = await auth.currentUser?.getIdToken();
  signal?.throwIfAborted();
  if (!token) return "login";
  const response = await fetch("/campus/bus-info/preview/locations", {
    method:"POST", cache:"no-store", headers:{Authorization:`Bearer ${token}`, ...(event ? {"Content-Type":"application/json"} : {})},
    body:event ? JSON.stringify({event}) : undefined, signal,
  });
  if (response.status === 401 || response.status === 403) return "login";
  if (!response.ok) throw new Error("Collection failed");
  const {collection} = await response.json();
  if (typeof collection !== "string") throw new Error("Invalid collection result");
  return collection;
}

export default function PilotDiagnostics({closed, etaStatus, locations = []}:{closed:boolean; etaStatus:string; locations?:BusLocation[]}) {
  const locale = useLocale(), copy = pilotCopy[locale];
  const [recording, setRecording] = useState(false), [result, setResult] = useState("");
  const [checked, setChecked] = useState<boolean|null>(null);
  const [vehicleId, setVehicleId] = useState(""), [visitId, setVisitId] = useState("");
  const [confirmedFor, setConfirmedFor] = useState<string|null>(null), [fieldBusy, setFieldBusy] = useState(false), [fieldResult, setFieldResult] = useState("");
  const vehicle = locations.find(bus => bus.id === vehicleId) ?? locations[0];
  const visits = vehicle ? pilotVisits(vehicle.routeid, vehicle.status) : [];
  const selectedVisit = visits.find(visit => visit.id === visitId) ?? visits[0];
  const selectionKey = `${vehicle?.id}:${vehicle?.status}:${selectedVisit?.id}`;
  const confirmed = confirmedFor === selectionKey;
  useEffect(() => {
    if (!recording || closed) return;
    const controller = new AbortController();
    let timer:ReturnType<typeof setTimeout>;
    async function sample() {
      try {
        const collection = await saveSample(controller.signal);
        if (controller.signal.aborted) return;
        setResult(collection);
        if (["login", "closed", "local"].includes(collection)) { setRecording(false); return; }
        timer = setTimeout(sample, shuttleRefreshDelay());
      } catch { if (!controller.signal.aborted) { setResult("error"); setRecording(false); } }
    }
    void sample();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [recording, closed]);
  async function recordField(event: PilotFieldEvent["event"], observedAt: number) {
    if (!recording || closed || !confirmed || !vehicle || !selectedVisit || fieldBusy) return;
    setFieldBusy(true); setFieldResult(copy.saving);
    try {
      const collection = await saveSample(undefined, {vehicleId:vehicle.id, visitId:selectedVisit.id, event, observedAt});
      setFieldResult(collection === "saved" || collection === "duplicate" ? copy.fieldSaved : copy.states[collection] ?? copy.fieldError);
    } catch { setFieldResult(copy.fieldError); }
    finally { setFieldBusy(false); }
  }
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
      {recording && !closed && vehicle && selectedVisit && <fieldset className="space-y-3 border-t border-neutral-200 pt-3" aria-busy={fieldBusy}>
        <legend className="font-semibold">{copy.fieldTitle}</legend>
        <p id="pilot-field-help" className="text-neutral-600">{copy.fieldHelp}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label id="pilot-field-vehicle-label" htmlFor="pilot-field-vehicle">{copy.vehicle}</label>
            <M3Select id="pilot-field-vehicle" value={vehicle.id} onValueChange={value=>{setVehicleId(value);setConfirmedFor(null);}}
              options={locations.map((bus,index)=>({value:bus.id,label:`${copy.vehicleNumber.replace("{number}",String(index+1))} · ${bus.name}`}))}/></div>
          <div><label id="pilot-field-visit-label" htmlFor="pilot-field-visit">{copy.visit}</label>
            <M3Select id="pilot-field-visit" value={selectedVisit.id} onValueChange={value=>{setVisitId(value);setConfirmedFor(null);}}
              options={visits.map(visit=>({value:visit.id,label:visit.label[locale]}))}/></div>
        </div>
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={confirmed}
          onChange={event=>setConfirmedFor(event.target.checked?selectionKey:null)} aria-describedby="pilot-field-help"/>{copy.confirm}</label>
        <div className="flex flex-wrap gap-2">{(["arrival","departure","pass"] as const).map(event=><Button key={event} variant="secondary"
          disabled={!confirmed || fieldBusy} aria-describedby="pilot-field-help" onClick={()=>void recordField(event, Date.now())}>{copy.events[event]}</Button>)}</div>
        <p role="status">{fieldResult}</p>
      </fieldset>}
    </div>
  </details>;
}
