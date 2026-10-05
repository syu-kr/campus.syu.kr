"use client";

import { useEffect, useState } from "react";

export function useRoommateClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const update = () => setNow(Date.now());
    const interval = window.setInterval(update, 60000);
    window.addEventListener("focus", update);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", update); };
  }, []);
  return now;
}
