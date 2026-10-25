"use client";

import { useLayoutEffect, useRef, useState } from "react";
import "./page-motion.css";

interface Position { left: number; top: number; width: number; height: number; animate: boolean }

export function SlidingIndicator({ value }: { value: string | number }) {
  const markerRef = useRef<HTMLSpanElement>(null);
  const measured = useRef(false);
  const [position, setPosition] = useState<Position | null>(null);

  useLayoutEffect(() => {
    const track = markerRef.current?.parentElement;
    if (!track) return;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const target = Array.from(track.querySelectorAll<HTMLElement>("[data-selection-value]"))
        .find(element => element.dataset.selectionValue === String(value));
      if (!target || target.offsetWidth === 0 || target.offsetHeight === 0) {
        measured.current = false;
        setPosition(null);
        return;
      }
      // Layout offsets ignore press transforms and include nested pagination wrappers.
      let left = 0, top = 0, parent: HTMLElement | null = target;
      while (parent && parent !== track) {
        left += parent.offsetLeft;
        top += parent.offsetTop;
        parent = parent.offsetParent as HTMLElement | null;
      }
      const next = { left, top, width: target.offsetWidth, height: target.offsetHeight, animate: measured.current };
      setPosition(current => current && current.left === left && current.top === top && current.width === next.width && current.height === next.height ? current : next);
      measured.current = true;
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(track);
    track.querySelectorAll<HTMLElement>("[data-selection-value]").forEach(element => observer?.observe(element));
    window.addEventListener("resize", measure);
    void document.fonts?.ready.then(measure);
    return () => { disposed = true; observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [value]);

  return <span ref={markerRef} className="m3-sliding-indicator" aria-hidden="true"
    data-ready={position ? "true" : undefined} data-animate={position?.animate ? "true" : undefined}
    style={position ? { width: position.width, height: position.height, transform: `translate(${position.left}px, ${position.top}px)` } : undefined} />;
}
