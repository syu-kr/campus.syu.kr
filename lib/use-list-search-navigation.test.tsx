import { act, fireEvent, render, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createPortal } from "react-dom";
import { useListSearchNavigation } from "./use-list-search-navigation";

afterEach(() => vi.useRealTimers());

it("commits only the final query after the original 250ms delay and cancels on back and unmount", () => {
  vi.useFakeTimers();
  const commit = vi.fn();
  const { result, unmount } = renderHook(() => useListSearchNavigation(commit));
  act(() => { result.current.schedule("a"); vi.advanceTimersByTime(100); result.current.schedule("ab"); vi.advanceTimersByTime(249); });
  expect(commit).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(commit).toHaveBeenCalledExactlyOnceWith("ab");
  act(() => { result.current.schedule("old"); window.dispatchEvent(new PopStateEvent("popstate")); vi.advanceTimersByTime(300); });
  expect(commit).toHaveBeenCalledTimes(1);
  act(() => result.current.schedule("unmounted"));
  unmount();
  act(() => vi.advanceTimersByTime(300));
  expect(commit).toHaveBeenCalledTimes(1);
});

it("keeps IME fragments local even during a long composition and commits the completed Korean text once", () => {
  vi.useFakeTimers();
  const commit = vi.fn();
  function Input() {
    const navigation = useListSearchNavigation(commit);
    return <form role="search" onCompositionStartCapture={navigation.onCompositionStartCapture} onCompositionEndCapture={navigation.onCompositionEndCapture}>
      <input aria-label="query" onChange={event => navigation.schedule(event.target.value)} />
    </form>;
  }
  const { getByRole } = render(<Input />);
  const input = getByRole("textbox");
  fireEvent.compositionStart(input);
  fireEvent.change(input, { target: { value: "ㅎ" } });
  act(() => vi.advanceTimersByTime(1000));
  expect(commit).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "학교" } });
  fireEvent.compositionEnd(input);
  act(() => vi.advanceTimersByTime(249));
  expect(commit).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(commit).toHaveBeenCalledExactlyOnceWith("학교");
});

it("does not search or change the URL when a portalled suggestion title finishes Korean composition", () => {
  vi.useFakeTimers();
  const commit = vi.fn();
  function Page() {
    const navigation = useListSearchNavigation(commit);
    return <div onCompositionStartCapture={navigation.onCompositionStartCapture} onCompositionEndCapture={navigation.onCompositionEndCapture}>
      <form role="search"><input aria-label="search" onChange={event => navigation.schedule(event.target.value)} /></form>
      {createPortal(<form><input aria-label="suggestion title" /></form>, document.body)}
    </div>;
  }
  const { getByRole } = render(<Page />);
  const title = getByRole("textbox", { name: "suggestion title" });
  fireEvent.compositionStart(title);
  fireEvent.change(title, { target: { value: "학교 꿀팁 제보" } });
  fireEvent.compositionEnd(title);
  act(() => vi.advanceTimersByTime(300));
  expect(commit).not.toHaveBeenCalled();
  expect(title).toHaveValue("학교 꿀팁 제보");
  const search = getByRole("textbox", { name: "search" });
  fireEvent.compositionStart(search);
  fireEvent.change(search, { target: { value: "학교" } });
  fireEvent.compositionEnd(search);
  act(() => vi.advanceTimersByTime(250));
  expect(commit).toHaveBeenCalledExactlyOnceWith("학교");
});
