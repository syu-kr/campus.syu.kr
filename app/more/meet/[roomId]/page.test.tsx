import { Suspense } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MeetRoomResponse } from "@/types/meet";
import MeetRoomPage from "./page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

const slot = "2026-10-05T09:00:00+09:00";
const room: MeetRoomResponse = {
  room: {
    id: "test-room", title: "모임", description: "", dateStart: "2026-10-05",
    dateEnd: "2026-10-05", timeStart: "09:00", timeEnd: "10:00", slotMinutes: 60,
    participantCount: 0, responseClosesAt: null, acceptingResponses: true, expiresAt: null,
  },
  slots: [slot], participants: [],
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Meet response editing when browser storage fails", () => {
  it.each(["read", "write"])("keeps a successful response editable after a storage %s failure", async (failure) => {
    vi.spyOn(Storage.prototype, failure === "read" ? "getItem" : "setItem")
      .mockImplementation(() => { throw new DOMException("Storage unavailable"); });
    let saved = false;
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") {
        saved = true;
        return Response.json({ editToken: "session-edit-token" });
      }
      return Response.json(saved
        ? { ...room, participants: [{ nickname: "학생", availability: [slot], updatedAt: null }] }
        : room);
    });
    vi.stubGlobal("fetch", fetchMock);
    const params = Promise.resolve({ roomId: "test-room" });
    await act(async () => {
      render(<Suspense fallback={null}><MeetRoomPage params={params} /></Suspense>);
    });
    fireEvent.change(await screen.findByLabelText("닉네임"), { target: { value: "학생" } });
    const slotButton = document.querySelector<HTMLButtonElement>(`button[data-slot="${slot}"]`)!;
    fireEvent.click(slotButton, { detail: 0 });
    fireEvent.click(screen.getByRole("button", { name: "내 가능 시간 저장" }));
    await screen.findByText("가능한 시간이 저장되었습니다.");
    expect(screen.getByText(/현재 화면을 유지해주세요/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "다른 이름" } });
    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "학생" } });
    fireEvent.click(screen.getByRole("button", { name: "기존 응답 덮어쓰기" }));
    fireEvent.click(screen.getByRole("button", { name: /^덮어쓰기$/ }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(2));
    const writes = fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(writes[1][1]?.body)).editToken).toBe("session-edit-token");
  });
});
