import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import Page from "./page";
import { loadShuttleServiceData } from "./service-data.server";
import { testServiceData } from "./service-test-data";

vi.mock("./service-data.server", () => ({ loadShuttleServiceData: vi.fn() }));
vi.mock("../BusInfoPageClient", () => ({ default: ({ shuttleContent }: { shuttleContent: ReactNode }) => <>{shuttleContent}</> }));
vi.mock("./ShuttleServicePreview", () => ({ default: ({ surface, operatingPreview }: { surface: string; operatingPreview: boolean }) =>
  <p data-testid="shuttle-surface" data-surface={surface} data-example={String(operatingPreview)} /> }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadShuttleServiceData).mockResolvedValue(testServiceData);
});

it("rehearses the public surface without allowing the archived example", async () => {
  render(await Page({ searchParams: Promise.resolve({ view: "production", scenario: "operating" }) }));
  expect(loadShuttleServiceData).toHaveBeenCalledWith(false);
  expect(screen.getByTestId("shuttle-surface")).toHaveAttribute("data-surface", "production");
  expect(screen.getByTestId("shuttle-surface")).toHaveAttribute("data-example", "false");
});

it("retains the explicit example on the preview surface", async () => {
  render(await Page({ searchParams: Promise.resolve({ scenario: "operating" }) }));
  expect(loadShuttleServiceData).toHaveBeenCalledWith(true);
  expect(screen.getByTestId("shuttle-surface")).toHaveAttribute("data-surface", "preview");
  expect(screen.getByTestId("shuttle-surface")).toHaveAttribute("data-example", "true");
});
