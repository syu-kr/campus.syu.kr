import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RoommateList from "./RoommateList";
import { ROOMMATE_REFRESH_INTERVAL_MS } from "./client";

vi.mock("next/navigation", () => ({ usePathname: () => "/campus/roommates", useSearchParams: () => new URLSearchParams() }));

beforeEach(() => focusManager.setFocused(true));
afterEach(() => { focusManager.setFocused(undefined); vi.unstubAllGlobals(); });

async function returnToBoard() {
  await act(async () => { focusManager.setFocused(false); focusManager.setFocused(true); });
}

describe("roommate listing background refresh", () => {
  it("does not reload on rapid tab returns and refreshes stale data without replacing the screen or filter input", async () => {
    const now = Date.now(); const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    let resolve!: (response: Response) => void;
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ items: [], nextCursor: null }))
      .mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; })); vi.stubGlobal("fetch", fetch);
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><RoommateList /></QueryClientProvider>);
    expect(await screen.findByText("현재 조건에 맞는 모집글이 없습니다.")).toBeVisible();
    const dorm = screen.getByLabelText("기숙사"); fireEvent.change(dorm, { target: { value: "eden" } });
    for (let index = 0; index < 3; index += 1) await returnToBoard();
    expect(fetch).toHaveBeenCalledTimes(1); expect(dorm).toHaveValue("eden");
    clock.mockReturnValue(now + ROOMMATE_REFRESH_INTERVAL_MS); await returnToBoard();
    expect(fetch).toHaveBeenCalledTimes(2); expect(fetch.mock.calls[1][0]).toBe("/api/roommates/posts?");
    expect(screen.getByText("현재 조건에 맞는 모집글이 없습니다.")).toBeVisible();
    expect(screen.queryByLabelText("불러오는 중…")).not.toBeInTheDocument(); expect(screen.getByLabelText("기숙사")).toBe(dorm);
    await act(async () => resolve(Response.json({ items: [], nextCursor: null })));
    await waitFor(() => expect(client.isFetching()).toBe(0)); expect(dorm).toHaveValue("eden");
  });
  it("waits five minutes after a failed refresh before automatic retry and allows an immediate manual retry", async () => {
    const now = Date.now(); const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ items: [], nextCursor: null }))
      .mockResolvedValueOnce(Response.json({ code: "AUTH_UNAVAILABLE" }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ code: "AUTH_UNAVAILABLE" }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ items: [], nextCursor: null })); vi.stubGlobal("fetch", fetch);
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><RoommateList /></QueryClientProvider>);
    expect(await screen.findByText("현재 조건에 맞는 모집글이 없습니다.")).toBeVisible();
    clock.mockReturnValue(now + ROOMMATE_REFRESH_INTERVAL_MS); await returnToBoard();
    expect(await screen.findByRole("alert")).toHaveTextContent("지금은 룸메이트 게시판을 이용할 수 없습니다.");
    for (let index = 0; index < 3; index += 1) await returnToBoard();
    clock.mockReturnValue(now + 2 * ROOMMATE_REFRESH_INTERVAL_MS - 1); await returnToBoard();
    expect(fetch).toHaveBeenCalledTimes(2);
    clock.mockReturnValue(now + 2 * ROOMMATE_REFRESH_INTERVAL_MS); await returnToBoard();
    await waitFor(() => expect(client.getQueryState(["roommates", "list", "", ""])?.errorUpdatedAt).toBe(now + 2 * ROOMMATE_REFRESH_INTERVAL_MS));
    expect(fetch).toHaveBeenCalledTimes(3); await returnToBoard(); expect(fetch).toHaveBeenCalledTimes(3);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("현재 조건에 맞는 모집글이 없습니다.")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(); expect(fetch).toHaveBeenCalledTimes(4);
  });
});
