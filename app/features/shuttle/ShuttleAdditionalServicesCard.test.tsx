import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "@/app/components/LocaleProvider";
import { TodayShuttleSection } from "@/app/features/home/HomeDashboardSections";
import { ShuttleAdditionalServicesCard } from "./ShuttleAdditionalServicesCard";
import buses from "@/public/data/shuttle-bus-schedule.json";
import periods from "@/public/data/shuttle-special-periods.json";
import type { ShuttleSpecialPeriods } from "@/types";
import { PUBLIC_HOLIDAY_SOURCE_URL } from "@/lib/public-holidays";

const specialPeriods = periods as ShuttleSpecialPeriods;
const festival = specialPeriods.specialPeriods.find(
  (period) => period.id === "festival-night-2026-10-06",
)!;

describe("festival shuttle display", () => {
  it("shows the announcement and countdown only on the applicable date", () => {
    const view = render(
      <ShuttleAdditionalServicesCard period={festival} now={new Date("2026-10-05T22:15:00+09:00")} />,
    );
    expect(screen.queryByText("천보축전 셔틀 운행 안내")).not.toBeInTheDocument();
    expect(screen.queryByText(/분 후 예정 출발/)).not.toBeInTheDocument();
    view.rerender(
      <ShuttleAdditionalServicesCard period={festival} now={new Date("2026-10-06T22:15:00+09:00")} />,
    );
    expect(screen.getByText("천보축전 셔틀 운행 안내")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "천보축전 셔틀 운행 안내" })).not.toBeInTheDocument();
    expect(screen.getByText("2026년 10월 6일")).toHaveAttribute("datetime", "2026-10-06");
    expect(screen.getByText("주간 셔틀")).toBeInTheDocument();
    expect(screen.getByText("10:00 이전: 10분 간격")).toBeInTheDocument();
    expect(screen.getByText("10:00 이후: 30분 간격")).toBeInTheDocument();
    expect(screen.getByText("주간의 정확한 출발 시각과 막차 시각은 공지에 명시되어 있지 않습니다.")).toBeInTheDocument();
    expect(screen.getByText("야간 귀가 버스")).toBeInTheDocument();
    expect(screen.getByText(/22:00~22:30 · 총 5대/)).toBeInTheDocument();
    expect(screen.getByText(/만차 시 즉시 출발/)).toBeInTheDocument();
    expect(screen.getByText(/22:30 예정 출발 · 1대/)).toBeInTheDocument();
    expect(screen.getByText("출처: 천보축전 셔틀버스 운행 안내")).toBeInTheDocument();
    expect(screen.queryByText(/70주년기념관|조기에 종료|학생회/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "공지 원문 보기 ↗" })).not.toBeInTheDocument();
    expect(screen.getByText("15분 후 예정 출발 (예정 시각 기준)")).toBeInTheDocument();
    expect(screen.queryByText(/운행 중|5대 남/)).not.toBeInTheDocument();
    view.rerender(<ShuttleAdditionalServicesCard period={festival} now={new Date("2026-10-07T00:00:00+09:00")} />);
    expect(screen.queryByText("천보축전 셔틀 운행 안내")).not.toBeInTheDocument();
  });

  it("keeps the home notice for the entire applicable day", () => {
    const props = { isLoading: false, isError: false, onRetry: () => {}, buses, specialPeriods,
      holidays: { schemaVersion: 1 as const, sourceUrl: PUBLIC_HOLIDAY_SOURCE_URL,
        years: [2026], holidays: [], lastSuccessAt: "2026-10-06T00:00:00+09:00" } };
    const view = render(
      <TodayShuttleSection {...props} now={new Date("2026-10-06T22:15:00+09:00")} />,
    );
    expect(screen.getByText("천보축전 셔틀 운행 안내")).toBeInTheDocument();
    expect(screen.queryByText(/오늘 남은 셔틀 운행이 없습니다/)).not.toBeInTheDocument();
    view.rerender(
      <TodayShuttleSection {...props} now={new Date("2026-10-06T22:31:00+09:00")} />,
    );
    expect(screen.getByText("천보축전 셔틀 운행 안내")).toBeInTheDocument();
    expect(screen.queryByText(/오늘 남은 셔틀 운행이 없습니다/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "다음 셔틀" })).not.toBeInTheDocument();
    view.rerender(
      <TodayShuttleSection {...props} now={new Date("2026-10-07T00:00:00+09:00")} />,
    );
    expect(screen.queryByText("천보축전 셔틀 운행 안내")).not.toBeInTheDocument();
  });

  it.each([
    { locale: "ko" as const, name: "천보축전 셔틀 운행 안내", href: "/campus/bus-info" },
    { locale: "en" as const, name: "Cheonbo Festival shuttle service notice", href: "/en/campus/bus-info" },
  ])("links the $locale home announcement to bus information", ({ locale, name, href }) => {
    render(
      <LocaleProvider locale={locale}>
        <TodayShuttleSection isLoading={false} isError={false} onRetry={() => {}}
          buses={buses} specialPeriods={specialPeriods} now={new Date("2026-10-06T10:00:00+09:00")} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
  });

  it("renders the announcement and scheduled countdown in English", () => {
    render(
      <LocaleProvider locale="en">
        <ShuttleAdditionalServicesCard period={festival} now={new Date("2026-10-06T22:15:00+09:00")} />
      </LocaleProvider>,
    );
    expect(screen.getByText("Cheonbo Festival shuttle service notice")).toBeInTheDocument();
    expect(screen.getByText("October 6, 2026")).toHaveAttribute("datetime", "2026-10-06");
    expect(screen.getByText("Before 10:00: every 10 minutes")).toBeInTheDocument();
    expect(screen.getByText("After 10:00: every 30 minutes")).toBeInTheDocument();
    expect(screen.getByText("The announcement does not specify exact daytime departure times or the last departure.")).toBeInTheDocument();
    expect(screen.getByText("Campus → Hwarangdae")).toBeInTheDocument();
    expect(screen.getByText(/Scheduled to leave in 15 minutes/)).toBeInTheDocument();
    expect(screen.getByText(/Departs immediately when full/)).toBeInTheDocument();
    expect(screen.queryByText(/service may end earlier|70th Anniversary|Student Council/)).not.toBeInTheDocument();
  });

  it("keeps announcement times while withholding an unconfirmed countdown", () => {
    render(<ShuttleAdditionalServicesCard period={festival}
      now={new Date("2026-10-06T22:15:00+09:00")} showCountdown={false} />);
    expect(screen.getByText(/22:30 예정 출발 · 1대/)).toBeInTheDocument();
    expect(screen.queryByText(/분 후 예정 출발/)).not.toBeInTheDocument();
  });

  it("preserves the existing night-only announcement", () => {
    render(<ShuttleAdditionalServicesCard period={{ ...festival, daytimeIntervals: undefined }}
      now={new Date("2026-10-06T22:15:00+09:00")} />);
    expect(screen.getByText("축제 야간 특별운행")).toBeInTheDocument();
    expect(screen.getByText(/70주년기념관 좌측/)).toBeInTheDocument();
    expect(screen.getByText(/조기에 종료/)).toBeInTheDocument();
    expect(screen.queryByText("주간 셔틀")).not.toBeInTheDocument();
  });

  it("links to the source only when an announcement URL is provided", () => {
    render(<ShuttleAdditionalServicesCard period={{ ...festival, sourceUrl: "https://example.com/notice" }}
      now={new Date("2026-10-06T10:00:00+09:00")} href="/campus/bus-info" />);
    const sourceLink = screen.getByRole("link", { name: "공지 원문 보기 ↗" });
    expect(sourceLink).toHaveAttribute("href", "https://example.com/notice");
    expect(sourceLink.parentElement?.closest("a")).toBeNull();
    expect(screen.getByRole("link", { name: "천보축전 셔틀 운행 안내" }))
      .toHaveAttribute("href", "/campus/bus-info");
  });
});
