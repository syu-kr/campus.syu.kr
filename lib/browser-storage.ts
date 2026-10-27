// Storage may be unavailable in private browsing or when site data is blocked.
export function readSessionValue(key: string): string | null {
  try { return typeof window === "undefined" ? null : window.sessionStorage.getItem(key); }
  catch { return null; }
}

export function writeSessionValue(key: string, value: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    window.sessionStorage.setItem(key, value);
    return true;
  } catch { return false; }
}

export function removeSessionValue(key: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    window.sessionStorage.removeItem(key);
    return true;
  } catch { return false; }
}
