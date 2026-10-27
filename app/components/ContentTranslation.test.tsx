import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePathname } from "next/navigation";
import { LocaleProvider } from "./LocaleProvider";
import { PageTranslationStatus, PublicContentTranslation } from "./ContentTranslation";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));
beforeEach(() => vi.mocked(usePathname).mockReturnValue("/en/terms"));

let sequence = 0;
afterEach(() => vi.unstubAllGlobals());
const response = (source: Record<string, string>, translated: Record<string, string> = { title: "Public notice" }) => Response.json({ results: [{ ok: true, result: { originals: source, translations: translated, target: "en", provider: "google" } }] });
function view(content = { title: "공개 공지" }, id = String(++sequence), locale: "en" | "ko" = "en") {
  return <LocaleProvider locale={locale}><PageTranslationStatus /><PublicContentTranslation source={{ kind: "announcement", id, category: "academic" }} content={content}>{translation => <h2 lang={translation.lang}>{translation.text("title", content.title)}</h2>}</PublicContentTranslation></LocaleProvider>;
}
describe("automatic page translation", () => {
  it("reserves the English home status slot without exposing an idle message or adding other-page space", () => {
    const { container, rerender } = render(<LocaleProvider locale="en"><PageTranslationStatus /></LocaleProvider>);
    expect(container.querySelector("aside")).toBeNull();
    vi.mocked(usePathname).mockReturnValue("/en");
    rerender(<LocaleProvider locale="en"><PageTranslationStatus /></LocaleProvider>);
    const slot = container.querySelector("aside")!;
    expect(slot).toHaveStyle({ visibility: "hidden" });
    expect(slot).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    vi.mocked(usePathname).mockReturnValue("/en/terms");
    rerender(<LocaleProvider locale="en"><PageTranslationStatus /></LocaleProvider>);
    expect(container.querySelector("aside")).toBeNull();
    vi.mocked(usePathname).mockReturnValue("/");
    rerender(<LocaleProvider locale="ko"><PageTranslationStatus /></LocaleProvider>);
    expect(container.querySelector("aside")).toBeNull();
  });

  it("automatically replaces Korean at the original position and provides one attribution without per-post buttons", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ title: "공개 공지" })); vi.stubGlobal("fetch", fetcher);
    render(view());
    expect(await screen.findByRole("heading", { name: "Public notice" })).toHaveAttribute("lang", "en-x-mtfrom-ko");
    expect(screen.queryByText("공개 공지")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Translate with Google|Show original/ })).not.toBeInTheDocument();
    expect(screen.getAllByAltText("Powered by Google Translate")).toHaveLength(1);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ requests: [{ source: { kind: "announcement", id: expect.any(String), category: "academic" }, fields: ["title"], target: "en" }] });
  });
  it("keeps the original on failure and exposes recovery once per page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ code: "TRANSLATION_UNAVAILABLE" }, { status: 503 })));
    render(view());
    expect(await screen.findByRole("button", { name: "Retry translation" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "공개 공지" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("currently unavailable");
    const retry = screen.getByRole("button", { name: "Retry translation" });
    act(() => retry.focus());
    fireEvent.click(retry);
    expect(screen.getByRole("status")).toHaveFocus();
    expect(await screen.findByRole("button", { name: "Retry translation" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveFocus();
  });
  it("rejects stale source text instead of replacing the current view", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ title: "서버에서 바뀐 내용" })));
    render(view());
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("has changed"));
    expect(screen.getByRole("heading", { name: "공개 공지" })).toBeVisible();
  });
  it("does not request translation in Korean or for an English source", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const { rerender } = render(view({ title: "공개 공지" }, "korean", "ko"));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 60)); });
    expect(fetcher).not.toHaveBeenCalled();
    rerender(view({ title: "Reviewed English" }, "english"));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 60)); });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("ignores a late English response after switching to Korean", async () => {
    let finish!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
    const id = String(++sequence), rendered = render(view({ title: "공개 공지" }, id));
    await waitFor(() => expect(finish).toBeTypeOf("function"));
    rendered.rerender(view({ title: "공개 공지" }, id, "ko"));
    await act(async () => finish(response({ title: "공개 공지" })));
    expect(screen.getByRole("heading", { name: "공개 공지" })).toBeVisible();
    expect(screen.queryByText("Public notice")).not.toBeInTheDocument();
  });
});
