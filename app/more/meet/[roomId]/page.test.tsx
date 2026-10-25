import { Suspense } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MeetRoomResponse } from "@/types/meet";
import { getMeetOwnerTokenKey } from "@/lib/meet";
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
  localStorage.clear();
});

it("requires site confirmation before deleting with the original owner token", async () => {
  localStorage.setItem(getMeetOwnerTokenKey("test-room"), "owner-test-token");
  const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => Response.json(init?.method === "DELETE" ? { success: true } : room));
  vi.stubGlobal("fetch", fetchMock);
  await act(async () => { render(<Suspense fallback={null}><MeetRoomPage params={Promise.resolve({ roomId: "test-room" })} /></Suspense>); });
  const trigger = await screen.findByRole("button", { name: "이 방 삭제" });
  fireEvent.click(trigger);
  let dialog = screen.getByRole("dialog", { name: "이 방 삭제" });
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE")).toHaveLength(0);
  fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(localStorage.getItem(getMeetOwnerTokenKey("test-room"))).toBe("owner-test-token");
  fireEvent.click(trigger);
  dialog = screen.getByRole("dialog", { name: "이 방 삭제" });
  fireEvent.click(within(dialog).getByRole("button", { name: "이 방 삭제" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/meet/rooms/test-room", {
    method: "DELETE", headers: { "x-owner-token": "owner-test-token" },
  }));
  await waitFor(() => expect(localStorage.getItem(getMeetOwnerTokenKey("test-room"))).toBeNull());
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

const secondSlot = "2026-10-05T10:00:00+09:00";
const thirdSlot = "2026-10-05T11:00:00+09:00";

async function renderSelectableRoom() {
  const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) =>
    Response.json(init?.method === "PUT"
      ? { editToken: "test-edit-token" }
      : { ...room, room: { ...room.room, timeEnd: "12:00" }, slots: [slot, secondSlot, thirdSlot] }),
  );
  vi.stubGlobal("fetch", fetchMock);
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <MeetRoomPage params={Promise.resolve({ roomId: "test-room" })} />
      </Suspense>,
    );
  });
  await screen.findByLabelText("닉네임");
  const slotButtons = (value: string) =>
    document.querySelectorAll<HTMLButtonElement>(`button[data-slot="${value}"]`);
  return { fetchMock, slotButtons };
}

function pointerEvent(type: string, pointerType: "touch" | "mouse") {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  return event;
}

describe("Meet availability selection", () => {
  it("allows touch panning without selecting and saves a subsequent tap once", async () => {
    const { fetchMock, slotButtons } = await renderSelectableRoom();
    const button = slotButtons(slot)[1];
    const nextButton = slotButtons(secondSlot)[1];
    const grid = button.parentElement!;
    expect(grid).toHaveClass("touch-pan-y");
    expect(grid).not.toHaveClass("touch-none");

    const down = pointerEvent("pointerdown", "touch");
    fireEvent(button, down);
    fireEvent(nextButton, pointerEvent("pointerover", "touch"));
    fireEvent(grid, pointerEvent("pointermove", "touch"));
    fireEvent(button, pointerEvent("pointercancel", "touch"));
    expect(down.defaultPrevented).toBe(false);
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(nextButton).toHaveAttribute("aria-pressed", "false");

    fireEvent(button, pointerEvent("pointerdown", "touch"));
    fireEvent(button, pointerEvent("pointerup", "touch"));
    fireEvent.click(button, { detail: 1 });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "터치 학생" } });
    fireEvent.click(screen.getByRole("button", { name: "내 가능 시간 저장" }));
    await screen.findByText("가능한 시간이 저장되었습니다.");
    const writes = fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");
    expect(writes).toHaveLength(1);
    expect(JSON.parse(String(writes[0][1]?.body))).toMatchObject({
      nickname: "터치 학생", availability: [slot],
    });
  });

  it("keeps mouse drag selection, ignores its click, and ends on release or cancel", async () => {
    const { slotButtons } = await renderSelectableRoom();
    const button = slotButtons(slot)[0];
    const nextButton = slotButtons(secondSlot)[0];
    const lastButton = slotButtons(thirdSlot)[0];

    fireEvent(button, pointerEvent("pointerdown", "mouse"));
    fireEvent(nextButton, pointerEvent("pointerover", "mouse"));
    fireEvent(window, pointerEvent("pointerup", "mouse"));
    fireEvent.click(button, { detail: 1 });
    fireEvent(lastButton, pointerEvent("pointerover", "mouse"));
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(nextButton).toHaveAttribute("aria-pressed", "true");
    expect(lastButton).toHaveAttribute("aria-pressed", "false");

    fireEvent(button, pointerEvent("pointerdown", "mouse"));
    fireEvent(window, pointerEvent("pointercancel", "mouse"));
    fireEvent(nextButton, pointerEvent("pointerover", "mouse"));
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(nextButton).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps keyboard click selection and deselection", async () => {
    const { slotButtons } = await renderSelectableRoom();
    const button = slotButtons(slot)[0];
    fireEvent.click(button, { detail: 0 });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button, { detail: 0 });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });
});
