"use client";

import { useEffect, useRef } from "react";
import { useDictionary } from "@/app/components/LocaleContext";
import { SECTION_LABELS, type ChapelSeat } from "@/lib/chapel-seats/data";
import { getRowSeats } from "@/lib/chapel-seats/lookup";
import { formatChapelSeatText } from "@/lib/i18n/chapel-seats";
import styles from "./chapel-seats.module.css";

export function SeatRow({ seat }: { seat: ChapelSeat }) {
  const text = useDictionary().pages.chapelSeats;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const rowSeats = getRowSeats(seat);
  const partial = (seat.section === "ga" || seat.section === "ra") && seat.row <= 3;

  useEffect(() => {
    const scroller = scrollerRef.current;
    const selected = scroller?.querySelector<HTMLElement>('[data-selected="true"]');
    if (!scroller || !selected) return;
    const item = selected.getBoundingClientRect();
    const viewport = scroller.getBoundingClientRect();
    scroller.scrollLeft += item.left - viewport.left - (scroller.clientWidth - item.width) / 2;
  }, [seat.id]);

  return <section className={styles.rowDetail} aria-labelledby="chapel-row-title">
    <div className={styles.rowHeading}>
      <div>
        <h2 id="chapel-row-title">{text.rowDetail}</h2>
        <p className={styles.rowSummary}>{formatChapelSeatText(text.resultSummary, {
          section: SECTION_LABELS[seat.section], number: seat.number, row: String(seat.row).padStart(2, "0"),
        })}</p>
      </div>
      <p className={styles.rowPosition}>{partial
        ? formatChapelSeatText(text.partialRowHint, { count: rowSeats.length })
        : formatChapelSeatText(text.rowPosition, { position: rowSeats.findIndex((item) => item.id === seat.id) + 1, count: rowSeats.length })}</p>
    </div>
    <div ref={scrollerRef} className={styles.rowScroller} tabIndex={0} role="group" aria-label={text.rowDetail}>
      <div className={styles.rowTrack}>
        <div className={styles.rowDirection}><span>{text.rowStart}</span><span>{text.rowEnd}</span></div>
        <ol className={styles.rowNumbers}>
          {rowSeats.map((item) => <li key={item.id} data-selected={item.id === seat.id || undefined}>
            <span aria-current={item.id === seat.id ? "true" : undefined}>{item.number}</span>
            {item.id === seat.id && <span className={styles.rowCheck} aria-hidden="true">✓</span>}
            {item.id === seat.id && <span className="sr-only">{text.selectedLabel}</span>}
          </li>)}
        </ol>
      </div>
    </div>
  </section>;
}
