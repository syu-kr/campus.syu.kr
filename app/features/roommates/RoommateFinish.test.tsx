import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RoommateFinish from "./RoommateFinish";
import { savePendingEmail } from "./client";

const mocks = vi.hoisted(() => ({ getAuth: vi.fn(), isEmailLink: vi.fn(), signIn: vi.fn(), clearAuth: vi.fn() }));
vi.mock("@/lib/firebaseRoommates", () => ({ getRoommateAuth: mocks.getAuth, clearRoommateAuth: mocks.clearAuth }));
vi.mock("firebase/auth", () => ({ isSignInWithEmailLink: mocks.isEmailLink, signInWithEmailLink: mocks.signIn }));

describe("roommate email link completion", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear(); mocks.signIn.mockClear(); mocks.clearAuth.mockClear();
    mocks.isEmailLink.mockReset().mockReturnValue(true);
    window.history.replaceState(null, "", "/campus/roommates/verify/finish?oobCode=private-link");
    mocks.getAuth.mockResolvedValue({ currentUser: { getIdTokenResult: async () => ({ token: "temporary-id-token", claims: { auth_time: Math.floor(Date.now() / 1000) } }) } });
  });
  function show() { return render(<QueryClientProvider client={new QueryClient()}><RoommateFinish /></QueryClientProvider>); }
  it("offers a new email when the URL is not a recognized sign-in link", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); mocks.isEmailLink.mockReturnValue(false);
    savePendingEmail({ email: "student@syuin.ac.kr", remember: true, next: "/campus/roommates" });
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent("이 인증 링크를 사용할 수 없습니다");
    expect(screen.getByRole("link", { name: "새 인증 메일 받기" })).toHaveAttribute("href", "/campus/roommates/verify");
    expect(mocks.signIn).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });
  it.each(["auth/invalid-action-code", "auth/expired-action-code"])("recovers from %s without issuing a session or exposing credentials", async (code) => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    mocks.signIn.mockRejectedValueOnce({ code, message: "private-link student@syuin.ac.kr" });
    savePendingEmail({ email: "student@syuin.ac.kr", remember: false, next: "/campus/roommates/me" });
    show();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("이 인증 링크를 사용할 수 없습니다");
    expect(alert).not.toHaveTextContent("private-link"); expect(alert).not.toHaveTextContent("student@syuin.ac.kr");
    expect(mocks.signIn).toHaveBeenCalledTimes(1); expect(fetch).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
    const fresh = screen.getByRole("link", { name: "새 인증 메일 받기" });
    expect(fresh).toHaveAttribute("href", "/campus/roommates/verify");
    fresh.addEventListener("click", (event) => event.preventDefault()); fireEvent.click(fresh);
    expect(mocks.clearAuth).toHaveBeenCalled(); expect(localStorage.getItem("syu-roommates-pending-email")).toBeNull();
  });
  it("retries only server session creation after the email link was consumed", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ code: "AUTH_UNAVAILABLE" }, { status: 503 })); vi.stubGlobal("fetch", fetch);
    savePendingEmail({ email: "student@syuin.ac.kr", remember: false, next: "/campus/roommates/me" });
    show();
    fireEvent.click(await screen.findByRole("button", { name: "접속 상태 다시 만들기" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(mocks.signIn).toHaveBeenCalledTimes(1); expect(mocks.clearAuth).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
    for (const call of fetch.mock.calls) expect(JSON.parse(call[1].body)).toEqual({ idToken: "temporary-id-token", remember: false });
  });
  it("asks for the receiving email in another browser without putting it in the URL", async () => {
    show(); expect(await screen.findByLabelText("학교 이메일")).toHaveValue("");
    expect(mocks.signIn).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("학교 이메일"), { target: { value: "student@syuin.ac.kr" } });
    expect(window.location.href).not.toContain("student");
    screen.getByRole("link", { name: "취소" }).addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(screen.getByRole("link", { name: "취소" })); expect(mocks.clearAuth).toHaveBeenCalled();
  });
  it("does not issue a server session if the user cancels while Firebase is completing", async () => {
    let resolve!: () => void; mocks.signIn.mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; }));
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    savePendingEmail({ email: "student@syuin.ac.kr", remember: true, next: "/campus/roommates" });
    show(); await waitFor(() => expect(mocks.signIn).toHaveBeenCalled());
    const cancel = screen.getByRole("link", { name: "취소" }); cancel.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(cancel); resolve();
    await waitFor(() => expect(mocks.clearAuth).toHaveBeenCalledTimes(2));
    expect(fetch).not.toHaveBeenCalled();
  });
  it("clears temporary auth when leaving an idle session retry screen", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ code: "AUTH_UNAVAILABLE" }, { status: 503 })));
    savePendingEmail({ email: "student@syuin.ac.kr", remember: true, next: "/campus/roommates" });
    const view = show(); await screen.findByRole("button", { name: "접속 상태 다시 만들기" });
    expect(mocks.clearAuth).not.toHaveBeenCalled(); view.unmount();
    await waitFor(() => expect(mocks.clearAuth).toHaveBeenCalled());
    expect(localStorage.getItem("syu-roommates-pending-email")).toBeNull();
  });
  it("revokes an issued session if the user cancels during query cleanup", async () => {
    let resolve!: () => void; const client = new QueryClient();
    const cleanup = vi.spyOn(client, "cancelQueries").mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; }));
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ expiresAt: new Date(Date.now() + 3600000).toISOString() })).mockResolvedValueOnce(Response.json({ success: true }));
    vi.stubGlobal("fetch", fetch); const channel = vi.fn(); vi.stubGlobal("BroadcastChannel", channel);
    savePendingEmail({ email: "student@syuin.ac.kr", remember: true, next: "/campus/roommates" });
    render(<QueryClientProvider client={client}><RoommateFinish /></QueryClientProvider>);
    await waitFor(() => expect(cleanup).toHaveBeenCalled());
    const cancel = screen.getByRole("link", { name: "취소" }); cancel.addEventListener("click", (event) => event.preventDefault()); fireEvent.click(cancel);
    resolve(); await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch.mock.calls[1][0]).toBe("/api/roommates/auth/logout"); expect(channel).not.toHaveBeenCalled();
  });
  it("expires a consumed-link session retry after five minutes and clears temporary credentials", async () => {
    vi.useFakeTimers(); vi.setSystemTime("2026-10-04T06:00:00Z");
    try {
      const fetch = vi.fn().mockResolvedValue(Response.json({ code: "AUTH_UNAVAILABLE" }, { status: 503 })); vi.stubGlobal("fetch", fetch);
      savePendingEmail({ email: "student@syuin.ac.kr", remember: true, next: "/campus/roommates" });
      await act(async () => { show(); });
      expect(screen.getByRole("button", { name: "접속 상태 다시 만들기" })).toBeVisible();
      await act(async () => { await vi.advanceTimersByTimeAsync(299999); });
      expect(screen.getByRole("button", { name: "접속 상태 다시 만들기" })).toBeVisible(); expect(mocks.clearAuth).not.toHaveBeenCalled();
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(screen.queryByRole("button", { name: "접속 상태 다시 만들기" })).not.toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("접속 상태 발급 시간이 지났습니다");
      expect(screen.getByRole("link", { name: "새 인증 메일 받기" })).toBeVisible();
      expect(mocks.clearAuth).toHaveBeenCalledTimes(1); expect(localStorage.getItem("syu-roommates-pending-email")).toBeNull();
      expect(mocks.signIn).toHaveBeenCalledTimes(1); expect(fetch).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });
});
