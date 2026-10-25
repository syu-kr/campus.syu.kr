import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { getDictionary } from "@/lib/i18n";
import BusInfoPageClient from "./BusInfoPageClient";

vi.mock("./ShuttleSection", () => ({ default: () => <p>Shuttle content</p> }));
vi.mock("./PublicTransitSection", () => ({ default: () => <p>Transit content</p> }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/campus/bus-info",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
beforeEach(() => { window.history.replaceState(null, "", "/campus/bus-info?lang=en"); });

function busPage() {
  return <BusInfoPageClient initialData={{
    buses: [],
    specialPeriods: { specialPeriods: [], semesterPeriods: [], vacationPeriods: [] },
    holidays: { schemaVersion: 1, sourceUrl: "", lastSuccessAt: null, years: [], holidays: [] },
    nowISO: "2026-10-18T00:00:00+09:00",
  }} />;
}

it("announces the selected bus category and updates it with the visible panel", () => {
  const { rerender } = render(busPage());
  const text = getDictionary("ko").pages.busInfo;
  const shuttle = screen.getByRole("button", { name: text.shuttleTab });
  const transit = screen.getByRole("button", { name: text.publicTransitTab });
  expect(shuttle).toHaveAttribute("aria-pressed", "true");
  expect(transit).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByText("Shuttle content")).toBeInTheDocument();

  fireEvent.click(transit);
  rerender(busPage());
  expect(window.location.search).toContain("tab=public-transit");
  expect(window.location.search).toContain("lang=en");
  expect(shuttle).toHaveAttribute("aria-pressed", "false");
  expect(transit).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("Transit content")).toBeInTheDocument();
  expect(screen.queryByText("Shuttle content")).not.toBeInTheDocument();

  fireEvent.click(shuttle);
  rerender(busPage());
  expect(shuttle).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("Shuttle content")).toBeInTheDocument();
});

it("restores the bus view from a shared URL without touching the selected stop", () => {
  window.history.replaceState(null, "", "/campus/bus-info?tab=public-transit&stop=humun-down&lang=en");
  render(busPage());
  expect(screen.getByText("Transit content")).toBeInTheDocument();
  expect(window.location.search).toContain("stop=humun-down");
});
