import { act, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/app/components/LocaleProvider";
import { fetchShuttleBuses, fetchShuttleSpecialPeriods } from "@/lib/api";
import { getDictionary, type Locale } from "@/lib/i18n";
import { PUBLIC_HOLIDAY_SOURCE_URL } from "@/lib/public-holidays";
import buses from "@/public/data/shuttle-bus-schedule.json";
import periods from "@/public/data/shuttle-special-periods.json";
import type { ShuttleSpecialPeriods } from "@/types";
import ShuttleSection, { type ShuttleInitialData } from "./ShuttleSection";

vi.mock("@/lib/api", () => ({
  fetchShuttleBuses: vi.fn(),
  fetchShuttleSpecialPeriods: vi.fn(),
  fetchPublicHolidays: vi.fn(),
  fetchBusLocationStatus: vi.fn(async () => ({
    data: [], timestamp: "2026-10-07T11:55:00+09:00", stale: false, sourceStatus: "fresh",
  })),
}));
vi.mock("@/app/features/shuttle/ShuttleMap", () => ({ ShuttleMap: () => null }));

afterEach(() => vi.useRealTimers());

function initialData(nowISO = "2026-10-07T11:55:00+09:00"): ShuttleInitialData {
  return {
    buses,
    specialPeriods: periods as ShuttleSpecialPeriods,
    holidays: {
      schemaVersion: 1, sourceUrl: PUBLIC_HOLIDAY_SOURCE_URL,
      lastSuccessAt: "2026-10-06T01:00:00Z", years: [2026], holidays: [],
    },
    nowISO,
    nonce: "shuttle-test-nonce",
  };
}

function content(client: QueryClient, data: ShuttleInitialData, locale: Locale = "ko") {
  return (
    <QueryClientProvider client={client}>
      <LocaleProvider locale={locale}>
        <ShuttleSection initialData={data} />
      </LocaleProvider>
    </QueryClientProvider>
  );
}

function answerSchema(root: ParentNode = document) {
  const script = root.querySelector<HTMLScriptElement>("#shuttle-answer-schema");
  expect(script).not.toBeNull();
  return JSON.parse(script!.textContent!) as {
    inLanguage: string;
    mainEntity: { name: string; acceptedAnswer: { text: string } }[];
  };
}

describe("shuttle answer and source provenance", () => {
  it.each(["ko", "en"] as const)("server renders the same visible answer and schema from the initial snapshot in %s", (locale) => {
    const data = initialData();
    const client = new QueryClient();
    const markup = renderToString(content(client, data, locale));
    const parsed = new DOMParser().parseFromString(markup, "text/html");
    const schema = answerSchema(parsed);
    const question = getDictionary(locale).pages.busInfo.answer.question;

    expect(parsed.body.textContent).toContain(question);
    expect(schema.mainEntity[0].name).toBe(question);
    expect(schema.mainEntity[0].acceptedAnswer.text).toBe(parsed.querySelector("[data-answer-text]")!.textContent);
    expect(parsed.querySelector("section")?.textContent).toContain("12:00");
    expect(schema.mainEntity[0].acceptedAnswer.text).toContain("12:00");
    expect(parsed.querySelector("#shuttle-answer-schema")?.getAttribute("nonce")).toBe(data.nonce);
    const times = Array.from(parsed.querySelectorAll("time"), (time) => time.dateTime);
    expect(times).toContain(data.holidays.lastSuccessAt);
    expect(times).toContain(new Date(data.nowISO).toISOString());
    expect(times).not.toContain("2026-04-29");
    expect(parsed.body.textContent).toContain(getDictionary(locale).answerSummary.unknownCheckedAt);
    client.clear();
  });

  it("updates the visible answer and JSON-LD together at a departure boundary", async () => {
    vi.useFakeTimers();
    const data = initialData("2026-10-07T11:59:59+09:00");
    vi.setSystemTime(new Date(data.nowISO));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(content(client, data));
    const region = within(screen.getByRole("region", { name: getDictionary("ko").pages.busInfo.answer.title }));
    const before = answerSchema().mainEntity[0].acceptedAnswer.text;
    expect(before).toContain("12:00");
    expect(region.getByText(/다음 셔틀은/)).toHaveTextContent("1분");

    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });

    const after = answerSchema().mainEntity[0].acceptedAnswer.text;
    expect(after).not.toBe(before);
    expect(after).toBe(region.getByText(/다음 셔틀은/).textContent);
    expect(region.getByText(/다음 셔틀은/)).toHaveTextContent("12:25");
    expect(region.getByText(/다음 셔틀은/)).toHaveTextContent("25분");
    view.unmount();
    client.clear();
  });

  it("uses the verified exception time and retains a stale holiday warning", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const data = initialData("2027-01-02T11:55:00+09:00");
    vi.setSystemTime(new Date(data.nowISO));
    const evidence = {
      date: "2027-01-02", routeId: "shuttle-1", times: ["12:15"],
      sourceUrl: "https://www.syu.ac.kr/school-life/school-bus/",
      verifiedAt: "2026-12-31T03:00:00Z",
    };
    data.specialPeriods = { ...data.specialPeriods, serviceExceptions: [evidence] };
    const client = new QueryClient();
    const view = render(content(client, data));
    const region = within(screen.getByRole("region", { name: getDictionary("ko").pages.busInfo.answer.title }));
    expect(region.getByRole("link", { name: getDictionary("ko").pages.busInfo.verifiedSource }))
      .toHaveAttribute("href", evidence.sourceUrl);
    expect(region.getByText(getDictionary("ko").publicHolidays.stale)).toBeInTheDocument();
    expect(region.queryByText(getDictionary("ko").pages.busInfo.scheduleNotice)).not.toBeInTheDocument();
    expect(view.container.querySelector(`time[datetime="${evidence.verifiedAt}"]`)).toBeInTheDocument();
    expect(answerSchema().mainEntity[0].acceptedAnswer.text).toContain("12:15");
    view.unmount();
    client.clear();
  });

  it("removes predictions from both the answer and schema when holiday coverage becomes stale", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const data = initialData();
    vi.setSystemTime(new Date(data.nowISO));
    const client = new QueryClient();
    const view = render(content(client, data));
    expect(answerSchema().mainEntity[0].acceptedAnswer.text).toContain("12:00");

    act(() => { client.setQueryData(["public-holidays"], { ...data.holidays, stale: true }); });

    const text = getDictionary("ko");
    await waitFor(() => expect(answerSchema().mainEntity[0].acceptedAnswer.text).toContain(text.publicHolidays.shuttleUnconfirmed));
    const region = within(screen.getByRole("region", { name: text.pages.busInfo.answer.title }));
    expect(region.getByText(text.publicHolidays.shuttleUnconfirmed, { exact: false })).toBeInTheDocument();
    expect(region.getByText(text.publicHolidays.stale)).toBeInTheDocument();
    expect(answerSchema().mainEntity[0].acceptedAnswer.text).not.toContain("12:00");
    view.unmount();
    client.clear();
  });

  it("marks special schedules without verification records as unverified", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const data = initialData("2026-10-20T18:35:00+09:00");
    vi.setSystemTime(new Date(data.nowISO));
    data.holidays.lastSuccessAt = "2026-10-20T00:00:00Z";
    const client = new QueryClient();
    const view = render(content(client, data));
    const region = within(screen.getByRole("region", { name: getDictionary("ko").pages.busInfo.answer.title }));
    expect(region.getByText(/중간고사 연장 운행/)).toHaveTextContent(getDictionary("ko").answerSummary.unknownCheckedAt);
    expect(answerSchema().mainEntity[0].acceptedAnswer.text).toContain("18:40");
    view.unmount();
    client.clear();
  });

  it.each(["shuttle-buses", "shuttle-special-periods"] as const)(
    "replaces retained departure predictions in both the answer and schema after a failed %s refresh",
    async (queryKey) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      const data = initialData();
      vi.setSystemTime(new Date(data.nowISO));
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const view = render(content(client, data));
      expect(answerSchema().mainEntity[0].acceptedAnswer.text).toContain("12:00");
      const fetchData = queryKey === "shuttle-buses" ? fetchShuttleBuses : fetchShuttleSpecialPeriods;
      vi.mocked(fetchData).mockRejectedValueOnce(new Error("Source unavailable"));

      await act(async () => { await client.refetchQueries({ queryKey: [queryKey] }); });

      const text = getDictionary("ko");
      await waitFor(() => expect(answerSchema().mainEntity[0].acceptedAnswer.text).toBe(text.home.dashboard.loadFailedMessage));
      const region = within(screen.getByRole("region", { name: text.pages.busInfo.answer.title }));
      expect(region.getByText(text.home.dashboard.loadFailedMessage)).toBeInTheDocument();
      expect(region.queryByText(/다음 셔틀은/)).not.toBeInTheDocument();
      expect(answerSchema().mainEntity[0].acceptedAnswer.text).not.toContain("12:00");
      expect(client.getQueryData([queryKey])).toEqual(queryKey === "shuttle-buses" ? data.buses : data.specialPeriods);
      expect(view.container.querySelector(`time[datetime="${data.holidays.lastSuccessAt}"]`)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: text.home.dashboard.retry })).toBeInTheDocument();
      view.unmount();
      client.clear();
    },
  );
});
