import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getDictionary, type Locale } from "@/lib/i18n";
import { LocaleProvider } from "@/app/components/LocaleProvider";
import MorePage from "./page";

const request = vi.hoisted(() => ({ locale: "ko" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-syu-locale": request.locale }) }));
afterEach(() => localStorage.clear());

it.each(["ko", "en"] as Locale[])("opens installation help from More after hiding the home card (%s)", async (locale) => {
  request.locale = locale;
  localStorage.setItem("syu-campus:pwa-install-dismissed", "true");
  render(<LocaleProvider locale={locale}>{await MorePage()}</LocaleProvider>);
  const text = getDictionary(locale).home;
  fireEvent.click(screen.getByRole("button", { name: text.pwaHelpAction }));
  expect(await screen.findByRole("dialog", { name: text.pwaAction })).toHaveTextContent(text.pwaInstallHelp);
  expect(screen.getByRole("button", { name: text.pwaCopyAddress })).toBeInTheDocument();
});
