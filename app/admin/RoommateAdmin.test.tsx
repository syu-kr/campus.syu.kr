import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const privateReport = { id: "private-report", postId: "private-post", reason: "spam", description: "비공개 신고 내용", evidence: { postId: "private-post", nickname: "비공개 작성자", description: "비공개 근거", openChatUrl: "https://open.kakao.com/o/fixture", dorm: "eden", roomSize: 3, version: 1 }, status: "pending", version: 1, memo: "", createdAt: "2026-10-01T00:00:00Z", expiresAt: "2026-10-31T00:00:00Z" };
const emptyPosts = { items: [], holds: [], nextCursor: null, holdsNextCursor: null, recruitingCount: 0, mailRequests: { dateUtc: "2026-10-04", count: 0, partial: false } };

it.each(["refresh", "mutation"])("clears private roommate data when permission is revoked during %s", async mode => {
  let denied = false;
  const onAccessLost = vi.fn();
  const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
    if (denied && (mode === "refresh" || init?.method === "PATCH")) return Response.json({ error: "forbidden" }, { status: mode === "refresh" ? 401 : 403 });
    return Response.json(input.startsWith("/api/admin/roommate-reports") ? { items: [privateReport], pendingCount: 1, nextCursor: null } : emptyPosts);
  });
  vi.stubGlobal("fetch", fetcher);
  render(<RoommateAdmin user={{ uid: "operator", getIdToken: async () => "fixture-token" } as User} onAccessLost={onAccessLost} />);
  fireEvent.click(await screen.findByRole("button", { name: /비공개 작성자/ }));expect(screen.getByText("비공개 근거")).toBeVisible();
  denied = true;
  fireEvent.click(screen.getByRole("button", { name: mode === "refresh" ? "룸메이트 새로고침" : "신고 처리 저장" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("다시 로그인해 주세요");
  expect(onAccessLost).toHaveBeenCalledOnce();expect(screen.queryByText("비공개 근거")).not.toBeInTheDocument();expect(screen.queryByText("비공개 신고 내용")).not.toBeInTheDocument();expect(screen.queryByRole("heading", { name: "룸메이트 관리" })).not.toBeInTheDocument();
});

it("ignores a forbidden response from an account that has already been replaced", async () => {
  let finish!: (response: Response) => void;
  const oldResponse = new Promise<Response>(resolve => { finish = resolve; });
  const fetcher = vi.fn().mockImplementationOnce(() => oldResponse).mockImplementation(async (input: string) => Response.json(input.startsWith("/api/admin/roommate-reports") ? { items: [], pendingCount: 0, nextCursor: null } : emptyPosts));
  vi.stubGlobal("fetch", fetcher);const denied = vi.fn();
  const old = { uid: "old", getIdToken: async () => "old-token" } as User, current = { uid: "current", getIdToken: async () => "current-token" } as User;
  const { rerender } = render(<RoommateAdmin user={old} onAccessLost={denied} />);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  rerender(<RoommateAdmin user={current} onAccessLost={denied} />);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(4));
  await act(async () => finish(Response.json({ error: "forbidden" }, { status: 403 })));
  expect(denied).not.toHaveBeenCalled();expect(screen.getByRole("heading", { name: "룸메이트 관리" })).toBeVisible();expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
