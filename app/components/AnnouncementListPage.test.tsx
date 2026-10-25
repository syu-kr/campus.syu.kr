import { renderToStaticMarkup } from "react-dom/server";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchAnnouncementPage, type AnnouncementPageResponse } from "@/lib/api";
import { getDictionary } from "@/lib/i18n";
import { AnnouncementListPage } from "./AnnouncementListPage";

const urlSearch = vi.hoisted(() => ({ value: "", page: "1" }));
const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/academic/announcements",
  useSearchParams: () => new URLSearchParams({ search: urlSearch.value, page: urlSearch.page, lang: "en" }),
}));
vi.mock("@/lib/api", () => ({ fetchAnnouncementPage: vi.fn() }));

const initialPage: AnnouncementPageResponse = {
  items: [{
    id: "initial",
    title: "서버 초기 공지",
    content: "초기 내용",
    category: "academic",
    date: "2026-10-14",
    author: "학사지원팀",
    views: 0,
    isImportant: false,
    url: "https://www.syu.ac.kr/notice/initial",
  }],
  total: 11,
  page: 1,
  limit: 10,
  totalPages: 2,
};
let client: QueryClient;

beforeEach(() => {
  urlSearch.value = "";
  urlSearch.page = "1";
  window.history.replaceState(null, "", "/academic/announcements?lang=en");
  const navigate = (href: string) => {
    window.history.replaceState(null, "", href);
    const params = new URLSearchParams(window.location.search);
    urlSearch.value = params.get("search") ?? "";
    urlSearch.page = params.get("page") ?? "1";
  };
  navigation.push.mockReset().mockImplementation(navigate);
  navigation.replace.mockReset().mockImplementation(navigate);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(fetchAnnouncementPage).mockReset();
  vi.mocked(fetchAnnouncementPage).mockImplementation(() => new Promise(() => {}));
});
afterEach(() => client.clear());

function page(data = initialPage) {
  return (
    <QueryClientProvider client={client}>
      <AnnouncementListPage category="academic" title="학사공지" description="설명" errorMessage="조회 실패" initialPage={data} />
    </QueryClientProvider>
  );
}

it("renders initial notices and safe original links without a duplicate detail link or browser request", () => {
  const html = renderToStaticMarkup(page());
  expect(html).toContain("서버 초기 공지");
  expect(html).toContain('href="https://www.syu.ac.kr/notice/initial"');
  expect(html).toContain('target="_blank"');
  expect(html).toContain('rel="noopener noreferrer"');
  expect(html).not.toContain('href="/announcements/academic/initial"');
  expect(html).not.toContain("요약 상세");
  expect(fetchAnnouncementPage).not.toHaveBeenCalled();
});

it("does not seed a searched query with the default initial notices", async () => {
  urlSearch.value = "장학";
  render(page());
  expect(screen.queryByText("서버 초기 공지")).not.toBeInTheDocument();
  await waitFor(() => expect(fetchAnnouncementPage).toHaveBeenCalledWith(expect.objectContaining({ query: "장학", page: 1 })));
});

it("does not reuse the first page's initial notices for page two", async () => {
  render(page());
  expect(screen.getByText("서버 초기 공지")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: getDictionary("ko").pagination.next }));
  expect(window.location.search).toContain("page=2");
  expect(window.location.search).toContain("lang=en");
  expect(navigation.push).toHaveBeenCalledWith(expect.stringContaining("/academic/announcements?"), { scroll: false });
  expect(screen.queryByText("서버 초기 공지")).not.toBeInTheDocument();
  await waitFor(() => expect(fetchAnnouncementPage).toHaveBeenCalledWith(expect.objectContaining({ query: "", page: 2 })));
});

