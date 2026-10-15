import { renderToStaticMarkup } from "react-dom/server";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchAnnouncementPage, type AnnouncementPageResponse } from "@/lib/api";
import { getDictionary } from "@/lib/i18n";
import { AnnouncementListPage } from "./AnnouncementListPage";

const urlSearch = vi.hoisted(() => ({ value: "" }));
vi.mock("@/lib/use-url-search", () => ({ useUrlSearch: () => [urlSearch.value, vi.fn()] }));
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

it("renders initial notices and detail links into server HTML without a browser request", () => {
  const html = renderToStaticMarkup(page());
  expect(html).toContain("서버 초기 공지");
  expect(html).toContain('href="/announcements/academic/initial"');
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
  fireEvent.click(screen.getByRole("button", { name: getDictionary("ko").pagination.next }));
  expect(screen.queryByText("서버 초기 공지")).not.toBeInTheDocument();
  await waitFor(() => expect(fetchAnnouncementPage).toHaveBeenCalledWith(expect.objectContaining({ query: "", page: 2 })));
});
