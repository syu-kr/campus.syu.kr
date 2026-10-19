import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { StrictMode, useLayoutEffect, useRef, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { SearchBar } from "./SearchBar";

const text = getDictionary("ko").search;

it.each(["", "Library"])("adopts typing before hydration with the server default '%s'", async (defaultValue) => {
  const onSearch = vi.fn();
  const element = <SearchBar defaultValue={defaultValue} onSearch={onSearch} />;
  const container = document.createElement("div");
  container.innerHTML = renderToString(element);
  document.body.append(container);
  const input = within(container).getByRole("textbox");
  (input as HTMLInputElement).value = "Early 도서관 Library";
  input.focus();
  let root: ReturnType<typeof hydrateRoot> | undefined;

  try {
    await act(async () => { root = hydrateRoot(container, element); });

    expect(within(container).getByRole("textbox")).toBe(input);
    expect(input).toHaveValue("Early 도서관 Library");
    expect(input).toHaveFocus();
    const submit = within(container).getByRole("button", { name: text.submit });
    expect(submit).toBeEnabled();
    expect(onSearch).not.toHaveBeenCalled();
    fireEvent.click(submit);
    expect(onSearch).toHaveBeenCalledExactlyOnceWith("Early 도서관 Library");
    fireEvent.click(within(container).getByRole("button", { name: text.clear }));
    expect(input).toHaveValue("");
    expect(submit).toBeDisabled();
  } finally {
    await act(async () => { root?.unmount(); });
    container.remove();
  }
});

it.each([false, true])("preserves the first input before effects flush with searchOnChange=%s", async (searchOnChange) => {
  const onSearch = vi.fn();
  function EarlyInput() {
    const container = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
      const input = container.current!.querySelector("input")!;
      input.focus();
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setValue.call(input, "도서관 Library");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, []);
    return <div ref={container}><SearchBar onSearch={onSearch} searchOnChange={searchOnChange} /></div>;
  }

  await act(async () => { render(<EarlyInput />); });

  const input = screen.getByRole("textbox");
  expect(input).toHaveValue("도서관 Library");
  expect(input).toHaveFocus();
  expect(screen.getByRole("button", { name: text.clear })).toBeInTheDocument();
  expect(onSearch).toHaveBeenCalledTimes(searchOnChange ? 1 : 0);
  if (searchOnChange) {
    expect(onSearch).toHaveBeenCalledExactlyOnceWith("도서관 Library");
    return;
  }
  fireEvent.click(screen.getByRole("button", { name: text.submit }));
  expect(onSearch).toHaveBeenCalledExactlyOnceWith("도서관 Library");
});

it.each([false, true])("synchronizes only changed pre-hydration typing with the parent in StrictMode: %s", async (changed) => {
  const onSearch = vi.fn();
  function Search() {
    const [query, setQuery] = useState("Library");
    return <>
      <SearchBar defaultValue={query} searchOnChange onSearch={(value) => { onSearch(value); setQuery(value); }} />
      <output>{query}</output>
    </>;
  }
  const element = <StrictMode><Search /></StrictMode>;
  const container = document.createElement("div");
  container.innerHTML = renderToString(element);
  document.body.append(container);
  const input = within(container).getByRole("textbox") as HTMLInputElement;
  if (changed) input.value = "Early 도서관 Library";
  let root: ReturnType<typeof hydrateRoot> | undefined;

  try {
    await act(async () => { root = hydrateRoot(container, element); });

    const expected = changed ? "Early 도서관 Library" : "Library";
    expect(input).toHaveValue(expected);
    expect(within(container).getByRole("status")).toHaveTextContent(expected);
    expect(onSearch).toHaveBeenCalledTimes(changed ? 1 : 0);
    if (changed) expect(onSearch).toHaveBeenCalledWith(expected);
  } finally {
    await act(async () => { root?.unmount(); });
    container.remove();
  }
});

it("synchronizes changed URL defaults without resetting input on unrelated rerenders", () => {
  const onSearch = vi.fn();
  const view = render(<SearchBar defaultValue="Library" onSearch={onSearch} />);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "도서관 수정" } });
  view.rerender(<SearchBar defaultValue="Library" onSearch={onSearch} className="mt-2" />);
  expect(input).toHaveValue("도서관 수정");

  view.rerender(<SearchBar defaultValue="버스" onSearch={onSearch} />);
  expect(input).toHaveValue("버스");
  view.rerender(<SearchBar defaultValue="" onSearch={onSearch} />);
  expect(input).toHaveValue("");
  expect(screen.getByRole("button", { name: text.submit })).toBeDisabled();
  expect(onSearch).not.toHaveBeenCalled();
});

it("keeps search and clear as separate actions and disables an empty submission", () => {
  const onSearch = vi.fn();
  const onClear = vi.fn();
  render(<SearchBar onSearch={onSearch} onClear={onClear} />);
  const input = screen.getByRole("textbox");
  const submit = screen.getByRole("button", { name: text.submit });
  expect(submit).toBeDisabled();

  fireEvent.change(input, { target: { value: "도서관" } });
  fireEvent.click(submit);
  expect(onSearch).toHaveBeenCalledExactlyOnceWith("도서관");

  fireEvent.click(screen.getByRole("button", { name: text.clear }));
  expect(input).toHaveValue("");
  expect(onClear).toHaveBeenCalledOnce();
  expect(onSearch).toHaveBeenCalledOnce();
  expect(submit).toBeDisabled();
});

it("keeps loading controls from submitting or clearing an in-flight search", () => {
  const onSearch = vi.fn();
  render(<SearchBar defaultValue="도서관" onSearch={onSearch} isLoading />);
  const submit = screen.getByRole("button", { name: text.submit });
  expect(submit).toBeDisabled();
  expect(screen.queryByRole("button", { name: text.clear })).not.toBeInTheDocument();
  fireEvent.click(submit);
  expect(onSearch).not.toHaveBeenCalled();
});