it("keeps the same pagination DOM for a pending page of the same query while the body remains loading", async () => {
  let resolvePage: (value: AnnouncementPageResponse) => void = () => {};
  vi.mocked(fetchAnnouncementPage).mockImplementation(() => new Promise(resolve => { resolvePage = resolve; }));
  const { container } = render(page());
  const marker = container.querySelector(".m3-sliding-indicator");
  const results = container.querySelector<HTMLElement>(".notice-workspace-list")!;
  vi.spyOn(results, "getBoundingClientRect").mockReturnValue({ height: 1800 } as DOMRect);
  fireEvent.click(screen.getByRole("link", { name: "2" }));
  await waitFor(() => expect(fetchAnnouncementPage).toHaveBeenCalled());
  expect(container.querySelector(".m3-sliding-indicator")).toBe(marker);
  expect(screen.getByRole("link", { name: "2" })).toHaveAttribute("aria-current", "page");
  expect(screen.queryByText("서버 초기 공지")).not.toBeInTheDocument();
  expect(results.style.minHeight).toBe("1800px");
  await act(async () => resolvePage({ ...initialPage, page: 2, total: 21, totalPages: 3,
    items: [{ ...initialPage.items[0], id: "second", title: "새 페이지 공지" }] }));
  await screen.findByText("새 페이지 공지");
  expect(results.style.minHeight).toBe("");
  expect(container.querySelector(".m3-sliding-indicator")).toBe(marker);
  expect(screen.getByText("2 / 3")).toBeInTheDocument();
  expect(window.location.search).toContain("lang=en");
});

it("hides previous pagination when the search changes or the new page fails", async () => {
  const { container, unmount } = render(page());
  fireEvent.change(screen.getByRole("textbox", { name: getDictionary("ko").search.label }), { target: { value: "새 검색" } });
  expect(container.querySelector(".m3-pagination")).toBeNull();
  unmount();
  client.clear();
  urlSearch.value = "";
  urlSearch.page = "1";
  vi.mocked(fetchAnnouncementPage).mockRejectedValue(new Error("Unavailable"));
  const next = render(page());
  fireEvent.click(screen.getByRole("link", { name: "2" }));
  await screen.findByText("조회 실패");
  expect(next.container.querySelector(".m3-pagination")).toBeNull();
  expect(next.container.querySelector<HTMLElement>(".notice-workspace-list")?.style.minHeight).toBe("");
});

it("releases a preserved page height immediately when a pending page is replaced by a search", async () => {
  const { container } = render(page());
  const results = container.querySelector<HTMLElement>(".notice-workspace-list")!;
  vi.spyOn(results, "getBoundingClientRect").mockReturnValue({ height: 1800 } as DOMRect);
  fireEvent.click(screen.getByRole("link", { name: "2" }));
  await waitFor(() => expect(results.style.minHeight).toBe("1800px"));
  fireEvent.change(screen.getByRole("textbox", { name: getDictionary("ko").search.label }), { target: { value: "다른 검색" } });
  expect(results.style.minHeight).toBe("");
  expect(container.querySelector(".m3-pagination")).toBeNull();
});

it("keeps pagination and list height during a page-only RSC transition even when its browser data is cached", async () => {
  const secondPage = { ...initialPage, page: 2, items: [{ ...initialPage.items[0], title: "캐시된 두 번째 공지" }] };
  client.setQueryData(["announcement-page", "academic", "", 2], secondPage);
  let finishNavigation: () => void = () => {};
  navigation.push.mockImplementation(() => new Promise<void>(resolve => { finishNavigation = resolve; }));
  const { container, rerender } = render(page());
  const marker = container.querySelector(".m3-sliding-indicator");
  const results = container.querySelector<HTMLElement>(".notice-workspace-list")!;
  vi.spyOn(results, "getBoundingClientRect").mockReturnValue({ height: 1800 } as DOMRect);
  fireEvent.click(screen.getByRole("link", { name: "2" }));
  expect(container.querySelector(".m3-sliding-indicator")).toBe(marker);
  expect(results.style.minHeight).toBe("1800px");
  expect(screen.queryByText("캐시된 두 번째 공지")).not.toBeInTheDocument();
  await act(async () => { urlSearch.page = "2"; finishNavigation(); });
  rerender(page(secondPage));
  expect(screen.getByText("캐시된 두 번째 공지")).toBeInTheDocument();
  expect(results.style.minHeight).toBe("");
  expect(container.querySelector(".m3-sliding-indicator")).toBe(marker);
  expect(fetchAnnouncementPage).not.toHaveBeenCalled();
});

