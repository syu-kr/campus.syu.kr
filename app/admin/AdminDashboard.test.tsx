import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import { afterEach, expect, it, vi } from "vitest";
import { AdminDashboard } from "./AdminDashboard";
import type { ManagedContentRecord } from "@/types/managed-content";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const user = (id: string) => ({ uid: id, getIdToken: vi.fn(async () => id) }) as unknown as User;
const counts = { pending: 4, reviewing: 0, accepted: 0, rejected: 0, done: 0 };

it("starts with genuine overview values and keeps management modules separate", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ items: [], mediaAvailable: false })));
  render(<AdminDashboard user={user("operator")} counts={counts} roommates={<p>룸메이트 관리</p>}><p>기존 문의 목록</p></AdminDashboard>);
  await waitFor(() => expect(screen.queryByText("관리 콘텐츠를 확인하는 중입니다.")).not.toBeInTheDocument());
  expect(screen.getByRole("heading", { name: "운영 현황" })).toBeVisible();
  expect(screen.getByText("기존 문의 목록")).not.toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "서비스 공지" }));
  expect(screen.getByRole("heading", { name: "공지 관리" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "문의·제보" }));
  expect(screen.getByText("기존 문의 목록")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "룸메이트" }));
  expect(screen.getByText("룸메이트 관리")).toBeVisible();
});

it("does not render management forms or false zero totals when the server denies access", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "관리자 권한이 없습니다" }, { status: 403 })));
  render(<AdminDashboard user={user("denied")} counts={counts} countsReady={false} roommates={null}>{null}</AdminDashboard>);
  expect(await screen.findByRole("alert")).toHaveTextContent("다시 로그인해 주세요");
  expect(screen.queryByRole("button", { name: "새 공지" })).not.toBeInTheDocument();
  expect(screen.queryByText("운영 현황")).not.toBeInTheDocument();
});

it("clears private drafts and hidden modules when the same account loses permission on refresh", async () => {
  const account = user("same-operator"), denied = vi.fn();
  const privateItem = { id: "private-draft", draft: { kind: "notice", title: "비공개 초안", slug: "private-draft", summary: "", content: "비공개 내용", startsAt: null, endsAt: null }, published: null, archived: false, revision: 1, source: "database", updatedAt: "2026-10-01T00:00:00Z", publishedAt: null };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ items: [privateItem], mediaAvailable: true })).mockResolvedValueOnce(Response.json({ error: "denied" }, { status: 403 })));
  const { rerender } = render(<AdminDashboard user={account} counts={counts} roommates={<p>비공개 룸메이트</p>} onAccessLost={denied}><p>비공개 문의</p></AdminDashboard>);
  fireEvent.click(screen.getByRole("button", { name: "서비스 공지" }));
  expect(await screen.findByText("비공개 초안")).toBeVisible();
  rerender(<AdminDashboard user={account} counts={counts} roommates={<p>비공개 룸메이트</p>} onAccessLost={denied} refreshKey={1}><p>비공개 문의</p></AdminDashboard>);
  expect(await screen.findByRole("alert")).toHaveTextContent("다시 로그인");
  expect(denied).toHaveBeenCalledOnce();
  expect(screen.queryByText("비공개 초안")).not.toBeInTheDocument();
  expect(screen.queryByText("비공개 문의")).not.toBeInTheDocument();
});

it("clears loaded drafts and ignores an older account response on account switch", async () => {
  let resolve!: (response: Response) => void;
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; })).mockResolvedValue(Response.json({ items: [], mediaAvailable: false }));
  vi.stubGlobal("fetch", fetcher);
  const { rerender } = render(<AdminDashboard user={user("old")} counts={counts} roommates={null}>{null}</AdminDashboard>);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  rerender(<AdminDashboard user={user("new")} counts={counts} roommates={null}>{null}</AdminDashboard>);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  const oldItem = { id: "old-draft", draft: { kind: "notice", title: "이전 계정 비공개 초안" } } as ManagedContentRecord;
  await act(async () => resolve(Response.json({ items: [oldItem], mediaAvailable: true })));
  expect(screen.queryByText("이전 계정 비공개 초안")).not.toBeInTheDocument();
});

it("recovers from a token request that never settles and allows a fresh retry", async () => {
  vi.useFakeTimers();
  const account = { uid: "stalled", getIdToken: vi.fn().mockImplementationOnce(() => new Promise(() => {})).mockResolvedValue("new-token") } as unknown as User;
  const fetcher = vi.fn(async () => Response.json({ items: [], mediaAvailable: false }));vi.stubGlobal("fetch", fetcher);
  const { unmount } = render(<AdminDashboard user={account} counts={counts} roommates={null}>{null}</AdminDashboard>);
  await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
  expect(screen.getByRole("alert")).toHaveTextContent("다시 시도해 주세요");
  expect(screen.queryByText("관리 콘텐츠를 확인하는 중입니다.")).not.toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
  vi.useRealTimers();fireEvent.click(screen.getByRole("button", { name: "관리 콘텐츠 다시 불러오기" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  unmount();
});

it("clears the pending token timeout when the dashboard unmounts", () => {
  vi.useFakeTimers();
  const account = { uid: "stalled", getIdToken: () => new Promise(() => {}) } as unknown as User;
  const { unmount } = render(<AdminDashboard user={account} counts={counts} roommates={null}>{null}</AdminDashboard>);
  unmount();expect(vi.getTimerCount()).toBe(0);
});
