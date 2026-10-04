import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProtectedRoommatePage from "./ProtectedRoommatePage";

const request = vi.hoisted(() => ({ cookie: "", locale: "ko" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-syu-locale": request.locale }),
  cookies: async () => ({ get: () => request.cookie ? { value: request.cookie } : undefined }),
}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/firebaseRoommates", () => ({ clearRoommateAuth: vi.fn() }));
vi.mock("@/lib/server/roommate-auth", () => { throw new Error("The loading shell must not load the Firebase authentication module."); });

beforeEach(() => { vi.stubEnv("ROOMMATES_ENABLED", "true"); request.cookie = ""; request.locale = "ko"; });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("roommate server loading shell", () => {
  it("redirects a missing cookie before mounting private content", async () => {
    await expect(ProtectedRoommatePage({ path: "/campus/roommates/me", children: <p>private data</p> }))
      .rejects.toThrow("redirect:/campus/roommates/verify?next=%2Fcampus%2Froommates%2Fme");
  });
  it("does not treat a present invalid cookie as authentication or mount private children", async () => {
    request.cookie = "invalid-cookie";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ code: "AUTH_UNAVAILABLE" }, { status: 503 })));
    const mounted = vi.fn();
    function PrivateContent() { mounted(); return <p>private data</p>; }
    render(<QueryClientProvider client={new QueryClient()}>{await ProtectedRoommatePage({ path: "/campus/roommates", children: <PrivateContent /> })}</QueryClientProvider>);
    expect(mounted).not.toHaveBeenCalled(); expect(screen.queryByText("private data")).not.toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("요청을 처리하지 못했습니다");
    expect(mounted).not.toHaveBeenCalled();
  });
});
