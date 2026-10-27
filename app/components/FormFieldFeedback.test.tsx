import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContactForm } from "./ContactForm";
import { CampusTipSuggestionForm } from "@/app/features/campus-tips/CampusTipSuggestionForm";
import { getDictionary } from "@/lib/i18n";
import { LocaleProvider } from "./LocaleProvider";

afterEach(() => { vi.unstubAllGlobals(); });

describe.each(["contact", "campus-tip"])("%s field recovery", (kind) => {
  function renderForm() {
    return render(kind === "contact" ? <ContactForm defaultPageUrl="https://campus.syu.kr/campus" /> : <CampusTipSuggestionForm />);
  }
  const titleId = kind === "contact" ? "inquiry-title" : "tip-title";
  const messageId = kind === "contact" ? "inquiry-message" : "tip-description";
  const dictionary = getDictionary("ko");
  const text = kind === "contact" ? dictionary.pages.contactForm : dictionary.pages.campusTipsSuggest;

  it("keeps client errors next to the fields with counters and no request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { container } = renderForm();
    fireEvent.submit(container.querySelector("form")!);
    const title = container.querySelector<HTMLInputElement>(`#${titleId}`)!;
    await waitFor(() => expect(title).toHaveFocus());
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(title.getAttribute("aria-describedby")).toContain(`${titleId}-count`);
    expect(title.getAttribute("aria-describedby")).toContain(`${titleId}-error`);
    expect(screen.getByRole("alert")).toHaveTextContent(text.validationMessage);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("preserves the real payload and focuses a rejected field without losing the draft", async () => {
    const fetchMock = vi.fn(async () => Response.json({ field: "title", code: "TITLE_REQUIRED" }, { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = renderForm();
    const title = container.querySelector<HTMLInputElement>(`#${titleId}`)!;
    fireEvent.change(title, { target: { value: "입력한 제목" } });
    fireEvent.change(container.querySelector(`#${messageId}`)!, { target: { value: "입력한 제안 내용" } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(title).toHaveAttribute("aria-invalid", "true"));
    await waitFor(() => expect(title).toHaveFocus());
    expect(title).toHaveValue("입력한 제목");
    expect(container.querySelector(`#${messageId}`)).toHaveValue("입력한 제안 내용");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(kind === "contact" ? "/api/contact" : "/api/campus-tips/suggestions");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual(kind === "contact" ? {
      type: "suggestion", title: "입력한 제목", message: "입력한 제안 내용", pageUrl: "https://campus.syu.kr/campus", contact: "", website: "",
    } : {
      title: "입력한 제목", category: "campus-life", description: "입력한 제안 내용", url: "", tags: "", note: "", contact: "", website: "",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe.each(["ko", "en"] as const)("contact server failures in %s", (locale) => {
  it.each([
    { code: "SERVICE_SETUP_MISSING", error: "Internal service configuration is unavailable", status: 503 },
    { code: "RATE_LIMITED", error: "요청이 많습니다. 17초 후 다시 시도해주세요.", status: 429 },
  ])("keeps the draft and exposes only the appropriate $code message", async (failure) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(failure, { status: failure.status })));
    const { container } = render(<LocaleProvider locale={locale}>
      <ContactForm defaultPageUrl="https://campus.syu.kr/campus" />
    </LocaleProvider>);
    const text = getDictionary(locale).pages.contactForm;
    fireEvent.change(container.querySelector("#inquiry-title")!, { target: { value: "문의 제목" } });
    fireEvent.change(container.querySelector("#inquiry-message")!, { target: { value: "입력한 문의 내용" } });
    fireEvent.submit(container.querySelector("form")!);
    const dialog = await screen.findByRole("dialog", { name: text.submitFailed });
    expect(dialog).toHaveTextContent(failure.code === "RATE_LIMITED" ? text.rateLimited : text.submitRetry);
    expect(dialog).not.toHaveTextContent("Internal service configuration");
    expect(container.querySelector("#inquiry-title")).toHaveValue("문의 제목");
    expect(container.querySelector("#inquiry-message")).toHaveValue("입력한 문의 내용");
  });
});

it.each([
  { code: "SERVICE_SETUP_MISSING", error: "Internal service configuration is unavailable", status: 503 },
  { code: "RATE_LIMITED", error: "요청이 많습니다. 17초 후 다시 시도해주세요.", status: 429 },
])("keeps the tip draft and only the appropriate $code failure message", async (failure) => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(failure, { status: failure.status })));
  const { container } = render(<CampusTipSuggestionForm />);
  const text = getDictionary("ko").pages.campusTipsSuggest;
  fireEvent.change(container.querySelector("#tip-title")!, { target: { value: "제안 제목" } });
  fireEvent.change(container.querySelector("#tip-description")!, { target: { value: "입력한 제안 내용" } });
  fireEvent.submit(container.querySelector("form")!);
  const dialog = await screen.findByRole("dialog", { name: text.submitFailed });
  expect(dialog).toHaveTextContent(failure.code === "RATE_LIMITED" ? text.rateLimited : text.submitRetry);
  expect(dialog).not.toHaveTextContent("Internal service configuration");
  expect(container.querySelector("#tip-title")).toHaveValue("제안 제목");
  expect(container.querySelector("#tip-description")).toHaveValue("입력한 제안 내용");
});
