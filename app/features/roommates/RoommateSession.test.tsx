import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import RoommateSession from "./RoommateSession";
import { ROOMMATE_CLEAR_EVENT } from "./client";

vi.mock("@/lib/firebaseRoommates", () => ({ clearRoommateAuth: vi.fn() }));

describe("roommate private page boundary", () => {
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
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ expiresAt, sessionTag: "first" })).mockResolvedValueOnce(Response.json({ expiresAt, sessionTag: "second" }));
    vi.stubGlobal("fetch", fetch);
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><RoommateSession expiresAt={expiresAt} sessionTag="first"><input aria-label="draft" defaultValue="" /></RoommateSession></QueryClientProvider>);
    fireEvent.change(await screen.findByLabelText("draft"), { target: { value: "old user's introduction" } });
    client.setQueryData(["roommates", "private"], { link: "old contact" });
    fireEvent.focus(window);
    await waitFor(() => expect(screen.getByLabelText("draft")).toHaveValue(""));
    expect(client.getQueryData(["roommates", "private"])).toBeUndefined();
  });
  it("hides private contents while checking focus and preserves a valid same-session draft", async () => {
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    let resolve!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ expiresAt, sessionTag: "same" })).mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; })));
    render(<QueryClientProvider client={new QueryClient()}><RoommateSession expiresAt={expiresAt} sessionTag="same"><input aria-label="private-draft" defaultValue="" /><p>private-contact</p></RoommateSession></QueryClientProvider>);
    const input = await screen.findByLabelText("private-draft"); fireEvent.change(input, { target: { value: "draft to keep" } });
    fireEvent.focus(window);
    expect(input).not.toBeVisible(); expect(screen.getByText("private-contact")).not.toBeVisible();
    await act(async () => resolve(Response.json({ expiresAt, sessionTag: "same" })));
    expect(input).toBeVisible(); expect(input).toHaveValue("draft to keep");
    fireEvent(window, new Event("pagehide")); expect(input).not.toBeVisible();
  });
  it("keeps private contents hidden during an outage and restores the same-session draft on retry", async () => {
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ expiresAt, sessionTag: "same" }))
      .mockResolvedValueOnce(Response.json({ code: "AUTH_UNAVAILABLE" }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ expiresAt, sessionTag: "same" }));
    vi.stubGlobal("fetch", fetch); const client = new QueryClient();
    render(<QueryClientProvider client={client}><RoommateSession expiresAt={expiresAt} sessionTag="same"><input aria-label="outage-draft" defaultValue="" /><p>private-contact</p></RoommateSession></QueryClientProvider>);
    const input = await screen.findByLabelText("outage-draft"); fireEvent.change(input, { target: { value: "draft to preserve" } });
    client.setQueryData(["roommates", "private"], { contact: "private-contact" });
    fireEvent.focus(window); expect(input).not.toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent("요청을 처리하지 못했습니다");
    expect(input).not.toBeVisible(); expect(screen.getByText("private-contact")).not.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(input).toBeVisible());
    expect(screen.getByLabelText("outage-draft")).toBe(input); expect(input).toHaveValue("draft to preserve");
    expect(client.getQueryData(["roommates", "private"])).toEqual({ contact: "private-contact" }); expect(fetch).toHaveBeenCalledTimes(3);
  });
});
