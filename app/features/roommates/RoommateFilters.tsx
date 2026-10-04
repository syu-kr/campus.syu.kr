"use client";

import { useState, type FormEvent } from "react";
import { useLocale } from "@/app/components/LocaleProvider";
import { getRoommateText } from "@/lib/i18n/roommates";
import { ROOMMATE_DORMS } from "@/lib/roommates";
import type { RoommateDorm, RoommatePostFilters } from "@/types/roommates";
import { HabitFields, inputClass, primaryClass, secondaryClass } from "./RoommateShared";

export default function RoommateFilters({ initialFilters, onApply }: { initialFilters: RoommatePostFilters; onApply: (filters: RoommatePostFilters) => void }) {
  const text = getRoommateText(useLocale());
  const [draft, setDraft] = useState(initialFilters);
  function apply(event: FormEvent) { event.preventDefault(); onApply(draft); }
  return <details className="mb-6 rounded-xl border border-neutral-200 bg-white p-4">
    <summary className="cursor-pointer py-1 font-semibold text-neutral-800">{text.filters}</summary>
    <form onSubmit={apply} className="mt-4 space-y-4">
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
      <HabitFields emptyLabel={text.all} value={draft.habits ?? {}} onChange={(habits) => setDraft({ ...draft, habits })} />
      <div className="flex gap-2"><button className={primaryClass}>{text.apply}</button><button type="button" onClick={() => { setDraft({}); onApply({}); }} className={secondaryClass}>{text.reset}</button></div>
    </form>
  </details>;
}
