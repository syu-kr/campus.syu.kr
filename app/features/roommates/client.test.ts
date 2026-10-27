import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROOMMATE_CLEAR_EVENT, RoommateApiError, roommateErrorMessage, clearPendingEmail, readPendingEmail, roommateRequest, safeRoommatePath, savePendingEmail } from "./client";
import { getRoommateText } from "@/lib/i18n/roommates";

describe("roommate browser privacy", () => {
  it.each(["ko", "en"] as const)("does not blame inputs for a server failure in %s", (locale) => {
    const text = getRoommateText(locale);
    expect(roommateErrorMessage(new RoommateApiError(500, "INTERNAL_ERROR"), text, locale)).toBe(text.failed);
    expect(roommateErrorMessage(new RoommateApiError(400, "INVALID_BODY"), text, locale)).toBe(text.invalid);
    expect(roommateErrorMessage(new TypeError("Failed to fetch"), text, locale)).toBe(text.failed);
  });
  it("rejects unreadable success bodies and still clears private UI for an unreadable 401", async () => {
    const clear = vi.fn(); window.addEventListener(ROOMMATE_CLEAR_EVENT, clear);
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response("upstream html"))
      .mockResolvedValueOnce(Response.json(null))
      .mockResolvedValueOnce(new Response("upstream html", { status: 401 })));
    await expect(roommateRequest("posts", { method: "POST" })).rejects.toThrow();
    await expect(roommateRequest("posts", { method: "POST" })).rejects.toThrow();
    expect(clear).not.toHaveBeenCalled();
    await expect(roommateRequest("posts")).rejects.toMatchObject({ status: 401 });
    expect(clear).toHaveBeenCalledTimes(1);
    window.removeEventListener(ROOMMATE_CLEAR_EVENT, clear);
  });
  beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });
  it("allows only internal roommate destinations and keeps the current locale", () => {
    expect(safeRoommatePath("/campus/roommates/abc_123", "en")).toBe("/en/campus/roommates/abc_123");
    for (const value of ["https://evil.example", "//evil.example", "/campus/roommates/verify", "/campus/roommates/x?email=x", "/campus/roommates/../admin", "/en/campus/roommates/verify/finish"]) expect(safeRoommatePath(value, "ko")).toBe("/campus/roommates");
  });
  it("expires a temporary email after 24 hours and removes it on cancellation", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    savePendingEmail({ email: "student@syuin.ac.kr", remember: false, next: "/campus/roommates/me" });
    expect(readPendingEmail()?.remember).toBe(false);
    vi.spyOn(Date, "now").mockReturnValue(1_000_000 + 24 * 3600000);
    expect(readPendingEmail()).toBeNull();
    expect(localStorage.length).toBe(0);
    savePendingEmail({ email: "student@syuin.ac.kr", remember: true, next: "/campus/roommates" });
    clearPendingEmail(); expect(readPendingEmail()).toBeNull();
  });
  it("clears private UI for 401 and feature disable, but not an infrastructure outage", async () => {
    const clear = vi.fn(); window.addEventListener(ROOMMATE_CLEAR_EVENT, clear);
    const request = vi.fn().mockResolvedValueOnce(Response.json({ code: "AUTH_UNAVAILABLE" }, { status: 503 })).mockResolvedValueOnce(Response.json({ code: "SESSION_EXPIRED" }, { status: 401 })).mockResolvedValueOnce(Response.json({ code: "FEATURE_DISABLED" }, { status: 503 }));
    vi.stubGlobal("fetch", request);
    await expect(roommateRequest("posts")).rejects.toMatchObject({ status: 503 }); expect(clear).not.toHaveBeenCalled();
    await expect(roommateRequest("posts")).rejects.toMatchObject({ status: 401 }); expect(clear).toHaveBeenCalledTimes(1);
    await expect(roommateRequest("posts")).rejects.toMatchObject({ status: 503 }); expect(clear).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][1]).toMatchObject({ cache: "no-store", credentials: "same-origin" });
    window.removeEventListener(ROOMMATE_CLEAR_EVENT, clear);
  });
});
