import { fireEvent, render, screen } from "@testing-library/react";
import * as Sentry from "@sentry/nextjs";
import { ErrorBoundaryHandler } from "next/dist/client/components/error-boundary";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClientLocaleProvider } from "@/app/components/LocaleContext";
import { getDictionary } from "@/lib/i18n";
import ErrorPage from "./error";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

afterEach(() => {
  vi.mocked(Sentry.captureException).mockClear();
  vi.unstubAllGlobals();
});

describe("error recovery", () => {
  it.each(["ko", "en"] as const)("refreshes a failed server payload before retrying in %s", async (locale) => {
    const dictionary = getDictionary(locale);
    const error = new Error("failed server payload");
    let failedPayload = true;
    const refresh = vi.fn(() => { failedPayload = false; });
    const router = { refresh, back: vi.fn(), forward: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), bfcacheId: "error-test" };

    function ServerPayload() {
      if (failedPayload) throw error;
      return <h1>Recovered server payload</h1>;
    }

    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ClientLocaleProvider locale={locale} dictionary={dictionary}>
        <AppRouterContext.Provider value={router}>
          <ErrorBoundaryHandler
            pathname={locale === "en" ? "/en" : "/"}
            errorComponent={({ error: caught, retry }) => <ErrorPage error={caught as Error} retry={retry} />}
          >
            <ServerPayload />
          </ErrorBoundaryHandler>
        </AppRouterContext.Provider>
      </ClientLocaleProvider>,
    );

    expect(screen.getByRole("heading", { name: dictionary.errorBoundary.pageTitle })).toBeInTheDocument();
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    fireEvent.click(screen.getByRole("button", { name: dictionary.errorBoundary.retry }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(await screen.findByRole("heading", { name: "Recovered server payload" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: dictionary.errorBoundary.retry })).not.toBeInTheDocument();
  });

  it.each(["ko", "en"] as const)("reloads a failed client chunk only after retry is clicked in %s", (locale) => {
    const dictionary = getDictionary(locale);
    const error = Object.assign(new Error("Failed to load chunk"), { name: "ChunkLoadError" });
    const retry = vi.fn();
    const reload = vi.fn();
    const view = render(
      <ClientLocaleProvider locale={locale} dictionary={dictionary}>
        <ErrorPage error={error} retry={retry} />
      </ClientLocaleProvider>,
    );
    vi.stubGlobal("window", new Proxy(window, {
      get: (target, property, receiver) => property === "location" ? { reload } : Reflect.get(target, property, receiver),
    }));

    expect(reload).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole("button", { name: dictionary.errorBoundary.retry }));
    expect(reload).toHaveBeenCalledOnce();
    expect(retry).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });
});
