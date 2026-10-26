import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { LocaleProvider } from "@/app/components/LocaleProvider";
import type { ContentTranslationSource, PublicContentFields } from "@/lib/content-translation";
import { getDictionary } from "@/lib/i18n";
import { buildings } from "../lib/mapData";
import { FacilitySearch } from "./FacilitySearch";

const translated = vi.hoisted(() => ({ active: false, requests: vi.fn() }));
vi.mock("@/app/components/ContentTranslation", () => ({
  PublicContentTranslation: ({ source, content, children }: { source: ContentTranslationSource; content: PublicContentFields; children: (value: { text: (field: string, fallback: string) => string; lang: string }) => ReactNode }) => {
    translated.requests(source, content);return children({ text: (field, fallback) => translated.active && field in content ? `English ${field}` : fallback, lang: translated.active ? "en-x-mtfrom-ko" : "ko" });
  },
}));
afterEach(() => { translated.active = false;translated.requests.mockClear(); });

it("clears results without selecting a building and still selects a subsequent result", () => {
  const onSelect = vi.fn();
  const text = getDictionary("ko").pages.map;
  render(<FacilitySearch onSelect={onSelect} />);
  const input = screen.getByRole("textbox", { name: text.searchPlaceholder });
  fireEvent.change(input, { target: { value: buildings[0].name } });
  fireEvent.click(screen.getByRole("button", { name: text.clearSearch }));
  expect(input).toHaveValue("");
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();

  fireEvent.change(input, { target: { value: buildings[0].name } });
  const result = screen.getByRole("button", { name: new RegExp(buildings[0].name) });
  fireEvent.click(result);
  expect(onSelect).toHaveBeenCalledExactlyOnceWith(buildings[0].id);
  expect(input).toHaveValue("");
});

it("shows translated result labels while searching original facility names and selecting the original building ID", () => {
  translated.active = true;const onSelect = vi.fn();
  const building = buildings.find(item => item.id === "practice-center-1")!, floor = building.floors[0], facility = floor.facilities[0];
  render(<LocaleProvider locale="en"><FacilitySearch onSelect={onSelect} /></LocaleProvider>);
  const input = screen.getByRole("textbox", { name: getDictionary("en").pages.map.searchPlaceholder });
  fireEvent.change(input, { target: { value: facility.name } });
  expect(input).toHaveValue(facility.name);
  expect(screen.getByText("Research")).toBeVisible();
  const result = screen.getByRole("button", { name: /English floors\.0\.facilities\.0\.name/ });
  expect(result).toHaveTextContent("English name");
  expect(translated.requests).toHaveBeenCalledWith({ kind: "map", id: building.id }, expect.objectContaining({ "floors.0.facilities.0.name": facility.name, name: building.name }));
  fireEvent.click(result);expect(onSelect).toHaveBeenCalledExactlyOnceWith(building.id);expect(input).toHaveValue("");
});
