import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { LocaleProvider } from "@/app/components/LocaleProvider";
import ServiceNoticeNotFound from "./not-found";
const query = vi.hoisted(() => ({ page: "2" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams({ listPage: query.page }) }));
it("keeps the English page-two return from a missing or unpublished notice", () => {
  query.page = "2";render(<LocaleProvider locale="en"><ServiceNoticeNotFound /></LocaleProvider>);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Notice not found");
  expect(screen.getByRole("link")).toHaveAttribute("href", "/en/service/notices?page=2");
});
it("rejects an invalid return page without creating an external redirect", () => {
  query.page = "https://example.com";render(<LocaleProvider locale="ko"><ServiceNoticeNotFound /></LocaleProvider>);
  expect(screen.getByRole("link")).toHaveAttribute("href", "/service/notices");
});
