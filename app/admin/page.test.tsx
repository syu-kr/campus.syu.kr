import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { User } from "firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminSubmissionItem } from "@/types/submissions";
import AdminPage from "./page";

const authMock = vi.hoisted(() => ({
  auth: { currentUser: null as User | null },
  listener: null as ((user: User | null) => void) | null,
  unsubscribe: vi.fn(),
  roommateMounts: 0,
  loadError: false,
}));

vi.mock("@/lib/firebase", () => ({ get auth() {
  if (authMock.loadError) throw new Error("Firebase client config is incomplete");
  return authMock.auth;
} }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn(
    (_auth: unknown, listener: (user: User | null) => void) => {
      authMock.listener = listener;
      return authMock.unsubscribe;
    },
  ),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("./RoommateAdmin", () => ({ RoommateAdmin: () => {
  const [session] = useState(() => ++authMock.roommateMounts);
  return <span data-testid="roommate-session">{session}</span>;
} }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function fixtureUser(uid: string, getIdToken = vi.fn(async () => uid)): User {
  return { uid, email: `${uid}@fixture.test`, emailVerified: true, getIdToken } as unknown as User;
}

function fixtureItem(account: string): AdminSubmissionItem {
  return {
    id: "same-submission-id",
    kind: "inquiry",
    status: "pending",
    title: `${account} private inquiry`,
    message: `${account} private message`,
    contact: `${account}-contact@fixture.test`,
    type: "bug",
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: null,
    userAgent: "fixture-agent",
  };
}

function pageResponse(item: AdminSubmissionItem) {
  return Response.json({
    submissions: [item],
    counts: { pending: 1, reviewing: 0, accepted: 0, rejected: 0, done: 0 },
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, nextCursor: null },
  });
}

function tokenFrom(init?: RequestInit) {
  return new Headers(init?.headers).get("Authorization")?.replace(/^Bearer /, "") || "";
}

function mockRequests(handler: (token: string, init?: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!String(input).startsWith("/api/admin/submissions")) {
      throw new Error(`Unexpected fixture request: ${String(input)}`);
    }
    return handler(tokenFrom(init), init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function emitAuth(...users: (User | null)[]) {
  await waitFor(() => expect(authMock.listener).not.toBeNull());
  act(() => {
    for (const user of users) {
      authMock.auth.currentUser = user;
      authMock.listener!(user);
    }
  });
}

function expectNoItem(item: AdminSubmissionItem) {
  expect(screen.queryAllByText(item.title)).toHaveLength(0);
  expect(screen.queryByText(item.contact)).not.toBeInTheDocument();
  const template = screen.queryByRole("textbox", { name: "답변 템플릿 내용" }) as HTMLTextAreaElement | null;
  expect(template?.value || "").not.toContain(item.title);
}

beforeEach(() => {
  authMock.auth.currentUser = null;
  authMock.listener = null;
  authMock.unsubscribe.mockClear();
  authMock.roommateMounts = 0;
  authMock.loadError = false;
});
afterEach(() => vi.unstubAllGlobals());

describe("admin submission authentication boundary", () => {
  it("recovers from Firebase startup errors without exposing data or sending admin requests", async () => {
    authMock.loadError = true;
    const fetchMock = mockRequests(() => { throw new Error("Admin request before authentication"); });
    render(<AdminPage />);
    expect(await screen.findByRole("heading", { name: "관리자 세션 확인 실패" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("관리자 인증을 시작하지 못했습니다");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(authMock.listener).toBeNull();
    authMock.loadError = false;
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await emitAuth(null);
    expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("clears loaded contact, detail and selection when the next account is denied", async () => {
    const oldItem = fixtureItem("A");
    mockRequests((token) => token === "admin-a"
      ? pageResponse(oldItem)
      : Response.json({ error: "B access denied" }, { status: 403 }));
    render(<AdminPage />);
    await emitAuth(fixtureUser("admin-a"));
    expect(await screen.findByText(oldItem.contact)).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: `${oldItem.title} 선택` }));
    expect(screen.getByText("1개 항목 선택됨")).toBeVisible();

    await emitAuth(null);
    expect(screen.getByRole("button", { name: "로그인" })).toBeVisible();
    await emitAuth(fixtureUser("admin-b"));
    await screen.findByText("B access denied");

    expectNoItem(oldItem);
    expect(screen.queryByText("1개 항목 선택됨")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "현재 페이지 항목 전체 선택" })).toBeDisabled();
  });

  it("ignores an old account's list response after the new account has loaded", async () => {
    const oldItem = fixtureItem("A");
    const currentItem = fixtureItem("B");
    const oldResponse = deferred<Response>();
    const fetchMock = mockRequests((token) => token === "admin-a" ? oldResponse.promise : pageResponse(currentItem));
    render(<AdminPage />);
    await emitAuth(fixtureUser("admin-a"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await emitAuth(null, fixtureUser("admin-b"));
    expect(await screen.findByText(currentItem.contact)).toBeVisible();
    await act(async () => oldResponse.resolve(pageResponse(oldItem)));

    expect(screen.getByText(currentItem.contact)).toBeVisible();
    expectNoItem(oldItem);
  });

  it("does not dispatch a list request when the old account's token arrives after a switch", async () => {
    const oldToken = deferred<string>();
    const getOldToken = vi.fn(() => oldToken.promise);
    const currentItem = fixtureItem("B");
    const fetchMock = mockRequests(() => pageResponse(currentItem));
    render(<AdminPage />);
    await emitAuth(fixtureUser("admin-a", getOldToken));
    await waitFor(() => expect(getOldToken).toHaveBeenCalled());

    await emitAuth(null, fixtureUser("admin-b"));
    expect(await screen.findByText(currentItem.contact)).toBeVisible();
    await act(async () => oldToken.resolve("admin-a"));

    expect(fetchMock.mock.calls.filter(([, init]) => tokenFrom(init) === "admin-a")).toHaveLength(0);
    expect(screen.getByText(currentItem.contact)).toBeVisible();
  });

  it.each(["single", "bulk", "classify"] as const)(
    "isolates a delayed %s mutation from a new account with the same submission ID",
    async (operation) => {
      const oldItem = fixtureItem("A");
      const currentItem = fixtureItem("B");
      const mutationResponse = deferred<Response>();
      const method = operation === "classify" ? "POST" : "PATCH";
      const fetchMock = mockRequests((token, init) => {
        if (init?.method === method) return mutationResponse.promise;
        return pageResponse(token === "admin-a" ? oldItem : currentItem);
      });
      render(<AdminPage />);
      await emitAuth(fixtureUser("admin-a"));
      await screen.findByText(oldItem.contact);
      if (operation === "bulk") {
        fireEvent.click(screen.getByRole("checkbox", { name: `${oldItem.title} 선택` }));
        fireEvent.click(screen.getByRole("button", { name: "일괄 상태 변경" }));
      } else {
        fireEvent.click(screen.getByRole("button", { name: operation === "single" ? "검토중" : "분류" }));
      }
      await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === method)).toBe(true));

      await emitAuth(null, fixtureUser("admin-b"));
      expect(await screen.findByText(currentItem.contact)).toBeVisible();
      expect(screen.getByRole("button", { name: operation === "classify" ? "분류" : "대기" })).toBeEnabled();
      await act(async () => mutationResponse.resolve(Response.json(operation === "classify" ? {
        classification: {
          category: "bug", urgency: "high", confidence: "high",
          handlingHint: "A private handling hint", generatedAt: "2026-10-01T00:00:00Z", sourceHash: "fixture-hash",
        },
      } : { success: true })));

      expect(screen.getByText(currentItem.contact)).toBeVisible();
      expectNoItem(oldItem);
      expect(screen.getByRole("button", { name: "대기" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByText("A private handling hint")).not.toBeInTheDocument();
      expect(screen.queryByText("처리 상태를 변경했습니다.")).not.toBeInTheDocument();
      expect(screen.queryByText("1개 항목의 상태를 변경했습니다.")).not.toBeInTheDocument();
      expect(fetchMock.mock.calls.filter(([, init]) => !init?.method && tokenFrom(init) === "admin-a")).toHaveLength(1);
    },
  );

  it("does not reuse the previous session when the same UID signs in again before React renders", async () => {
    const oldItem = fixtureItem("A previous session");
    const currentItem = fixtureItem("A new session");
    const oldResponse = deferred<Response>();
    const sameUser = fixtureUser("admin-a");
    let loads = 0;
    const fetchMock = mockRequests(() => ++loads === 1 ? oldResponse.promise : pageResponse(currentItem));
    render(<AdminPage />);
    await emitAuth(sameUser);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const previousRoommateSession = screen.getByTestId("roommate-session").textContent;

    await emitAuth(null, sameUser);
    expect(await screen.findByText(currentItem.contact)).toBeVisible();
    expect(screen.getByTestId("roommate-session").textContent).not.toBe(previousRoommateSession);
    await act(async () => oldResponse.resolve(pageResponse(oldItem)));

    expect(screen.getByText(currentItem.contact)).toBeVisible();
    expectNoItem(oldItem);
  });
});
