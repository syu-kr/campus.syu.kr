"use client";

import { useState, type FormEvent } from "react";
import { useLocale } from "@/app/components/LocaleProvider";
import { Button } from "@/app/components/Button";
import { getRoommateText } from "@/lib/i18n/roommates";
import { ROOMMATE_DORMS } from "@/lib/roommates";
import type { RoommateDorm, RoommatePostFilters } from "@/types/roommates";
import { HabitFields, inputClass } from "./RoommateShared";

export default function RoommateFilters({ initialFilters, onApply }: { initialFilters: RoommatePostFilters; onApply: (filters: RoommatePostFilters) => void }) {
  const text = getRoommateText(useLocale());
  const [draft, setDraft] = useState(initialFilters);
  const activeCount = [initialFilters.dorm, initialFilters.roomSize, initialFilters.stayStart, initialFilters.stayEnd, ...Object.values(initialFilters.habits ?? {})].filter((value) => Array.isArray(value) ? value.length > 0 : !!value).length;
  function apply(event: FormEvent) { event.preventDefault(); onApply(draft); }
  return <details className="group/filter mb-6 rounded-xl border border-neutral-200 bg-white">
    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 [&::-webkit-details-marker]:hidden">
      <span className="flex items-center gap-2 font-semibold text-neutral-900"><svg aria-hidden="true" className="size-5 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" d="M4 6h16M7 12h10M10 18h4" /></svg>{text.filters}</span>
      <span className="flex items-center gap-3">{activeCount > 0 && <span className="rounded-md bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700">{text.activeFilters.replace("{count}", String(activeCount))}</span>}<svg aria-hidden="true" className="size-4 text-neutral-500 transition-transform group-open/filter:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg></span>
    </summary>
    <form onSubmit={apply} className="space-y-5 border-t border-neutral-100 p-5">
      <p className="text-sm leading-relaxed text-neutral-500">{text.filterHelp}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">{text.dorm}<select className={inputClass} value={draft.dorm ?? ""} onChange={(event) => setDraft({ ...draft, dorm: event.target.value as RoommateDorm || undefined })}>
          <option value="">{text.all}</option>{ROOMMATE_DORMS.map((dorm) => <option key={dorm.value} value={dorm.value}>{text.dorms[dorm.value]}</option>)}
        </select></label>
        <label className="text-sm font-medium">{text.roomSize}<select className={inputClass} value={draft.roomSize ?? ""} onChange={(event) => setDraft({ ...draft, roomSize: event.target.value ? Number(event.target.value) : undefined })}>
          <option value="">{text.all}</option>{[2, 3, 4].map((size) => <option key={size} value={size}>{size} {text.roomUnit}</option>)}
        </select></label>
        <label className="text-sm font-medium">{text.stayStart}<input className={inputClass} type="date" value={draft.stayStart ?? ""} onChange={(event) => setDraft({ ...draft, stayStart: event.target.value || undefined })} /></label>
        <label className="text-sm font-medium">{text.stayEnd}<input className={inputClass} type="date" min={draft.stayStart} value={draft.stayEnd ?? ""} onChange={(event) => setDraft({ ...draft, stayEnd: event.target.value || undefined })} /></label>
      </div>
      <details open={Object.keys(initialFilters.habits ?? {}).length > 0 || undefined} className="border-t border-neutral-100 pt-2">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-neutral-700 focus-visible:outline-2 focus-visible:outline-primary-500">{text.habits}</summary>
        <div className="pt-2"><HabitFields emptyLabel={text.all} value={draft.habits ?? {}} onChange={(habits) => setDraft({ ...draft, habits })} /></div>
      </details>
      <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-5"><Button type="submit">{text.apply}</Button><Button variant="secondary" onClick={() => { setDraft({}); onApply({}); }}>{text.reset}</Button></div>
    </form>
  </details>;
}
