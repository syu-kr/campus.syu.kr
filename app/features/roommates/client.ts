import { localizePath, type Locale } from "@/lib/i18n";
import type { RoommateText } from "@/lib/i18n/roommates";

export const ROOMMATE_QUERY_KEY = ["roommates"] as const;
export const ROOMMATE_CLEAR_EVENT = "roommates:clear";
export const ROOMMATE_CHANNEL = "syu-roommates-session";
export const ROOMMATE_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const EMAIL_KEY = "syu-roommates-pending-email";
const EMAIL_TTL = 24 * 60 * 60 * 1000;
export interface PendingEmail { email: string; remember: boolean; next: string; savedAt: number }

export function safeRoommatePath(value: unknown, locale: Locale): string {
  const fallback = localizePath("/campus/roommates", locale);
  if (typeof value !== "string" || value.includes("\\") || value.includes("?") || value.includes("#")) return fallback;
  const path = value.replace(/^\/en(?=\/)/, "");
  return /^\/campus\/roommates(?:\/(?:new|me|[A-Za-z0-9_-]+))?$/.test(path) && !path.endsWith("/verify")
    ? localizePath(path, locale) : fallback;
}

export function savePendingEmail(value: Omit<PendingEmail, "savedAt">) {
  try { localStorage.setItem(EMAIL_KEY, JSON.stringify({ ...value, savedAt: Date.now() })); } catch { /* User can enter the address again. */ }
}
export function clearPendingEmail() { try { localStorage.removeItem(EMAIL_KEY); } catch { /* Storage can be unavailable. */ } }
export function readPendingEmail(): PendingEmail | null {
  try {
    const value = JSON.parse(localStorage.getItem(EMAIL_KEY) ?? "null") as PendingEmail | null;
    if (!value || typeof value.email !== "string" || typeof value.savedAt !== "number" || Date.now() - value.savedAt >= EMAIL_TTL || value.savedAt > Date.now()) {
      clearPendingEmail(); return null;
    }
    return { ...value, remember: value.remember !== false };
  } catch { clearPendingEmail(); return null; }
}

export class RoommateApiError extends Error {
  constructor(public status: number, public code: string, public field?: string, public retryAt?: string) { super(code); }
}

export async function roommateRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/roommates/${path}`, { ...init, cache: "no-store", credentials: "same-origin", headers: { "Content-Type": "application/json", ...init.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new RoommateApiError(response.status, data.code ?? "REQUEST_FAILED", data.field, data.retryAt);
    if (response.status === 401 || (response.status === 503 && error.code === "FEATURE_DISABLED")) {
      window.dispatchEvent(new CustomEvent(ROOMMATE_CLEAR_EVENT, { detail: { disabled: response.status === 503 } }));
    }
    throw error;
  }
  return data as T;
}

export function roommateErrorMessage(error: unknown, text: RoommateText, locale: Locale): string {
  if (!(error instanceof RoommateApiError)) return text.failed;
  if (error.code === "EMAIL_PROVIDER_LIMIT") return text.emailLimit;
  if (error.code === "EMAIL_DISABLED") return text.emailDisabled;
  if (error.code === "WRITES_DISABLED") return text.writesDisabled;
  if (error.status === 400 && error.field) return text.validation[error.field.split(".")[0] as keyof typeof text.validation] ?? text.invalid;
  const message = error.status === 401 ? text.expired : error.status === 403 ? text.forbidden : error.status === 404 ? text.closed : error.status === 409 ? text.conflict : error.status === 429 ? text.limited : error.status === 503 ? text.unavailable : text.invalid;
  if (error.retryAt && Number.isFinite(Date.parse(error.retryAt))) return `${message} ${text.nextAllowed}: ${new Intl.DateTimeFormat(locale, { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" }).format(new Date(error.retryAt))}`;
  return message;
}

export function jsonRequest(method: string, body: unknown): RequestInit { return { method, body: JSON.stringify(body) }; }
