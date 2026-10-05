import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import RoommateSession from "./RoommateSession";
import { ROOMMATE_CHANNEL, ROOMMATE_CLEAR_EVENT, ROOMMATE_REFRESH_INTERVAL_MS } from "./client";

vi.mock("@/lib/firebaseRoommates", () => ({ clearRoommateAuth: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/campus/roommates" }));

function restoreCachedPage() {
  const event = new Event("pageshow");
  Object.defineProperty(event, "persisted", { value: true });
  fireEvent(window, event);
}

describe("roommate private page boundary", () => {
  it("does not reopen private contents on focus while logout is pending or after logout fails", async () => {
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    let resolveLogout!: (response: Response) => void;
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ expiresAt, sessionTag: "same" }))
      .mockImplementationOnce(() => new Promise<Response>((done) => { resolveLogout = done; }))
      .mockImplementation(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetch);
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><RoommateSession><p>logout-private-listing</p></RoommateSession></QueryClientProvider>);
    expect(await screen.findByText("logout-private-listing")).toBeVisible();
    client.setQueryData(["roommates", "private"], { contact: "old-contact" });
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    fireEvent.focus(window); fireEvent(window, new Event("pageshow")); fireEvent(document, new Event("visibilitychange"));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("logout-private-listing")).not.toBeInTheDocument();
    expect(client.getQueryData(["roommates", "private"])).toBeUndefined();
    await act(async () => resolveLogout(Response.json({ code: "AUTH_UNAVAILABLE" }, { status: 503 })));
    expect(await screen.findByRole("alert")).toHaveTextContent("요청을 처리하지 못했습니다");
    fireEvent.focus(window); fireEvent(window, new Event("pageshow"));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("logout-private-listing")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[2][0]).toBe("/api/roommates/auth/logout");
  });
  it("disables private navigation during logout and after a failed logout while keeping the campus exit and retry", async () => {
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    let resolve!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ expiresAt, sessionTag: "same" }))
      .mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; })));
    render(<QueryClientProvider client={new QueryClient()}><RoommateSession><p>navigation-private-listing</p></RoommateSession></QueryClientProvider>);
    expect(await screen.findByText("navigation-private-listing")).toBeVisible();
    expect(screen.getByRole("link", { name: "모집 목록" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    for (const name of ["모집 목록", "내 글 관리", "모집글 작성"]) expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "캠퍼스" })).toHaveAttribute("href", "/campus");
    await act(async () => resolve(Response.json({ code: "AUTH_UNAVAILABLE" }, { status: 503 })));
    expect(await screen.findByRole("alert")).toHaveTextContent("요청을 처리하지 못했습니다");
    for (const name of ["모집 목록", "내 글 관리", "모집글 작성"]) expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "캠퍼스" })).toBeVisible(); expect(screen.getByRole("button", { name: "로그아웃" })).toBeEnabled();
  });
  it("waits for fresh authentication without an initial expiry and coalesces pending focus events", async () => {
    const now = Date.now(); const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    const expiresAt = new Date(now + 3600000).toISOString();
    const timeout = vi.spyOn(window, "setTimeout");
    let resolve!: (response: Response) => void;
    const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; }))
      .mockResolvedValue(Response.json({ expiresAt, sessionTag: "same" }));
    vi.stubGlobal("fetch", fetch);
    const mounted = vi.fn();
    function PrivateContent() { mounted(); return <p>fresh-private-listing</p>; }
    render(<QueryClientProvider client={new QueryClient()}><RoommateSession><PrivateContent /></RoommateSession></QueryClientProvider>);
    fireEvent.focus(window); fireEvent(window, new Event("pageshow")); fireEvent(document, new Event("visibilitychange"));
    expect(fetch).toHaveBeenCalledTimes(1); expect(mounted).not.toHaveBeenCalled();
    expect(screen.queryByText("fresh-private-listing")).not.toBeInTheDocument();
    expect(timeout).not.toHaveBeenCalledWith(expect.any(Function), 3600000);
    await act(async () => resolve(Response.json({ expiresAt, sessionTag: "same" })));
    expect(screen.getByText("fresh-private-listing")).toBeVisible();
    expect(timeout).toHaveBeenCalledWith(expect.any(Function), 3600000);
    fireEvent.focus(window); fireEvent(document, new Event("visibilitychange")); fireEvent(window, new Event("pageshow"));
    expect(fetch).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(now + ROOMMATE_REFRESH_INTERVAL_MS);
    fireEvent.focus(window);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText("fresh-private-listing")).toBeVisible());
  });
  it("does not reuse a check invalidated by pagehide or reveal its older response on a cached-page restore", async () => {
    const now = Date.now(); const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    const expiresAt = new Date(now + 3600000).toISOString();
    const resolves: ((response: Response) => void)[] = [];
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ expiresAt, sessionTag: "current" }))
      .mockImplementation(() => new Promise<Response>((done) => { resolves.push(done); }));
    vi.stubGlobal("fetch", fetch);
    render(<QueryClientProvider client={new QueryClient()}><RoommateSession><p>current-private-listing</p><input aria-label="restore-draft" defaultValue="" /></RoommateSession></QueryClientProvider>);
    const input = await screen.findByLabelText("restore-draft"); fireEvent.change(input, { target: { value: "current draft" } });
    clock.mockReturnValue(now + ROOMMATE_REFRESH_INTERVAL_MS); fireEvent.focus(window);
    expect(fetch).toHaveBeenCalledTimes(2); expect(input).toBeVisible();
    fireEvent(window, new Event("pagehide")); restoreCachedPage();
    fireEvent.focus(window); fireEvent(window, new Event("pageshow"));
    expect(fetch).toHaveBeenCalledTimes(3); expect(input).not.toBeVisible();
    await act(async () => resolves[0](Response.json({ expiresAt, sessionTag: "old" })));
    expect(input).not.toBeVisible(); expect(input).toHaveValue("current draft");
    fireEvent.focus(window); expect(fetch).toHaveBeenCalledTimes(3);
    await act(async () => resolves[1](Response.json({ expiresAt, sessionTag: "current" })));
    expect(screen.getByText("current-private-listing")).toBeVisible(); expect(screen.getByLabelText("restore-draft")).toBe(input);
    expect(input).toHaveValue("current draft");
  });
  it("ignores an authentication response after the session is cleared", async () => {
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    let resolve!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise<Response>((done) => { resolve = done; })));
    const client = new QueryClient(); client.setQueryData(["roommates", "private"], { link: "old-contact" });
    render(<QueryClientProvider client={client}><RoommateSession><p>cleared-private-listing</p></RoommateSession></QueryClientProvider>);
    act(() => window.dispatchEvent(new CustomEvent(ROOMMATE_CLEAR_EVENT, { detail: { disabled: true } })));
    await act(async () => resolve(Response.json({ expiresAt, sessionTag: "old-session" })));
    expect(screen.queryByText("cleared-private-listing")).not.toBeInTheDocument();
    expect(client.getQueryData(["roommates", "private"])).toBeUndefined();
    expect(screen.getByRole("status")).toHaveTextContent("지금은 룸메이트 게시판을 이용할 수 없습니다");
  });
  it("never mounts private content when the initial session check is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ code: "AUTH_UNAVAILABLE" }, { status: 503 })));
    const mounted = vi.fn();
    function PrivateContent() { mounted(); return <p>unverified-private-listing</p>; }
    render(<QueryClientProvider client={new QueryClient()}><RoommateSession><PrivateContent /></RoommateSession></QueryClientProvider>);
    expect(await screen.findByRole("alert")).toHaveTextContent("요청을 처리하지 못했습니다");
    expect(mounted).not.toHaveBeenCalled(); expect(screen.queryByText("unverified-private-listing")).not.toBeInTheDocument();
  });
  it("never mounts private content if the initial session expires before its response arrives", async () => {
    const now = Date.now(); const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    const expiresAt = new Date(now + 1000).toISOString();
    let resolve!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; })));
    const mounted = vi.fn();
    function PrivateContent() { mounted(); return <p>late-expired-private-listing</p>; }
    const client = new QueryClient(); client.setQueryData(["roommates", "private"], { contact: "expired contact" });
    render(<QueryClientProvider client={client}><RoommateSession><PrivateContent /></RoommateSession></QueryClientProvider>);
    clock.mockReturnValue(now + 1000);
    await act(async () => resolve(Response.json({ expiresAt, sessionTag: "expired" })));
    expect(mounted).not.toHaveBeenCalled(); expect(screen.queryByText("late-expired-private-listing")).not.toBeInTheDocument();
    expect(client.getQueryData(["roommates", "private"])).toBeUndefined();
  });
  it("removes cached listings and local form contents when the feature is disabled", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ expiresAt: new Date(Date.now() + 3600000).toISOString() })));
    const client = new QueryClient(); client.setQueryData(["roommates", "private"], { link: "private-contact" });
    render(<QueryClientProvider client={client}><RoommateSession expiresAt={new Date(Date.now() + 3600000).toISOString()}><p>private-contact</p><input aria-label="private-form" defaultValue="private-introduction" /></RoommateSession></QueryClientProvider>);
    expect(await screen.findByText("private-contact")).toBeInTheDocument();
    act(() => window.dispatchEvent(new CustomEvent(ROOMMATE_CLEAR_EVENT, { detail: { disabled: true } })));
    expect(screen.queryByText("private-contact")).not.toBeInTheDocument(); expect(screen.queryByLabelText("private-form")).not.toBeInTheDocument();
    expect(client.getQueryData(["roommates", "private"])).toBeUndefined();
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeVisible();
  });
  it("clears a form draft and cached private data when a different session appears on focus", async () => {
    const now = Date.now(); const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    const expiresAt = new Date(now + 3600000).toISOString();
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ expiresAt, sessionTag: "first" })).mockResolvedValueOnce(Response.json({ expiresAt, sessionTag: "second" }));
    vi.stubGlobal("fetch", fetch);
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><RoommateSession expiresAt={expiresAt} sessionTag="first"><input aria-label="draft" defaultValue="" /></RoommateSession></QueryClientProvider>);
    fireEvent.change(await screen.findByLabelText("draft"), { target: { value: "old user's introduction" } });
    client.setQueryData(["roommates", "private"], { link: "old contact" });
    clock.mockReturnValue(now + ROOMMATE_REFRESH_INTERVAL_MS);
    fireEvent.focus(window);
    await waitFor(() => expect(screen.getByLabelText("draft")).toHaveValue(""));
    expect(client.getQueryData(["roommates", "private"])).toBeUndefined();
  });
  it("preserves the screen and draft across rapid tab switches without requesting another check", async () => {
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    const fetch = vi.fn().mockResolvedValue(Response.json({ expiresAt, sessionTag: "same" }));
    vi.stubGlobal("fetch", fetch);
    const visibility = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    render(<QueryClientProvider client={new QueryClient()}><RoommateSession expiresAt={expiresAt} sessionTag="same"><input aria-label="private-draft" defaultValue="" /><p>private-contact</p></RoommateSession></QueryClientProvider>);
    const input = await screen.findByLabelText("private-draft"); fireEvent.change(input, { target: { value: "draft to keep" } });
    for (let index = 0; index < 3; index += 1) {
      visibility.mockReturnValue(true); fireEvent(document, new Event("visibilitychange"));
      expect(input).toBeVisible();
      visibility.mockReturnValue(false); fireEvent(document, new Event("visibilitychange"));
      fireEvent.focus(window); fireEvent(window, new Event("pageshow"));
    }
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("private-draft")).toBe(input); expect(input).toHaveValue("draft to keep");
    expect(screen.getByText("private-contact")).toBeVisible(); expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("coalesces a stale background check without hiding or resetting a valid same-session draft", async () => {
    const now = Date.now(); const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    const expiresAt = new Date(now + 3600000).toISOString();
    let resolve!: (response: Response) => void;
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ expiresAt, sessionTag: "same" })).mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; }));
    vi.stubGlobal("fetch", fetch);
    render(<QueryClientProvider client={new QueryClient()}><RoommateSession expiresAt={expiresAt} sessionTag="same"><input aria-label="private-draft" defaultValue="" /><p>private-contact</p></RoommateSession></QueryClientProvider>);
    const input = await screen.findByLabelText("private-draft"); fireEvent.change(input, { target: { value: "draft to keep" } });
    clock.mockReturnValue(now + ROOMMATE_REFRESH_INTERVAL_MS);
    fireEvent.focus(window); fireEvent(document, new Event("visibilitychange")); fireEvent(window, new Event("pageshow"));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(input).toBeVisible(); expect(screen.getByText("private-contact")).toBeVisible(); expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await act(async () => resolve(Response.json({ expiresAt, sessionTag: "same" })));
    expect(input).toBeVisible(); expect(input).toHaveValue("draft to keep");
    expect(screen.getByLabelText("private-draft")).toBe(input);
  });
  it("preserves the screen and draft when a background check is unavailable and lets retry bypass the cooldown", async () => {
    const now = Date.now(); const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    const expiresAt = new Date(now + 3600000).toISOString();
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ expiresAt, sessionTag: "same" }))
      .mockResolvedValueOnce(Response.json({ code: "AUTH_UNAVAILABLE" }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ expiresAt, sessionTag: "same" }));
    vi.stubGlobal("fetch", fetch); const client = new QueryClient();
    render(<QueryClientProvider client={client}><RoommateSession expiresAt={expiresAt} sessionTag="same"><input aria-label="outage-draft" defaultValue="" /><p>private-contact</p></RoommateSession></QueryClientProvider>);
    const input = await screen.findByLabelText("outage-draft"); fireEvent.change(input, { target: { value: "draft to preserve" } });
    client.setQueryData(["roommates", "private"], { contact: "private-contact" });
    clock.mockReturnValue(now + ROOMMATE_REFRESH_INTERVAL_MS); fireEvent.focus(window); expect(input).toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent("요청을 처리하지 못했습니다");
    expect(input).toBeVisible(); expect(screen.getByText("private-contact")).toBeVisible();
    fireEvent.focus(window); fireEvent(document, new Event("visibilitychange")); expect(fetch).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(input).toBeVisible());
    expect(screen.getByLabelText("outage-draft")).toBe(input); expect(input).toHaveValue("draft to preserve");
    expect(client.getQueryData(["roommates", "private"])).toEqual({ contact: "private-contact" }); expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("keeps a cached-page draft hidden until fresh verification succeeds, including an outage and retry", async () => {
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ expiresAt, sessionTag: "same" }))
      .mockResolvedValueOnce(Response.json({ code: "AUTH_UNAVAILABLE" }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ expiresAt, sessionTag: "same" }));
    vi.stubGlobal("fetch", fetch);
    render(<QueryClientProvider client={new QueryClient()}><RoommateSession><input aria-label="cached-draft" defaultValue="" /></RoommateSession></QueryClientProvider>);
    const input = await screen.findByLabelText("cached-draft"); fireEvent.change(input, { target: { value: "draft to preserve" } });
    fireEvent(window, new Event("pagehide")); expect(input).not.toBeVisible();
    restoreCachedPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("요청을 처리하지 못했습니다"); expect(input).not.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(input).toBeVisible());
    expect(screen.getByLabelText("cached-draft")).toBe(input); expect(input).toHaveValue("draft to preserve"); expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("clears an expired session on focus before the cooldown or a delayed background expiry timer", async () => {
    const now = Date.now(); const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    const expiresAt = new Date(now + 60000).toISOString();
    const fetch = vi.fn().mockResolvedValue(Response.json({ expiresAt, sessionTag: "same" })); vi.stubGlobal("fetch", fetch);
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><RoommateSession><p>expired-private-listing</p><input aria-label="expired-draft" /></RoommateSession></QueryClientProvider>);
    expect(await screen.findByText("expired-private-listing")).toBeVisible(); client.setQueryData(["roommates", "private"], { contact: "expired contact" });
    clock.mockReturnValue(now + 60000); fireEvent.focus(window);
    expect(fetch).toHaveBeenCalledTimes(1); expect(screen.queryByText("expired-private-listing")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("expired-draft")).not.toBeInTheDocument(); expect(client.getQueryData(["roommates", "private"])).toBeUndefined();
  });
  it("clears the screen, draft and cache immediately when a background check returns unauthorized", async () => {
    const now = Date.now(); const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    const expiresAt = new Date(now + 3600000).toISOString();
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ expiresAt, sessionTag: "same" }))
      .mockResolvedValueOnce(Response.json({ code: "UNAUTHORIZED" }, { status: 401 })); vi.stubGlobal("fetch", fetch);
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><RoommateSession><p>revoked-private-listing</p><input aria-label="revoked-draft" defaultValue="old introduction" /></RoommateSession></QueryClientProvider>);
    expect(await screen.findByText("revoked-private-listing")).toBeVisible(); client.setQueryData(["roommates", "private"], { contact: "revoked contact" });
    clock.mockReturnValue(now + ROOMMATE_REFRESH_INTERVAL_MS); fireEvent.focus(window);
    await waitFor(() => expect(screen.queryByText("revoked-private-listing")).not.toBeInTheDocument());
    expect(screen.queryByLabelText("revoked-draft")).not.toBeInTheDocument(); expect(client.getQueryData(["roommates", "private"])).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("clears private contents and ignores a pending background response after a cross-tab logout", async () => {
    const now = Date.now(); const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    const expiresAt = new Date(now + 3600000).toISOString();
    const channel = { onmessage: null as (() => void) | null, close: vi.fn() };
    vi.stubGlobal("BroadcastChannel", vi.fn(function (name: string) {
      expect(name).toBe(ROOMMATE_CHANNEL); return channel;
    }));
    let resolve!: (response: Response) => void;
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ expiresAt, sessionTag: "same" }))
      .mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; })); vi.stubGlobal("fetch", fetch);
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><RoommateSession><p>cross-tab-private-listing</p></RoommateSession></QueryClientProvider>);
    expect(await screen.findByText("cross-tab-private-listing")).toBeVisible(); client.setQueryData(["roommates", "private"], { contact: "old contact" });
    clock.mockReturnValue(now + ROOMMATE_REFRESH_INTERVAL_MS); fireEvent.focus(window); expect(fetch).toHaveBeenCalledTimes(2);
    act(() => channel.onmessage?.());
    expect(screen.queryByText("cross-tab-private-listing")).not.toBeInTheDocument(); expect(client.getQueryData(["roommates", "private"])).toBeUndefined();
    await act(async () => resolve(Response.json({ expiresAt, sessionTag: "same" })));
    expect(screen.queryByText("cross-tab-private-listing")).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
