"use client";

import { useCallback, useEffect, useRef, type CompositionEvent } from "react";

export function useListSearchNavigation(commit: (query: string) => void) {
  const currentCommit = useRef(commit);
  useEffect(() => { currentCommit.current = commit; }, [commit]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef(false);
  const composing = useRef(false);
  const cancel = useCallback(() => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
    pending.current = false;
  }, []);
  const schedule = useCallback((query: string) => {
    cancel();
    pending.current = true;
    if (composing.current) return;
    timer.current = setTimeout(() => {
      timer.current = undefined;
      pending.current = false;
      currentCommit.current(query);
    }, 250);
  }, [cancel]);
  useEffect(() => {
    window.addEventListener("popstate", cancel);
    return () => { window.removeEventListener("popstate", cancel); cancel(); };
  }, [cancel]);
  return {
    pending, schedule, cancel,
    // Container capture also sees unrelated forms rendered through portals.
    onCompositionStartCapture: (event: CompositionEvent<HTMLElement>) => {
      if (!(event.target instanceof HTMLInputElement) || event.target.form?.getAttribute("role") !== "search") return;
      composing.current = true;
      cancel();
    },
    onCompositionEndCapture: (event: CompositionEvent<HTMLElement>) => {
      if (!(event.target instanceof HTMLInputElement) || event.target.form?.getAttribute("role") !== "search") return;
      composing.current = false;
      schedule(event.target.value);
    },
  };
}
