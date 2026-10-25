import { renderToStaticMarkup } from "react-dom/server";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
vi.mock("./CrawlDataStatus", () => ({ CrawlDataStatus: () => null }));

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

function page() {
  return (
    <QueryClientProvider client={client}>
      <AnnouncementListPage category="academic" title="학사공지" description="설명" errorMessage="조회 실패" initialPage={initialPage} />
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
