import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import Page from "./page";
import { loadShuttleServiceData } from "@/lib/server/shuttle-service-data";
import { testServiceData } from "./preview/service-test-data";

vi.mock("@/lib/server/shuttle-service-data", () => ({ loadShuttleServiceData: vi.fn() }));
vi.mock("./BusInfoPageClient", () => ({ default: ({ shuttleContent }: { shuttleContent: ReactNode }) => <>{shuttleContent}</> }));
vi.mock("./preview/ShuttleServicePreview", () => ({ default: ({ surface, operatingPreview, data }: {
  surface: string; operatingPreview?: boolean; data: typeof testServiceData;
}) => <p data-testid="shuttle-surface" data-surface={surface} data-example={String(!!operatingPreview)}>{data.version}</p> }));

it("uses current service data and the public API surface at the main bus entry", async () => {
  vi.mocked(loadShuttleServiceData).mockResolvedValue(testServiceData);
  render(await Page());
  expect(loadShuttleServiceData).toHaveBeenCalledWith();
  expect(screen.getByTestId("shuttle-surface")).toHaveAttribute("data-surface", "production");
  expect(screen.getByTestId("shuttle-surface")).toHaveAttribute("data-example", "false");
  expect(screen.getByTestId("shuttle-surface")).toHaveTextContent(testServiceData.version);
});