it("uses an arriving RSC page directly instead of an old cached result or duplicate browser request", () => {
  urlSearch.page = "2";
  client.setQueryData(["announcement-page", "academic", "", 2], { ...initialPage, page: 2 });
  const freshPage = { ...initialPage, page: 2, items: [{ ...initialPage.items[0], title: "서버에서 갱신된 공지" }] };
  render(<QueryClientProvider client={client}>
    <AnnouncementListPage category="academic" title="학사공지" description="설명" errorMessage="실패" initialPage={freshPage} />
  </QueryClientProvider>);
  expect(screen.getByText("서버에서 갱신된 공지")).toBeInTheDocument();
  expect(screen.queryByText("서버 초기 공지")).not.toBeInTheDocument();
  expect(fetchAnnouncementPage).not.toHaveBeenCalled();
});

it("recovers from a prior browser query failure when a valid server page arrives", async () => {
  await client.fetchQuery({
    queryKey: ["announcement-page", "academic", "", 1],
    queryFn: async () => { throw new Error("Previous browser failure"); },
  }).catch(() => undefined);
  render(page());
  expect(screen.getByText("서버 초기 공지")).toBeInTheDocument();
  expect(screen.queryByText("조회 실패")).not.toBeInTheDocument();
  expect(fetchAnnouncementPage).not.toHaveBeenCalled();
});

it("preserves input focus when updated search data arrives from an RSC navigation", async () => {
  const { rerender } = render(page());
  const input = screen.getByRole("textbox", { name: getDictionary("ko").search.label });
  input.focus();
  fireEvent.change(input, { target: { value: "장학" } });
  const searchedPage = { ...initialPage, items: [{ ...initialPage.items[0], title: "장학 검색 결과" }] };
  rerender(<QueryClientProvider client={client}>
    <AnnouncementListPage category="academic" title="학사공지" description="설명" errorMessage="실패" initialPage={searchedPage} initialQuery="장학" />
  </QueryClientProvider>);
  await waitFor(() => expect(screen.getByText("장학 검색 결과")).toBeInTheDocument());
  expect(input).toHaveFocus();
  expect(input).toHaveValue("장학");
  expect(navigation.replace).toHaveBeenCalledWith("/academic/announcements?search=%EC%9E%A5%ED%95%99&lang=en", { scroll: false });
  expect(fetchAnnouncementPage).not.toHaveBeenCalled();
});

it("renders a requested server page and links without leaking the first page's cache", () => {
  urlSearch.page = "2";
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AnnouncementListPage category="academic" title="학사공지" description="설명" errorMessage="실패"
        initialPage={{ ...initialPage, page: 2, items: [{ ...initialPage.items[0], title: "서버 두번째 공지" }] }} />
    </QueryClientProvider>,
  );
  expect(html).toContain("서버 두번째 공지");
  expect(html).toContain('aria-current="page"');
  expect(html).toContain("?lang=en");
  expect(fetchAnnouncementPage).not.toHaveBeenCalled();
});

it("resets a searched list to page one while preserving the locale query", () => {
  urlSearch.page = "2";
  render(<QueryClientProvider client={client}>
    <AnnouncementListPage category="academic" title="학사공지" description="설명" errorMessage="실패" initialPage={{ ...initialPage, page: 2 }} />
  </QueryClientProvider>);
  fireEvent.change(screen.getByRole("textbox", { name: getDictionary("ko").search.label }), { target: { value: "장학" } });
  const params = new URLSearchParams(window.location.search);
  expect(params.get("search")).toBe("장학");
  expect(params.has("page")).toBe(false);
  expect(params.get("lang")).toBe("en");
});

it("keeps original notices without exposing source-retention diagnostics or querying source health", () => {
  render(page({ ...initialPage, fallbackSources: [{ category: "academic", latestDate: "2000-01-01" }] }));
  expect(screen.getByText("서버 초기 공지")).toBeInTheDocument();
  expect(screen.getByText("2026.10.14")).toBeInTheDocument();
  expect(screen.queryByText("2000-01-01", { exact: false })).not.toBeInTheDocument();
  expect(screen.queryByText(/저장된 공지|정보 기준|이전 확인 정보/)).not.toBeInTheDocument();
  expect(client.getQueryCache().findAll().map((query) => query.queryKey[0])).toEqual(["announcement-page"]);
});
