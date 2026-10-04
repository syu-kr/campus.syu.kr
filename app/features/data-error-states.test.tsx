import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCampusTips, fetchPhoneNumbers } from "@/lib/api";
import { getDictionary } from "@/lib/i18n";
import PhonePageClient from "./phone/PhonePageClient";
import CampusTipsPageClient from "./campus-tips/CampusTipsPageClient";

vi.mock("@/lib/api", () => ({ fetchCampusTips: vi.fn(), fetchPhoneNumbers: vi.fn() }));
vi.mock("@/lib/use-url-search", () => ({ useUrlSearch: () => ["", vi.fn()] }));

const dictionary = getDictionary("ko");
let client: QueryClient;

beforeEach(() => {
  vi.mocked(fetchPhoneNumbers).mockReset();
  vi.mocked(fetchCampusTips).mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => client.clear());

describe("directory and tips failure states", () => {
  it("preserves the cached directory after a failed refresh and retries", async () => {
    vi.mocked(fetchPhoneNumbers).mockRejectedValueOnce(new Error("offline"));
    render(
      <QueryClientProvider client={client}>
        <PhonePageClient initialPhoneNumbers={[{ department: "기존 부서", phone: "02-3399-0000" }]} />
      </QueryClientProvider>,
    );
    await act(async () => { await client.invalidateQueries({ queryKey: ["phone-numbers"] }); });

    expect(await screen.findByRole("alert")).toHaveTextContent(dictionary.home.dashboard.loadFailedMessage);
    expect(screen.getByRole("heading", { name: "기존 부서" })).toBeInTheDocument();
    expect(screen.queryByText(dictionary.pages.phone.empty)).not.toBeInTheDocument();

    vi.mocked(fetchPhoneNumbers).mockResolvedValue([{ department: "갱신된 부서", phone: "02-3399-1111" }]);
    fireEvent.click(screen.getByRole("button", { name: dictionary.home.dashboard.retry }));
    expect(await screen.findByRole("heading", { name: "갱신된 부서" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("shows initial tips failure as an error instead of empty search and recovers on retry", async () => {
    vi.mocked(fetchCampusTips).mockRejectedValueOnce(new Error("offline"));
    render(
      <QueryClientProvider client={client}>
        <CampusTipsPageClient />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(dictionary.pages.campusTips.emptyMessage)).not.toBeInTheDocument();

    vi.mocked(fetchCampusTips).mockResolvedValue([{
      id: "official-library",
      title: "도서관 이용 안내",
      category: "school",
      url: "https://lib.syu.ac.kr/",
      tags: [],
      sourceType: "official",
      isExternal: true,
    }]);
    fireEvent.click(screen.getByRole("button", { name: dictionary.home.dashboard.retry }));
    expect(await screen.findByRole("heading", { name: "도서관 이용 안내" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});
