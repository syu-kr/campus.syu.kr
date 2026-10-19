import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { getDictionary } from "@/lib/i18n";
import BusInfoPageClient from "./BusInfoPageClient";

vi.mock("./ShuttleSection", () => ({ default: () => <p>Shuttle content</p> }));
vi.mock("./PublicTransitSection", () => ({ default: () => <p>Transit content</p> }));

it("announces the selected bus category and updates it with the visible panel", () => {
  render(<BusInfoPageClient initialData={{
    buses: [],
    specialPeriods: { specialPeriods: [], semesterPeriods: [], vacationPeriods: [] },
    holidays: { schemaVersion: 1, sourceUrl: "", lastSuccessAt: null, years: [], holidays: [] },
    nowISO: "2026-10-18T00:00:00+09:00",
  }} />);
  const text = getDictionary("ko").pages.busInfo;
  const shuttle = screen.getByRole("button", { name: text.shuttleTab });
  const transit = screen.getByRole("button", { name: text.publicTransitTab });
  expect(shuttle).toHaveAttribute("aria-pressed", "true");
  expect(transit).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByText("Shuttle content")).toBeInTheDocument();

  fireEvent.click(transit);
  expect(shuttle).toHaveAttribute("aria-pressed", "false");
  expect(transit).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("Transit content")).toBeInTheDocument();
  expect(screen.queryByText("Shuttle content")).not.toBeInTheDocument();

  fireEvent.click(shuttle);
  expect(shuttle).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("Shuttle content")).toBeInTheDocument();
});
