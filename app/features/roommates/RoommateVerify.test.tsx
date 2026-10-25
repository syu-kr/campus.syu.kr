import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/app/components/LocaleProvider";
import { getDictionary, type Locale } from "@/lib/i18n";
import { getRoommateText } from "@/lib/i18n/roommates";
import { clearPendingEmail, readPendingEmail, savePendingEmail } from "./client";
import RoommateVerify from "./RoommateVerify";

afterEach(() => { clearPendingEmail(); vi.unstubAllGlobals(); });

it.each(["ko", "en"] as const)("keeps %s verification cancellation below the form and clears only the pending email", (locale: Locale) => {
  const text = getRoommateText(locale);
  const dictionary = getDictionary(locale);
  const request = vi.fn();
  vi.stubGlobal("fetch", request);
  savePendingEmail({ email: "sample@syuin.ac.kr", remember: true, next: "/campus/roommates" });
  const { container } = render(<LocaleProvider locale={locale}><RoommateVerify /></LocaleProvider>);
  expect(container.firstElementChild?.firstElementChild).toBe(screen.getByRole("heading", { name: text.verifyTitle }));
  const cancel = screen.getByRole("link", { name: text.cancel });
  expect(cancel).toHaveAttribute("href", locale === "en" ? "/en/campus" : "/campus");
  expect(cancel.parentElement).toContainElement(screen.getByRole("link", { name: dictionary.footer.privacy }));
  expect(container.querySelector("form")!.compareDocumentPosition(cancel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(readPendingEmail()).not.toBeNull();
  cancel.addEventListener("click", (event) => event.preventDefault());
  fireEvent.click(cancel);
  expect(readPendingEmail()).toBeNull();
  expect(request).not.toHaveBeenCalled();
});
