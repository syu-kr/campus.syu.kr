"use client";

import { memo, useId, useRef, useState, type PointerEvent } from "react";
import { Button } from "@/app/components/Button";
import { useDictionary } from "@/app/components/LocaleContext";
import { DOORS, ROWS, SEATS, SECTION_IDS, SECTION_LABELS, VIEWBOX, type ChapelSeat } from "@/lib/chapel-seats/data";
import { formatChapelSeatText } from "@/lib/i18n/chapel-seats";
import { getRowSeats } from "@/lib/chapel-seats/lookup";
import styles from "./chapel-seats.module.css";

const mapRows = ROWS.filter((row) => row.section === "na").map((row) => ({
  ...row, seats: SEATS.filter((seat) => seat.row === row.row),
}));

export const SeatMap = memo(function SeatMap({ selected }: { selected?: ChapelSeat }) {
  const text = useDictionary().pages.chapelSeats;
  const [focused, setFocused] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: VIEWBOX.width / 2, y: VIEWBOX.height / 2 });
  const drag = useRef<{ pointerId: number; clientX: number; clientY: number; x: number; y: number; scale: number } | null>(null);
  const id = useId();
  const scale = 2 ** (zoom - 1);
  const width = (focused ? 160 : VIEWBOX.width) / scale;
  const height = (focused ? 144 : VIEWBOX.height) / scale;
  const showNumbers = focused || zoom > 1;
  const x = Math.max(0, Math.min(VIEWBOX.width - width, center.x - width / 2));
  const y = Math.max(0, Math.min(VIEWBOX.height - height, center.y - height / 2));
  const rowReferenceX = showNumbers ? x + width / 2 : selected?.x ?? VIEWBOX.width / 2;

  function moveTo(nextX: number, nextY: number) {
    setCenter({
      x: Math.max(0, Math.min(VIEWBOX.width - width, nextX)) + width / 2,
      y: Math.max(0, Math.min(VIEWBOX.height - height, nextY)) + height / 2,
    });
  }

  function changeZoom(nextZoom: number) {
    drag.current = null;
    setCenter({ x: x + width / 2, y: y + height / 2 });
    setZoom(nextZoom);
  }

  function resetView(detail: boolean) {
    drag.current = null;
    setFocused(detail);
    setZoom(1);
    setCenter(detail && selected ? { x: selected.x, y: selected.y } : { x: VIEWBOX.width / 2, y: VIEWBOX.height / 2 });
  }

  function startDrag(event: PointerEvent<SVGSVGElement>) {
    if (!showNumbers || event.button !== 0 || drag.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const renderedScale = Math.min(rect.width / width, rect.height / height);
    if (renderedScale <= 0) return;
    drag.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, x, y, scale: renderedScale };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<SVGSVGElement>) {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    moveTo(start.x - (event.clientX - start.clientX) / start.scale, start.y - (event.clientY - start.clientY) / start.scale);
  }

  function endDrag(event: PointerEvent<SVGSVGElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return <section className={styles.map} aria-labelledby={`${id}-heading`}>
    <div className={styles.mapHeader}>
      <div className={styles.mapHeading}><h2 id={`${id}-heading`}>{text.mapTitle}</h2><p>{text.orientation}</p></div>
      <div className={styles.mapControls}>
        <Button variant="secondary" aria-pressed={!focused} onClick={() => resetView(false)}>{text.wholeMap}</Button>
        <Button variant="secondary" aria-pressed={focused} disabled={!selected} onClick={() => resetView(true)}>{text.selectedSeat}</Button>
        <Button variant="ghost" aria-label={text.zoomOut} disabled={zoom === 1} onClick={() => changeZoom(zoom - 1)}>−</Button>
        <Button variant="ghost" aria-label={text.zoomIn} disabled={zoom === (focused ? 3 : 4)} onClick={() => changeZoom(zoom + 1)}>+</Button>
      </div>
    </div>
    {showNumbers && <p className={styles.mapContext}>
      ↑ {text.stage}{selected && <> · {text.selectedLabel}: {formatChapelSeatText(text.seatLabel, { section: SECTION_LABELS[selected.section], number: selected.number })} · {formatChapelSeatText(text.rowLabel, { row: String(selected.row).padStart(2, "0") })}</>}
    </p>}
    <div className={styles.mapViewport} data-detail={showNumbers} role="group" aria-label={text.panMap}
      tabIndex={showNumbers ? 0 : undefined} aria-describedby={showNumbers ? `${id}-pan-hint` : undefined}
      onKeyDown={(event) => {
        const directions: Record<string, [number, number]> = { ArrowLeft: [-width / 4, 0], ArrowRight: [width / 4, 0], ArrowUp: [0, -height / 4], ArrowDown: [0, height / 4] };
        const direction = directions[event.key];
        if (!showNumbers || !direction) return;
        event.preventDefault();
        moveTo(x + direction[0], y + direction[1]);
      }}>
      <div className={styles.mapRowLabels} aria-hidden="true">
        {mapRows.map((row) => {
          const rowY = row.seats.reduce((closest, seat) => Math.abs(seat.x - rowReferenceX) < Math.abs(closest.x - rowReferenceX) ? seat : closest).y;
          const top = (rowY - y) / height * 100;
          const major = row.row === 1 || row.row === 26 || (row.row % 5 === 0 && row.row !== 25);
          const nearSelected = selected && Math.abs(row.row - selected.row) < 2;
          return top >= 0 && top <= 100 && <span key={row.id} style={{ top: `${top}%` }}
            data-selected={row.row === selected?.row || undefined}
            data-major={(major && !nearSelected) || undefined}>
            {String(row.row).padStart(2, "0")}
          </span>;
        })}
      </div>
      <svg className={styles.svg} viewBox={`${x} ${y} ${width} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}
        data-pannable={showNumbers} onPointerDown={startDrag} onPointerMove={moveDrag}
        onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={() => { drag.current = null; }}>
        <title id={`${id}-title`}>{text.mapTitle}</title><desc id={`${id}-desc`}>{text.mapDescription}</desc>
        <rect x="240" y="40" width="520" height="54" rx="12" className={styles.stage} />
        <text x="500" y="74" textAnchor="middle" className={styles.stageLabel}>{text.stage}</text>
        {!showNumbers && SECTION_IDS.map((section, index) => <text key={section} x={[190, 380, 620, 810][index]} y="150" textAnchor="middle" className={styles.sectionLabel}>{SECTION_LABELS[section]}</text>)}
        {DOORS.map((door) => <rect key={door.id} x={door.x - 9} y={door.y - 9} width="18" height="18" rx="3" className={styles.door} />)}
        {selected && <polyline points={getRowSeats(selected).map((seat) => `${seat.x},${seat.y}`).join(" ")} className={styles.rowGuide} />}
        {SEATS.map((seat) => <g key={seat.id} data-seat-id={seat.id}>
          <rect x={seat.x - 5.5} y={seat.y - 6.5} width="11" height="13" rx="1.5"
            className={`${styles.mapSeat} ${seat.id === selected?.id ? styles.selectedSeat : seat.section === selected?.section ? styles.activeSection : ""}`} />
          {showNumbers && <text x={seat.x} y={seat.y} textAnchor="middle" dominantBaseline="central"
            className={seat.id === selected?.id ? styles.selectedSeatNumber : styles.seatNumber}>{seat.number}</text>}
        </g>)}
        {selected && showNumbers && <g className={styles.selectionIndicator}>
          <rect x={selected.x - 7.5} y={selected.y - 8.5} width="15" height="17" rx="2.5" />
          <text x={selected.x} y={selected.y - 12} textAnchor="middle" dominantBaseline="central">✓</text>
        </g>}
        {selected && !showNumbers && <g className={styles.selectedMarker}>
          <circle cx={selected.x} cy={selected.y} r="9" />
          <text x={selected.x} y={selected.y - 18} textAnchor="middle">{selected.number}</text>
        </g>}
      </svg>
    </div>
    {showNumbers && <div className={styles.panControls}>
      <p id={`${id}-pan-hint`}>{text.panHint}</p>
      <Button variant="ghost" aria-label={text.panLeft} disabled={x === 0} onClick={() => moveTo(x - width / 4, y)}>←</Button>
      <Button variant="ghost" aria-label={text.panUp} disabled={y === 0} onClick={() => moveTo(x, y - height / 4)}>↑</Button>
      <Button variant="ghost" aria-label={text.panDown} disabled={y === VIEWBOX.height - height} onClick={() => moveTo(x, y + height / 4)}>↓</Button>
      <Button variant="ghost" aria-label={text.panRight} disabled={x === VIEWBOX.width - width} onClick={() => moveTo(x + width / 4, y)}>→</Button>
    </div>}
    <div className={styles.legend}><span><i className={styles.legendDoor} aria-hidden="true" />{text.entrance}</span><span><i className={showNumbers ? styles.legendSelected : styles.legendOverviewSelected} aria-hidden="true" />{text.selectedLabel}</span></div>
  </section>;
});
