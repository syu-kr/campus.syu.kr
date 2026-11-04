"use client";

import { useState, type FormEvent } from "react";
import { Container } from "@/app/components/Container";
import { Button } from "@/app/components/Button";
import { useDictionary } from "@/app/components/LocaleContext";
import { SECTION_IDS, SECTION_LABELS, type ChapelSeat } from "@/lib/chapel-seats/data";
import { lookupSeat } from "@/lib/chapel-seats/lookup";
import { formatChapelSeatText } from "@/lib/i18n/chapel-seats";
import { SeatMap } from "./SeatMap";
import { SavedSeatPanel } from "./SavedSeatPanel";
import { SeatRow } from "./SeatRow";
import styles from "./chapel-seats.module.css";

export default function ChapelSeatsPageClient() {
  const text = useDictionary().pages.chapelSeats;
  const [section, setSection] = useState("");
  const [number, setNumber] = useState("");
  const [result, setResult] = useState<ReturnType<typeof lookupSeat> | null>(null);
  const seat = result?.status === "found" ? result.seat : undefined;
  const errors = {
    "invalid-section": text.invalidSection,
    "invalid-number": text.invalidNumber,
    "out-of-range": text.outOfRange,
    unconfirmed: text.unconfirmed,
  };
  const error = result && result.status !== "found" ? errors[result.status] : undefined;
  const summary = seat ? formatChapelSeatText(text.resultSummary, {
    section: SECTION_LABELS[seat.section], number: seat.number, row: String(seat.row).padStart(2, "0"),
  }) : error ?? text.initialHint;

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(lookupSeat(section, number));
  }

  function restore(savedSeat: ChapelSeat) {
    setSection(savedSeat.section);
    setNumber(String(savedSeat.number));
    setResult(lookupSeat(savedSeat.section, String(savedSeat.number)));
  }

  return (
    <Container size="lg" className={styles.page}>
      <header className={styles.header}>
        <h1>{text.title}</h1>
        <p>{text.description}</p>
      </header>
      <form className={styles.search} onSubmit={search} noValidate aria-label={text.find}>
        <div>
          <label htmlFor="chapel-section">{text.section}</label>
          <select id="chapel-section" value={section} aria-invalid={result?.status === "invalid-section"}
            aria-describedby={error ? "chapel-result" : undefined}
            onChange={(event) => { setSection(event.target.value); setResult(null); }}>
            <option value="">{text.sectionPlaceholder}</option>
            {SECTION_IDS.map((id) => <option key={id} value={id}>{SECTION_LABELS[id]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="chapel-number">{text.seatNumber}</label>
          <input id="chapel-number" type="text" inputMode="numeric" autoComplete="off" value={number}
            placeholder={text.numberPlaceholder} aria-invalid={result?.status === "invalid-number" || result?.status === "out-of-range" || result?.status === "unconfirmed"}
            aria-describedby={error ? "chapel-result" : undefined}
            onChange={(event) => { setNumber(event.target.value); setResult(null); }} />
        </div>
        <Button type="submit">{text.find}</Button>
      </form>
      <div className={`${styles.result} ${error ? styles.error : ""}`}>
        <p id="chapel-result" role="status" aria-live="polite" aria-atomic="true">{summary}</p>
        {seat && <>
          <p className={styles.hint}>{text.plateHint}</p>
          {seat.source === "restored" && <p className={styles.hint}>{text.restoredHint}</p>}
        </>}
      </div>
      <SeatMap key={seat?.id ?? "overview"} selected={seat} />
      {seat && <SeatRow seat={seat} />}
      <SavedSeatPanel selected={seat} searchKey={`${section}:${number}`} onRestore={restore} />
      <p className={styles.footerHint}>{text.assignmentHint}</p>
    </Container>
  );
}
