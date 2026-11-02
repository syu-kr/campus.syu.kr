import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ClientLocaleProvider } from "@/app/components/LocaleContext";
import { getDictionary, type Locale } from "@/lib/i18n";
import { pilotCopy } from "@/lib/i18n/shuttle-pilot";
import type { BusLocation } from "@/types";
import PilotDiagnostics from "./PilotDiagnostics";

const m=vi.hoisted(()=>({signedIn:true,fetch:vi.fn()}));
vi.mock("@/lib/firebase",()=>({auth:{authStateReady:async()=>{},get currentUser(){return m.signedIn?{getIdToken:async()=>"test-token"}:null;}}}));
const bus:BusLocation={id:"test-vehicle",name:"Test vehicle",lat:"37.62",lon:"127.08",routeid:1,status:2};
function view(locale:Locale="ko",vehicle=bus,closed=false){
  return <ClientLocaleProvider locale={locale} dictionary={getDictionary(locale)}>
    <PilotDiagnostics closed={closed} etaStatus="collecting" locations={[vehicle]}/>
  </ClientLocaleProvider>;
}
beforeEach(()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date("2026-11-02T09:00:00+09:00"));
  vi.spyOn(Math,"random").mockReturnValue(0);m.signedIn=true;m.fetch.mockReset().mockImplementation(async()=>Response.json({collection:"saved"}));
  vi.stubGlobal("fetch",m.fetch);
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});
async function start(locale:Locale="ko"){
  fireEvent.click(screen.getByText(pilotCopy[locale].title));
  await act(async()=>{fireEvent.click(screen.getByRole("button",{name:pilotCopy[locale].start}));});
}
it("samples at randomized 5–10 second intervals while recording and cancels cleanly",async()=>{
  const {unmount}=render(view());await start();
  expect(m.fetch).toHaveBeenCalledTimes(1);
  await act(async()=>{await vi.advanceTimersByTimeAsync(5_000);});
  expect(m.fetch).toHaveBeenCalledTimes(2);
  const signal=m.fetch.mock.calls[1][1].signal as AbortSignal;
  unmount();expect(signal.aborted).toBe(true);
  await act(async()=>{await vi.advanceTimersByTimeAsync(30_000);});
  expect(m.fetch).toHaveBeenCalledTimes(2);
});
it.each(["ko","en"] as const)("requires an explicit field attestation before saving a %s arrival",async locale=>{
  render(view(locale));await start(locale);const copy=pilotCopy[locale];
  expect(screen.getByRole("combobox",{name:copy.vehicle})).toBeInTheDocument();
  expect(screen.getByRole("combobox",{name:copy.visit})).toBeInTheDocument();
  const button=screen.getByRole("button",{name:copy.events.arrival});
  expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox",{name:copy.confirm}));
  expect(button).toBeEnabled();
  await act(async()=>{fireEvent.click(button);});
  const request=m.fetch.mock.calls[1][1];
  expect(JSON.parse(request.body)).toEqual({event:{vehicleId:bus.id,visitId:"hwarangdae-5-campus",event:"arrival",observedAt:Date.now()}});
  expect(request.headers["Content-Type"]).toBe("application/json");
  expect(screen.getByText(copy.fieldSaved)).toBeInTheDocument();
});
it("invalidates the attestation when the received vehicle direction changes",async()=>{
  const {rerender}=render(view());await start();
  fireEvent.click(screen.getByRole("checkbox",{name:pilotCopy.ko.confirm}));
  expect(screen.getByRole("button",{name:pilotCopy.ko.events.arrival})).toBeEnabled();
  rerender(view("ko",{...bus,status:1}));
  expect(screen.getByRole("checkbox",{name:pilotCopy.ko.confirm})).not.toBeChecked();
  expect(screen.getByRole("button",{name:pilotCopy.ko.events.arrival})).toBeDisabled();
});
it("does not claim a failed field save succeeded",async()=>{
  render(view());await start();
  m.fetch.mockResolvedValueOnce(Response.json({}, {status:503}));
  fireEvent.click(screen.getByRole("checkbox",{name:pilotCopy.ko.confirm}));
  await act(async()=>{fireEvent.click(screen.getByRole("button",{name:pilotCopy.ko.events.departure}));});
  expect(screen.getByText(pilotCopy.ko.fieldError)).toBeInTheDocument();
  expect(screen.queryByText(pilotCopy.ko.fieldSaved)).not.toBeInTheDocument();
});
it("does not collect without an administrator login or while closed",async()=>{
  m.signedIn=false;const {unmount}=render(view());await start();
  expect(screen.getByText(pilotCopy.ko.states.login)).toBeInTheDocument();expect(m.fetch).not.toHaveBeenCalled();
  unmount();render(view("ko",bus,true));fireEvent.click(screen.getByText(pilotCopy.ko.title));
  expect(screen.getByRole("button",{name:pilotCopy.ko.start})).toBeDisabled();
  expect(m.fetch).not.toHaveBeenCalled();
});
