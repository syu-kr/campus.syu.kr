"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/app/components/Button";
import { useDictionary, useLocale } from "@/app/components/LocaleContext";
import { SECTION_LABELS, type ChapelSeat } from "@/lib/chapel-seats/data";
import { SAVED_SEAT_KEY, readSavedSeat, saveSeat, deleteSavedSeat } from "@/lib/chapel-seats/storage";
import { formatChapelSeatText } from "@/lib/i18n/chapel-seats";
import styles from "./chapel-seats.module.css";

export function SavedSeatPanel({ selected, searchKey, onRestore }: {
  selected?: ChapelSeat;
  searchKey: string;
  onRestore: (seat: ChapelSeat) => void;
}) {
  const text = useDictionary().pages.chapelSeats;
  const locale = useLocale();
  const [saved, setSaved] = useState<ReturnType<typeof readSavedSeat> | null>(null);
  const context = `${searchKey}:${selected?.id ?? ""}`;
  const [message, setMessage] = useState({ context, text: "" });
  if (message.context !== context) setMessage({ context, text: "" });
  const refresh = useCallback(() => {
    try { setSaved(readSavedSeat(window.localStorage)); }
    catch { setSaved({ status: "unavailable" }); }
  }, []);
  useEffect(() => {
    refresh();
    const onStorage = (event: StorageEvent) => { if (event.key === SAVED_SEAT_KEY || event.key === null) refresh(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  function persist() {
    if (!selected) return;
    try {
      if (!saveSeat(window.localStorage, selected)) { setMessage({ context, text: text.storageError }); return; }
      refresh();
      setMessage({ context, text: text.savedSuccess });
    } catch { setMessage({ context, text: text.storageError }); }
  }

  function remove() {
    try {
      if (!deleteSavedSeat(window.localStorage)) { setMessage({ context, text: text.storageError }); return; }
      refresh();
      setMessage({ context, text: text.deletedSuccess });
    } catch { setMessage({ context, text: text.storageError }); }
  }

  const stored = saved?.status === "saved" ? saved : null;
  const same = stored?.seat?.id === selected?.id && !stored?.needsConfirmation;
  const savedLabel = stored ? formatChapelSeatText(text.resultSummary, {
    section: SECTION_LABELS[stored.value.section], number: stored.value.number,
    row: stored.seat ? String(stored.seat.row).padStart(2, "0") : "—",
  }) : saved === null ? text.loadingSaved : saved.status === "invalid" ? text.savedInvalid
    : saved.status === "unavailable" ? text.savedUnavailable : text.savedEmpty;
  const date = stored ? new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric", month: "short", day: "numeric",
  }).format(new Date(stored.value.savedAt)) : "";

  return <section className={styles.saved} aria-labelledby="chapel-saved-title">
    <div>
      <h2 id="chapel-saved-title">{text.savedTitle}</h2>
      <p>{savedLabel}</p>
      {stored && <p className={styles.hint}>{formatChapelSeatText(text.savedAt, { date })}</p>}
      {stored?.needsConfirmation && <p className={styles.hint}>{text.savedNeedsConfirmation}</p>}
      {stored && !stored.seat && <p className={styles.hint}>{text.savedMissing}</p>}
    </div>
    <div className={styles.actions}>
      {stored?.seat && <Button variant="secondary" onClick={() => onRestore(stored.seat!)}>{text.restore}</Button>}
      {selected && <Button variant="secondary" onClick={persist} disabled={same}>
        {same ? text.sameSaved : stored ? text.replace : text.save}
      </Button>}
      {saved && saved.status !== "empty" && saved.status !== "unavailable" && <Button variant="ghost" onClick={remove}>{text.remove}</Button>}
    </div>
    <p className={styles.actionStatus} role="status" aria-live="polite">{message.text}</p>
  </section>;
}
