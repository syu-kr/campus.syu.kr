import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ClientLocaleProvider } from "./components/LocaleContext";
import { getDictionary } from "@/lib/i18n";
import NotFound from "./not-found";

vi.mock("./components/ContactModal", () => ({
  ContactModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? <div role="dialog"><button onClick={onClose}>Close contact</button></div> : null,
}));

it.each(["ko", "en"] as const)("keeps meaningful %s recovery actions after simplifying the error surface", (locale) => {
  const dictionary = getDictionary(locale);
  render(<ClientLocaleProvider locale={locale} dictionary={dictionary}><NotFound /></ClientLocaleProvider>);

  expect(screen.getByRole("heading", { level: 1, name: dictionary.notFound.title })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: dictionary.notFound.homeAction }))
    .toHaveAttribute("href", locale === "en" ? "/en" : "/");
  expect(screen.getByText(dictionary.notFound.description)).toBeInTheDocument();
  dictionary.notFound.helpItems.forEach((item) => expect(screen.getByText(item)).toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: dictionary.notFound.contactAction }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close contact" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
