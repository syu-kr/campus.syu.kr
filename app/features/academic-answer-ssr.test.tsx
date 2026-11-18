import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { act, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { ClientLocaleProvider } from "@/app/components/LocaleContext";
import { getDictionary } from "@/lib/i18n";
import { bundledGraduationReference } from "@/lib/graduation";
import type { PhoneNumber } from "@/types";
import GraduationPage from "@/app/academic/graduation/page";
import { PhonePage } from "./phone/PhonePage";
import { PHONE_DIRECTORY_SOURCE_URL } from "@/lib/academic-aeo";
import { fetchPhoneNumbers } from "@/lib/api";

const request = vi.hoisted(() => ({ locale: "ko", phones: [] as PhoneNumber[] }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-syu-locale": request.locale, "x-csp-nonce": "test-nonce" }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/campus/phone", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/server/home-data", () => ({ getHomePhoneNumbers: async () => request.phones }));
vi.mock("@/lib/server/graduation-data", async importOriginal => ({ ...await importOriginal<object>(), readGraduationReference: async () => bundledGraduationReference }));
vi.mock("@/lib/api", async importOriginal => ({ ...await importOriginal<object>(), fetchPhoneNumbers: vi.fn() }));

function renderPage(page: React.ReactNode, locale: "ko" | "en") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(<ClientLocaleProvider locale={locale} dictionary={getDictionary(locale)}><QueryClientProvider client={client}>{page}</QueryClientProvider></ClientLocaleProvider>);
  client.clear();
  return new DOMParser().parseFromString(html, "text/html");
}

it.each(["ko", "en"] as const)("serves the graduation schema's exact question and answer inside the existing disclosure without JavaScript in %s", async locale => {
  request.locale = locale;
  const document = renderPage(await GraduationPage(), locale);
  const script = document.querySelector("#graduation-answer-schema")!;
  const question = JSON.parse(script.textContent!).mainEntity[0];
  expect(script.getAttribute("nonce")).toBe("test-nonce");
  const disclosure = document.querySelector(".m3-graduation-source-notice")!;
  expect(disclosure.querySelector("summary")?.textContent).toBe(question.name);
  expect(disclosure.querySelector("p")?.textContent).toBe(question.acceptedAnswer.text);
  expect(question.acceptedAnswer.text).toContain(bundledGraduationReference.requirements.metadata.lastVerifiedAt);
  expect(document.querySelectorAll("h1")).toHaveLength(1);
});

it.each(["ko", "en"] as const)("serves the phone schema's exact answer and citation without a visible source credit for populated, unmatched and empty directories in %s", async locale => {
  request.locale = locale;
  for (const phones of [
    [{ department: "교무처 학사지원팀", phone: "02-3399-3153", description: "졸업·학적·수업·증명서" }],
    [{ department: "도서관", phone: "02-3399-3055", description: "도서 대출" }],
    [],
  ]) {
    request.phones = phones;
    const document = renderPage(await PhonePage(), locale);
    const script = document.querySelector("#campus-phone-answer-schema")!;
    expect(script.getAttribute("nonce")).toBe("test-nonce");
    const schema = JSON.parse(script.textContent!);
    expect(schema).toMatchObject({ url: `https://campus.syu.kr${locale === "en" ? "/en" : ""}/campus/phone`, inLanguage: getDictionary(locale).meta.inLanguage });
    const question = schema.mainEntity[0];
    const section = document.querySelector('section[aria-labelledby="phone-contact-question"]')!;
    expect(section.querySelector("h2")?.textContent).toBe(question.name);
    expect(section.querySelector("p")?.textContent).toBe(question.acceptedAnswer.text);
    expect(section.querySelector("a")).toBeNull();
    expect(question.acceptedAnswer.citation).toEqual([PHONE_DIRECTORY_SOURCE_URL]);
    expect(document.querySelectorAll("h1")).toHaveLength(1);
  }
});

it("hydrates the phone page and updates its schema and visible answer together after a query refetch", async () => {
  request.locale = "ko";
  request.phones = [{ department: "교무처 학사지원팀", phone: "02-3399-3153", description: "졸업·학적·수업·증명서" }];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const page = await PhonePage();
  const ui = <ClientLocaleProvider locale="ko" dictionary={getDictionary("ko")}><QueryClientProvider client={client}>{page}</QueryClientProvider></ClientLocaleProvider>;
  const container = document.createElement("div");
  container.innerHTML = renderToString(ui);
  document.body.append(container);
  const onRecoverableError = vi.fn();
  const view = render(ui, { container, hydrate: true, onRecoverableError });
  const answer = () => container.querySelector('section[aria-labelledby="phone-contact-question"] p')!.textContent;
  const script = () => container.querySelector<HTMLScriptElement>("#campus-phone-answer-schema")!;
  const schemaAnswer = () => JSON.parse(script().textContent!).mainEntity[0].acceptedAnswer.text;
  expect(answer()).toContain("02-3399-3153");
  expect(schemaAnswer()).toBe(answer());

  vi.mocked(fetchPhoneNumbers).mockResolvedValue([{ ...request.phones[0], phone: "02-3399-3154" }]);
  await act(async () => { await client.invalidateQueries({ queryKey: ["phone-numbers"] }); });
  await waitFor(() => expect(answer()).toContain("02-3399-3154"));
  expect(schemaAnswer()).toBe(answer());
  expect(schemaAnswer()).not.toContain("02-3399-3153");
  expect(script().nonce).toBe("test-nonce");
  expect(onRecoverableError).not.toHaveBeenCalled();
  view.unmount();
  client.clear();
});
