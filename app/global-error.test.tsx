import { fireEvent, render } from "@testing-library/react";
import * as Sentry from "@sentry/nextjs";
import { afterEach, expect, it, vi } from "vitest";

import { koDictionary } from "@/lib/i18n/ko";
import GlobalError from "./global-error";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

afterEach(() => {
  vi.mocked(Sentry.captureException).mockClear();
  vi.unstubAllGlobals();
});

it.each(["Error", "ChunkLoadError"])("keeps global reporting and recovers %s on request", (name) => {
  const error = Object.assign(new Error("root layout failed"), { name });
  const retry = vi.fn();
  const reload = vi.fn();
  const view = render(<GlobalError error={error} retry={retry} />, { container: document });
  vi.stubGlobal("window", new Proxy(window, {
    get: (target, property, receiver) => property === "location" ? { reload } : Reflect.get(target, property, receiver),
  }));

  expect(Sentry.captureException).toHaveBeenCalledWith(error);
  expect(document.documentElement).toHaveAttribute("lang", "ko");
  expect(reload).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: koDictionary.errorBoundary.retry }));
  expect(retry).toHaveBeenCalledTimes(name === "ChunkLoadError" ? 0 : 1);
  expect(reload).toHaveBeenCalledTimes(name === "ChunkLoadError" ? 1 : 0);
});
