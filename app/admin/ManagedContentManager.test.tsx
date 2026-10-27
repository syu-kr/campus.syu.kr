import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { User } from "firebase/auth";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ManagedContentRecord, ManagedNoticeDraft } from "@/types/managed-content";
import { fromSeoulInput, ManagedContentManager, publicationLabel, toSeoulInput } from "./ManagedContentManager";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const user = { uid: "operator", getIdToken: vi.fn(async () => "operator-token") } as unknown as User;
const draft: ManagedNoticeDraft = { kind: "notice", slug: "first-notice", title: "원본 공지", summary: "소개", content: "기존 본문", startsAt: null, endsAt: null };
const item: ManagedContentRecord = { id: "first-notice", draft, published: draft, publishedAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z", revision: 1, archived: false, source: "database" };
function view(onSaved = vi.fn(), account = user) { return <ManagedContentManager kind="notice" user={account} items={[item]} mediaAvailable onSaved={onSaved} onReload={vi.fn()} />; }
function open() { fireEvent.click(screen.getByRole("button", { name: /원본 공지/ })); }

describe("managed content editing", () => {
  it("saves only a draft and keeps publishing behind its concrete preview confirmation", async () => {
    const onSaved = vi.fn();
    const fetcher = vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      return Response.json({ item: { ...item, draft: body.draft, published: body.action === "publish" ? body.draft : draft, revision: body.action === "publish" ? 3 : 2 } });
    });
    vi.stubGlobal("fetch", fetcher); render(view(onSaved)); open();
    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "수정한 공지" } });
    fireEvent.click(screen.getByRole("button", { name: "초안 저장" }));
    expect(await screen.findByRole("status")).toHaveTextContent("현재 게시본은 유지");
    expect(onSaved.mock.calls[0][0].published.title).toBe("원본 공지");
    expect(JSON.parse(fetcher.mock.calls[0][1].body).action).toBe("save");
    fireEvent.click(screen.getByRole("button", { name: "게시 검토" }));
    const dialog = screen.getByRole("dialog", { name: "공지 게시 검토" });
    expect(within(dialog).getByRole("heading", { name: "수정한 공지" })).toBeVisible();
    expect(fetcher).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "게시하기" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ id: item.id, expectedRevision: 2, action: "publish" });
  });

  it.each(["conflict", "network", "malformed"])("retains the user's text after %s without reporting success", async failure => {
    const fetcher = vi.fn(async () => {
      if (failure === "network") throw new TypeError("private SDK failure");
      return failure === "conflict" ? Response.json({ error: "conflict" }, { status: 409 }) : new Response("<html>private backend</html>");
    });
    vi.stubGlobal("fetch", fetcher); const saved = vi.fn(); render(view(saved)); open();
    fireEvent.change(screen.getByLabelText("본문"), { target: { value: "저장 전 작성 내용" } });
    fireEvent.click(screen.getByRole("button", { name: "초안 저장" }));
    const alert = await screen.findByRole("alert");
    expect(alert).not.toHaveTextContent("private");
    expect(screen.getByLabelText("본문")).toHaveValue("저장 전 작성 내용");
    expect(saved).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("asks before discarding an unsaved draft, including reselecting the latest version", () => {
    render(view()); open();
    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "보존할 제목" } });
    open();
    const dialog = screen.getByRole("dialog", { name: "작성 중인 내용 변경" });
    fireEvent.click(within(dialog).getByRole("button", { name: "계속 작성" }));
    expect(screen.getByLabelText("제목")).toHaveValue("보존할 제목");
  });

  it("warns before closing an unsaved draft and opens preview links without leaving the editor", () => {
    render(view());open();
    const clean = new Event("beforeunload", { cancelable: true });window.dispatchEvent(clean);expect(clean.defaultPrevented).toBe(false);
    fireEvent.change(screen.getByLabelText("본문"), { target: { value: "[자료 확인](https://example.com/details)" } });
    const dirty = new Event("beforeunload", { cancelable: true });window.dispatchEvent(dirty);expect(dirty.defaultPrevented).toBe(true);
    expect(screen.getByRole("link", { name: "자료 확인" })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "자료 확인" })).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("clears the editor and private list on a forbidden mutation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "forbidden" }, { status: 403 })));
    const denied = vi.fn();
    render(<ManagedContentManager kind="notice" user={user} items={[item]} mediaAvailable onSaved={vi.fn()} onReload={vi.fn()} onAccessLost={denied} />);open();
    fireEvent.click(screen.getByRole("button", { name: "초안 저장" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("다시 로그인");
    expect(denied).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText("본문")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /원본 공지/ })).not.toBeInTheDocument();
  });

  it("rejects a new notice address that already belongs to an existing notice", async () => {
    const fetcher = vi.fn();vi.stubGlobal("fetch", fetcher);
    render(view());fireEvent.click(screen.getByRole("button", { name: "새 공지" }));
    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "새 공지 제목" } });
    fireEvent.change(screen.getByLabelText("공지 주소"), { target: { value: item.id } });
    fireEvent.click(screen.getByRole("button", { name: "초안 저장" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("이미 사용 중인 공지 주소");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("requires explicit bilingual review before publishing the English draft", async () => {
    const bilingual = { ...item, draft: { ...draft, english: { title: "Notice", summary: "", content: "English body" } } };
    const fetcher = vi.fn(async (_url, init) => Response.json({ item: { ...bilingual, revision: 2, published: JSON.parse(init.body).draft } }));
    vi.stubGlobal("fetch", fetcher);
    render(<ManagedContentManager kind="notice" user={user} items={[bilingual]} mediaAvailable onSaved={vi.fn()} onReload={vi.fn()} />);open();
    fireEvent.click(screen.getByRole("button", { name: "게시 검토" }));
    const dialog = screen.getByRole("dialog", { name: "공지 게시 검토" });
    const publish = within(dialog).getByRole("button", { name: "게시하기" });
    expect(publish).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "한국어 원문과 영문 내용을 함께 확인했습니다." }));
    fireEvent.click(publish);
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ action: "publish", englishReviewed: true });
  });

  it("uploads a selected banner image only on the upload action and keeps publication separate", async () => {
    const id = "d2d4132c-1683-4e6a-915c-574201a76566";
    const banner: ManagedContentRecord = { ...item, id, published: null, draft: { kind: "banner", category: "ad", placement: "home", title: "제휴 안내", description: "행사 소개", imageDesktop: "", imageMobile: "", imageAlt: "행사 내용", link: "https://example.com/event", priority: 1, dismissible: true, startsAt: null, endsAt: null } };
    const fetcher = vi.fn().mockResolvedValue(Response.json({ url: `/api/content-media/${id}`, width: 1200, height: 300 }));
    vi.stubGlobal("fetch", fetcher);
    render(<ManagedContentManager kind="banner" user={user} items={[banner]} mediaAvailable onSaved={vi.fn()} onReload={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /제휴 안내/ }));
    const file = new File(["fixture image"], "banner.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("데스크톱 이미지"), { target: { files: [file] } });
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "데스크톱 이미지 업로드" }));
    expect(await screen.findByText("이미지 준비됨")).toBeInTheDocument();
    expect(fetcher.mock.calls[0][0]).toBe("/api/admin/content/media");
    expect(fetcher.mock.calls[0][1].body.get("file")).toBe(file);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("offers popup placement, fixes dismissal on, and identifies the popup in publish review", async () => {
    const id = "d2d4132c-1683-4e6a-915c-574201a76566";
    const banner: ManagedContentRecord = { ...item, id, published: null, draft: { kind: "banner", category: "notice", placement: "site-top", title: "점검 안내", description: "점검 시간 안내", imageDesktop: "", imageMobile: "", imageAlt: "", link: "", priority: 1, dismissible: false, startsAt: null, endsAt: null } };
    const fetcher = vi.fn(async (_url, init) => Response.json({ item: { ...banner, revision: 2, draft: JSON.parse(init.body).draft, published: JSON.parse(init.body).draft } }));
    vi.stubGlobal("fetch", fetcher);
    render(<ManagedContentManager kind="banner" user={user} items={[banner]} mediaAvailable onSaved={vi.fn()} onReload={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /점검 안내/ }));
    expect(screen.getByRole("checkbox", { name: "닫기 허용" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("combobox", { name: "노출 위치" }));
    const popup = await screen.findByRole("option", { name: "팝업 공지" });fireEvent.pointerDown(popup);fireEvent.click(popup);
    expect(screen.getByRole("checkbox", { name: "닫기 허용" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "닫기 허용" })).toBeDisabled();
    expect(screen.getByText(/팝업은 항상 닫을 수 있으며/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "게시 검토" }));
    const dialog = screen.getByRole("dialog", { name: "배너 게시 검토" });
    expect(within(dialog).getByText("팝업 공지 · 방문 시 배경 위에 표시합니다.")).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: "게시하기" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ id, expectedRevision: 1, action: "publish", draft: { placement: "popup", dismissible: true } });
  });

  it("does not dispatch an old session's write after its token resolves", async () => {
    let finish!: (token: string) => void;
    const oldUser = { uid: "old", getIdToken: () => new Promise<string>(resolve => { finish = resolve; }) } as unknown as User;
    const fetcher = vi.fn();vi.stubGlobal("fetch", fetcher);
    const { rerender } = render(view(vi.fn(), oldUser));open();
    fireEvent.click(screen.getByRole("button", { name: "초안 저장" }));
    rerender(view(vi.fn(), user));
    await act(async () => finish("old-token"));
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("본문")).not.toBeInTheDocument();
  });

  it("unlocks a draft save when its token never settles, preserving input for a fresh retry", async () => {
    vi.useFakeTimers();
    const account = { uid: "stalled", getIdToken: vi.fn().mockImplementationOnce(() => new Promise(() => {})).mockResolvedValue("new-token") } as unknown as User;
    const fetcher = vi.fn(async () => Response.json({ item: { ...item, revision: 2 } }));vi.stubGlobal("fetch", fetcher);
    render(view(vi.fn(), account));open();fireEvent.change(screen.getByLabelText("본문"), { target: { value: "재시도할 초안" } });
    fireEvent.click(screen.getByRole("button", { name: "초안 저장" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(screen.getByRole("alert")).toHaveTextContent("입력 내용은 유지");expect(screen.getByLabelText("본문")).toHaveValue("재시도할 초안");
    expect(screen.getByRole("button", { name: "초안 저장" })).toBeEnabled();expect(fetcher).not.toHaveBeenCalled();
    vi.useRealTimers();fireEvent.click(screen.getByRole("button", { name: "초안 저장" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  });

  it("unlocks an image upload when its token never settles and removes the timer on unmount", async () => {
    vi.useFakeTimers();
    const account = { uid: "stalled", getIdToken: () => new Promise(() => {}) } as unknown as User;
    const banner: ManagedContentRecord = { ...item, id: "d2d4132c-1683-4e6a-915c-574201a76566", published: null, draft: { kind: "banner", category: "event", placement: "home", title: "이미지 배너", description: "", imageDesktop: "", imageMobile: "", imageAlt: "", link: "", priority: 0, dismissible: true, startsAt: null, endsAt: null } };
    const fetcher = vi.fn();vi.stubGlobal("fetch", fetcher);
    const { unmount } = render(<ManagedContentManager kind="banner" user={account} items={[banner]} mediaAvailable onSaved={vi.fn()} onReload={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /이미지 배너/ }));fireEvent.change(screen.getByLabelText("데스크톱 이미지"), { target: { files: [new File(["fixture"], "banner.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByRole("button", { name: "데스크톱 이미지 업로드" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(screen.getByRole("alert")).toHaveTextContent("이미지를 올리지 못했습니다");expect(screen.getByRole("button", { name: "데스크톱 이미지 업로드" })).toBeEnabled();expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "데스크톱 이미지 업로드" }));unmount();expect(vi.getTimerCount()).toBe(0);
  });

  it("uses Korea time independently of the browser timezone and identifies reserved/ended content", () => {
    expect(fromSeoulInput("2026-10-26T09:00")).toBe("2026-10-26T00:00:00.000Z");
    expect(toSeoulInput("2026-10-26T00:00:00Z")).toBe("2026-10-26T09:00");
    const at = Date.parse("2026-10-26T00:00:00Z");
    expect(publicationLabel({ ...item, published: { ...draft, startsAt: "2026-10-27T00:00:00Z" } }, at)).toBe("예약");
    expect(publicationLabel({ ...item, published: { ...draft, endsAt: "2026-10-25T00:00:00Z" } }, at)).toBe("종료");
    expect(publicationLabel({ ...item, archived: true }, at)).toBe("보관");
  });
});
