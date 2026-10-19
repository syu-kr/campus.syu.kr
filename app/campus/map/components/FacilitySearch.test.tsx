import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { buildings } from "../lib/mapData";
import { FacilitySearch } from "./FacilitySearch";

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
