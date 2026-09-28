import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useDebouncedValue } from "./use-debounced-value";

afterEach(() => vi.useRealTimers());

it("publishes only the final value after rapid input", () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(
    ({ value }) => useDebouncedValue(value),
    { initialProps: { value: "" } },
  );

  rerender({ value: "장" });
  act(() => vi.advanceTimersByTime(100));
  rerender({ value: "장학" });
  act(() => vi.advanceTimersByTime(100));
  rerender({ value: "장학금" });
  act(() => vi.advanceTimersByTime(249));
  expect(result.current).toBe("");
  act(() => vi.advanceTimersByTime(1));
  expect(result.current).toBe("장학금");
});
