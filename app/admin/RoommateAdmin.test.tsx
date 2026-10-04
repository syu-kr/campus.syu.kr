import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import { afterEach, expect, it, vi } from "vitest";
import { RoommateAdmin } from "./RoommateAdmin";

afterEach(() => vi.unstubAllGlobals());

it("reviews report evidence and saves a versioned report change without mutating the original post", async () => {
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    if (init?.method === "PATCH") return Response.json({ success: true });
    if (input.startsWith("/api/admin/roommate-reports")) return Response.json({
      items: [{ id: "report-fixture", postId: "post-fixture", reason: "spam", description: "스팸입니다", evidence: { postId: "post-fixture", nickname: "작성자", description: "신고 당시 소개", openChatUrl: "https://open.kakao.com/o/fixture", dorm: "eden", roomSize: 3, version: 1 }, status: "pending", version: 2, memo: "", createdAt: "2026-10-01T00:00:00Z", expiresAt: "2026-10-31T00:00:00Z" }],
      pendingCount: 1, nextCursor: null,
    });
    return Response.json({ items: [], holds: [], nextCursor: null, holdsNextCursor: null, recruitingCount: 0, mailRequests: { dateUtc: "2026-10-04", count: 2, partial: false } });
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<RoommateAdmin user={{ uid: "admin-fixture", getIdToken: async () => "token-fixture" } as User} />);
  fireEvent.click(await screen.findByRole("button", { name: /작성자 · 광고/ }));
  expect(screen.getByText("신고 당시 소개")).toBeVisible();
  expect(screen.getByRole("link", { name: "접수 당시 오픈채팅 링크" })).toHaveAttribute("href", "https://open.kakao.com/o/fixture");
  fireEvent.change(screen.getByLabelText("신고 처리 상태"), { target: { value: "reviewing" } });
  fireEvent.change(screen.getByLabelText("처리 메모 (선택, 최대 300자)"), { target: { value: "검토 시작" } });
  fireEvent.click(screen.getByRole("button", { name: "신고 처리 저장" }));
  await screen.findByText("조치와 감사 기록을 저장했습니다.");
  await waitFor(() => {
    const mutations = fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");
    expect(mutations).toHaveLength(1);
    expect(mutations[0][0]).toBe("/api/admin/roommate-reports");
    expect(JSON.parse(mutations[0][1]!.body as string)).toEqual({ id: "report-fixture", expectedVersion: 2, status: "reviewing", memo: "검토 시작" });
  });
});
