import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContactForm } from "./ContactForm";
import { CampusTipSuggestionForm } from "@/app/features/campus-tips/CampusTipSuggestionForm";
import { LocaleProvider } from "./LocaleProvider";
import { getDictionary } from "@/lib/i18n";

afterEach(() => vi.unstubAllGlobals());

describe.each(["ko", "en"] as const)("Submission recovery in %s", (locale) => {
  describe.each(["contact", "tip"])("%s", (kind) => {
    function fill() {
      const dictionary = getDictionary(locale);
      const text = kind === "contact" ? dictionary.pages.contactForm : dictionary.pages.campusTipsSuggest;
      const { container } = render(<LocaleProvider locale={locale}>
        {kind === "contact" ? <ContactForm defaultPageUrl="https://campus.syu.kr/" /> : <CampusTipSuggestionForm />}
      </LocaleProvider>);
      const title = container.querySelector<HTMLInputElement>(kind === "contact" ? "#inquiry-title" : "#tip-title")!;
      const body = container.querySelector<HTMLTextAreaElement>(kind === "contact" ? "#inquiry-message" : "#tip-description")!;
      fireEvent.change(title, { target: { value: "My title" } });
      fireEvent.change(body, { target: { value: "My content" } });
      fireEvent.submit(container.querySelector("form")!);
      return { text, dictionary, title, body };
    }

    it.each(["network", "html", "null", "empty"])("keeps the draft and avoids false success for %s", async (failure) => {
      const fetchMock = vi.fn(async () => {
        if (failure === "network") throw new TypeError("Failed to fetch internal-provider");
        if (failure === "html") return new Response("<html>upstream failure</html>");
        return Response.json(failure === "null" ? null : {});
      });
      vi.stubGlobal("fetch", fetchMock);
      const { text, dictionary, title, body } = fill();
      const dialog = await screen.findByRole("dialog", { name: text.submitUnconfirmedTitle });
      expect(dialog).toHaveTextContent(text.submitUnconfirmed);
      expect(dialog).not.toHaveTextContent(/Failed to fetch|SyntaxError|JSON|internal-provider|upstream failure/);
      fireEvent.click(within(dialog).getByRole("button", { name: dictionary.submissionResult.confirm }));
      expect(title).toHaveValue("My title");
      expect(body).toHaveValue("My content");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("still clears the draft only after a confirmed successful submission", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => Response.json({ success: true })));
      const { text, title, body } = fill();
      expect(await screen.findByRole("dialog", { name: text.successTitle })).toHaveTextContent("My title");
      expect(title).toHaveValue("");
      expect(body).toHaveValue("");
    });
  });
});
