import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAnnouncementPage, fetchCompetitionPage } from "@/lib/api";
import type { CrawlSourceHealth, DailyCrawlDataFile } from "@/lib/crawl-data-contract";
import { fetchJson } from "@/lib/fetch-json";
import { getDictionary } from "@/lib/i18n";
import { CompetitionsPageClient } from "@/app/features/academic/CompetitionsPageClient";
import { AnnouncementListPage } from "./AnnouncementListPage";
import { CrawlDataStatus } from "./CrawlDataStatus";
import { LocaleProvider } from "./LocaleProvider";

vi.mock("@/lib/fetch-json", () => ({ fetchJson: vi.fn() }));
vi.mock("@/lib/api", () => ({
  fetchAnnouncementPage: vi.fn(),
  fetchCompetitionPage: vi.fn(),
}));
vi.mock("@/lib/use-url-search", () => ({ useUrlSearch: () => ["", vi.fn()] }));

const text = getDictionary("ko").crawlDataStatus;
const staleHealth: CrawlSourceHealth = {
  status: "stale",
  lastSuccessAt: "2026-10-04T01:00:00Z",
  lastAttemptAt: "2026-10-04T02:00:00Z",
};
let client: QueryClient;

beforeEach(() => {
  vi.mocked(fetchJson).mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(fetchAnnouncementPage).mockResolvedValue({
    items: [], total: 0, page: 1, limit: 10, totalPages: 1, fallbackSources: [],
  });
  vi.mocked(fetchCompetitionPage).mockResolvedValue({
    items: [], total: 0, page: 1, limit: 10, totalPages: 1,
  });
});
afterEach(() => client.clear());

function renderStatus(fileNames: DailyCrawlDataFile[]) {
  return render(
    <QueryClientProvider client={client}>
      <CrawlDataStatus fileNames={fileNames} />
    </QueryClientProvider>,
  );
}

describe("crawl source status", () => {
  it("only warns about stale requested sources and distinguishes both KST collection times", async () => {
    vi.mocked(fetchJson).mockResolvedValue({
      sourceHealth: {
        "announcements-academic.json": staleHealth,
        "announcements-campus-life.json": staleHealth,
        "announcements-sw.json": { ...staleHealth, status: "fresh" },
      },
    });
    const view = renderStatus(["announcements-academic.json", "announcements-sw.json"]);
    const warning = await screen.findByRole("status");

    expect(warning).toHaveTextContent(text.fileLabels["announcements-academic.json"]);
    expect(warning).not.toHaveTextContent(text.fileLabels["announcements-campus-life.json"]);
    expect(warning).not.toHaveTextContent(text.fileLabels["announcements-sw.json"]);
    expect(warning).toHaveTextContent(text.lastSuccess);
    expect(warning).toHaveTextContent(text.lastAttempt);
    const times = view.container.querySelectorAll("time");
    expect(times[0]).toHaveAttribute("datetime", staleHealth.lastSuccessAt);
    expect(times[0]).toHaveTextContent(/10:00/);
    expect(times[1]).toHaveAttribute("datetime", staleHealth.lastAttemptAt);
    expect(times[1]).toHaveTextContent(/11:00/);
    expect(times[0]).toHaveTextContent(/GMT\+9/);
  });

  it("does not invent the previous successful collection time for legacy retained data", async () => {
    vi.mocked(fetchJson).mockResolvedValue({
      sourceHealth: {
        "cafeteria-menu.json": { status: "stale", lastAttemptAt: staleHealth.lastAttemptAt },
      },
    });
    const view = renderStatus(["cafeteria-menu.json"]);
    const warning = await screen.findByRole("status");

    expect(warning).toHaveTextContent(text.unknownSuccess);
    expect(warning).not.toHaveTextContent(text.lastSuccess);
    expect(view.container.querySelectorAll("time")).toHaveLength(1);
  });

  it("does not infer stale sources when a legacy manifest has no health records", async () => {
    const payload = { sourceHealth: {} };
    vi.mocked(fetchJson).mockResolvedValue(payload);
    const view = renderStatus(["cafeteria-menu.json"]);

    await waitFor(() => expect(client.getQueryData(["crawl-data-status"])).toEqual(payload));
    expect(view.container).toBeEmptyDOMElement();
  });

  it("reports status lookup failure separately from the content data", async () => {
    vi.mocked(fetchJson).mockRejectedValue(new Error("offline"));
    renderStatus(["announcements-academic.json"]);

    expect(await screen.findByRole("status")).toHaveTextContent(text.statusUnavailable);
  });

  it("keeps cached stale-source warnings visible after a failed status refresh", async () => {
    client.setQueryData(["crawl-data-status"], {
      sourceHealth: { "announcements-academic.json": staleHealth },
    });
    vi.mocked(fetchJson).mockRejectedValue(new Error("offline"));
    renderStatus(["announcements-academic.json"]);
    await act(async () => { await client.invalidateQueries({ queryKey: ["crawl-data-status"] }); });

    expect(await screen.findByText(text.statusUnavailable)).toBeInTheDocument();
    expect(screen.getByText(text.staleTitle)).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(2);
  });

  it("uses English date labels while retaining the Korean collection timezone", async () => {
    vi.mocked(fetchJson).mockResolvedValue({
      sourceHealth: { "announcements-academic.json": staleHealth },
    });
    const view = render(
      <QueryClientProvider client={client}>
        <LocaleProvider locale="en">
          <CrawlDataStatus fileNames={["announcements-academic.json"]} />
        </LocaleProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      getDictionary("en").crawlDataStatus.lastSuccess,
    );
    expect(view.container.querySelector("time")).toHaveTextContent(/10:00 AM/);
    expect(view.container.querySelector("time")).toHaveTextContent(/GMT\+9/);
  });

  it("limits announcement warnings to the page category", async () => {
    vi.mocked(fetchJson).mockResolvedValue({
      sourceHealth: {
        "announcements-academic.json": staleHealth,
        "announcements-campus-life.json": staleHealth,
      },
    });
    render(
      <QueryClientProvider client={client}>
        <AnnouncementListPage category="academic" title="Notices" description="Notices" errorMessage="Failed" />
      </QueryClientProvider>,
    );
    const warning = await screen.findByRole("status");

    expect(warning).toHaveTextContent(text.fileLabels["announcements-academic.json"]);
    expect(warning).not.toHaveTextContent(text.fileLabels["announcements-campus-life.json"]);
  });

  it("updates the competition warning sources when the source filter changes", async () => {
    vi.mocked(fetchJson).mockResolvedValue({
      sourceHealth: {
        "announcements-events.json": staleHealth,
        "announcements-departments.json": staleHealth,
      },
    });
    render(
      <QueryClientProvider client={client}>
        <CompetitionsPageClient />
      </QueryClientProvider>,
    );
    const warning = await screen.findByRole("status");
    expect(within(warning).getByText(text.fileLabels["announcements-departments.json"])).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", {
      name: getDictionary("ko").pages.competitions.sourceFilters.event,
    }));
    expect(within(warning).getByText(text.fileLabels["announcements-events.json"])).toBeInTheDocument();
    expect(within(warning).queryByText(text.fileLabels["announcements-departments.json"])).not.toBeInTheDocument();
  });
});
