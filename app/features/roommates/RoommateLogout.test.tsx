import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { RoommateError } from "@/lib/roommates";
import { POST as logoutRoute } from "@/app/api/roommates/auth/logout/route";
import RoommateLogout from "./RoommateLogout";
import ProtectedRoommatePage from "./ProtectedRoommatePage";

const server = vi.hoisted(() => ({ revoke: vi.fn() }));
vi.mock("@/lib/firebaseRoommates", () => ({ clearRoommateAuth: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/server/roommate-auth", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/server/roommate-auth")>(),
  getRoommatePageSession: async () => { throw new RoommateError(503, "FEATURE_DISABLED", "disabled"); },
  revokeRoommateSession: server.revoke,
}));

describe("roommate logout during feature suspension", () => {
  it("keeps a logout control on the failed server gate without rendering private content", async () => {
    const client = new QueryClient();
    render(<QueryClientProvider client={client}>{await ProtectedRoommatePage({ path: "/campus/roommates", children: <p>private listing</p> })}</QueryClientProvider>);
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("지금은 룸메이트 게시판을 이용할 수 없습니다");
    expect(screen.queryByText("private listing")).not.toBeInTheDocument();
  });
  it("calls the allowed logout API and clears local private data without needing an auth check", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ success: true })); vi.stubGlobal("fetch", fetch);
    const client = new QueryClient(); client.setQueryData(["roommates", "post"], { contact: "private-contact" });
    const done = vi.fn(); render(<QueryClientProvider client={client}><RoommateLogout onSignedOut={done} /></QueryClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith("/api/roommates/auth/logout", expect.objectContaining({ method: "POST", body: "{}" }));
    expect(fetch).toHaveBeenCalledTimes(1); expect(client.getQueryData(["roommates", "post"])).toBeUndefined();
  });
  it("does not claim logout or expire the cookie on a storage failure and allows retry", async () => {
    server.revoke.mockReset().mockRejectedValueOnce(new Error("private storage failure")).mockResolvedValueOnce(undefined);
    const request = () => new Request("https://campus.test/api/roommates/auth/logout", { method: "POST", headers: { origin: "https://campus.test" } });
    const failed = await logoutRoute(request());
    expect(failed.status).toBe(503); expect(failed.headers.get("set-cookie")).toBeNull();
    expect(await failed.clone().json()).toEqual({ error: expect.any(String), code: "SERVICE_UNAVAILABLE" });
    const success = await logoutRoute(request());
    expect(success.status).toBe(200); expect(success.headers.get("set-cookie")).toContain("Max-Age=0");
    const fetch = vi.fn().mockResolvedValueOnce(failed).mockResolvedValueOnce(success); vi.stubGlobal("fetch", fetch);
    const client = new QueryClient(); client.setQueryData(["roommates", "post"], { contact: "private-contact" });
    const done = vi.fn(); render(<QueryClientProvider client={client}><RoommateLogout onSignedOut={done} /></QueryClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("요청을 처리하지 못했습니다");
    expect(done).not.toHaveBeenCalled(); expect(client.getQueryData(["roommates", "post"])).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await waitFor(() => expect(done).toHaveBeenCalledTimes(1)); expect(fetch).toHaveBeenCalledTimes(2);
  });
});
