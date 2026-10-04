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
  it("shows an advance announcement and only counts down on the applicable date", () => {
    const view = render(
      <ShuttleAdditionalServicesCard period={festival} now={new Date("2026-10-05T22:15:00+09:00")} />,
    );
    expect(screen.getByText(/22:00~22:30 · 총 5대/)).toBeInTheDocument();
    expect(screen.getByText(/22:30 예정 출발 · 1대/)).toBeInTheDocument();
    expect(screen.getByText(/70주년기념관 좌측/)).toBeInTheDocument();
    expect(screen.queryByText(/분 후 예정 출발/)).not.toBeInTheDocument();
    view.rerender(
      <ShuttleAdditionalServicesCard period={festival} now={new Date("2026-10-06T22:15:00+09:00")} />,
    );
    expect(screen.getByText("15분 후 예정 출발 (예정 시각 기준)")).toBeInTheDocument();
    expect(screen.queryByText(/운행 중|5대 남/)).not.toBeInTheDocument();
  });

  it("keeps the home card after regular service, then restores the ended state", () => {
    const props = { isLoading: false, isError: false, onRetry: () => {}, buses, specialPeriods,
      holidays: { schemaVersion: 1 as const, sourceUrl: PUBLIC_HOLIDAY_SOURCE_URL,
        years: [2026], holidays: [], lastSuccessAt: "2026-10-06T00:00:00+09:00" } };
    const view = render(
      <TodayShuttleSection {...props} now={new Date("2026-10-06T22:15:00+09:00")} />,
    );
    expect(screen.getByText("축제 야간 특별운행")).toBeInTheDocument();
    expect(screen.queryByText(/오늘 남은 셔틀 운행이 없습니다/)).not.toBeInTheDocument();
    view.rerender(
      <TodayShuttleSection {...props} now={new Date("2026-10-06T22:31:00+09:00")} />,
    );
    expect(screen.queryByText("축제 야간 특별운행")).not.toBeInTheDocument();
    expect(screen.getByText(/오늘 남은 셔틀 운행이 없습니다/)).toBeInTheDocument();
  });

  it("renders the announcement and scheduled countdown in English", () => {
    render(
      <LocaleProvider locale="en">
        <ShuttleAdditionalServicesCard period={festival} now={new Date("2026-10-06T22:15:00+09:00")} />
      </LocaleProvider>,
    );
    expect(screen.getByText("Campus → Hwarangdae")).toBeInTheDocument();
    expect(screen.getByText(/Scheduled to leave in 15 minutes/)).toBeInTheDocument();
    expect(screen.getByText(/service may end earlier/)).toBeInTheDocument();
  });

  it("keeps announcement times while withholding an unconfirmed countdown", () => {
    render(<ShuttleAdditionalServicesCard period={festival}
      now={new Date("2026-10-06T22:15:00+09:00")} showCountdown={false} />);
    expect(screen.getByText(/22:30 예정 출발 · 1대/)).toBeInTheDocument();
    expect(screen.queryByText(/분 후 예정 출발/)).not.toBeInTheDocument();
  });
});
