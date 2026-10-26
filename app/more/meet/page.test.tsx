import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/app/components/LocaleProvider";
import { getDictionary, localizePath, type Locale } from "@/lib/i18n";
import MeetCreatePage from "./page";

const navigation = vi.hoisted(() => ({ push: vi.fn(), historyChange: vi.fn() }));
const ANALYTICS_DISABLE_KEY = "ga-disable-G-SD8QFQWFVQ";
const analyticsWindow = window as Window & { [ANALYTICS_DISABLE_KEY]?: boolean };

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: navigation.push }) }));
vi.mock("next/link", () => ({
  default: ({ href, onNavigate, ...props }: ComponentProps<"a"> & {
    href: string;
    onNavigate?: () => void;
  }) => <a {...props} href={href} onClick={(event) => {
    event.preventDefault();
    onNavigate?.();
    navigation.historyChange(href, Reflect.get(window, "ga-disable-G-SD8QFQWFVQ"));
  }} />,
}));

beforeEach(() => {
  delete analyticsWindow[ANALYTICS_DISABLE_KEY];
  navigation.push.mockReset().mockImplementation((href: string) => {
    navigation.historyChange(href, analyticsWindow[ANALYTICS_DISABLE_KEY]);
  });
  navigation.historyChange.mockReset();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete analyticsWindow[ANALYTICS_DISABLE_KEY];
  vi.unstubAllGlobals();
});

describe.each(["ko", "en"] as const)("Meet creation failure copy (%s)", (locale) => {
  it.each(["network", "json", "null"])("keeps entries and hides technical %s failures", async (failure) => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      if (failure === "network") throw new TypeError("Failed to fetch private backend");
      return failure === "json" ? new Response("upstream failure") : Response.json(null);
    }));
    const text = show(locale);
    fireEvent.click(screen.getByRole("button", { name: text.createMode }));
    fireEvent.change(screen.getByLabelText(text.titleLabel), { target: { value: "모임" } });
    fireEvent.click(screen.getByRole("button", { name: text.createInvite }));
    expect(await screen.findByRole("alert")).toHaveTextContent(text.createFailed);
    expect(screen.getByLabelText(text.titleLabel)).toHaveValue("모임");
    expect(screen.queryByRole("link", { name: text.goToRoom })).not.toBeInTheDocument();
  });

  it("explains missing deletion permission while keeping the usable invite", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Blocked"); });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      roomId: "test-room", inviteUrl: "https://campus.test/more/meet/test-room", ownerToken: "test-owner",
    })));
    const text = show(locale);
    fireEvent.click(screen.getByRole("button", { name: text.createMode }));
    fireEvent.change(screen.getByLabelText(text.titleLabel), { target: { value: "모임" } });
    fireEvent.click(screen.getByRole("button", { name: text.createInvite }));
    expect(await screen.findByRole("alert")).toHaveTextContent(text.ownerStorageUnavailable);
    expect(screen.getByRole("link", { name: text.goToRoom })).toBeInTheDocument();
  });
});

function show(locale: Locale) {
  render(<LocaleProvider locale={locale}><MeetCreatePage /></LocaleProvider>);
  return getDictionary(locale).pages.meet;
}

describe.each(["ko", "en"] as const)("Meet invitation navigation privacy (%s)", (locale) => {
  it("disables analytics before joining can emit an automatic history event", () => {
    const text = show(locale);
    expect(analyticsWindow[ANALYTICS_DISABLE_KEY]).toBeUndefined();
    fireEvent.change(screen.getByLabelText(text.joinCodeLabel), {
      target: { value: "https://campus.test/more/meet/dummy-private-invite" },
    });
    fireEvent.click(screen.getByRole("button", { name: text.joinAction }));

    const destination = localizePath("/more/meet/dummy-private-invite", locale);
    expect(navigation.push).toHaveBeenCalledWith(destination);
    expect(navigation.historyChange).toHaveBeenCalledWith(destination, true);
  });

  it("disables analytics before opening the newly created invitation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      roomId: "dummy-private-invite",
      inviteUrl: "https://campus.test/more/meet/dummy-private-invite",
      ownerToken: "dummy-owner-token",
    })));
    const text = show(locale);
    fireEvent.click(screen.getByRole("button", { name: text.createMode }));
    fireEvent.change(screen.getByLabelText(text.titleLabel), { target: { value: "모임" } });
    fireEvent.click(screen.getByRole("button", { name: text.createInvite }));
    const invitation = await screen.findByRole("link", { name: text.goToRoom });
    const destination = localizePath("/more/meet/dummy-private-invite", locale);
    expect(invitation).toHaveAttribute("href", destination);
    expect(analyticsWindow[ANALYTICS_DISABLE_KEY]).toBeUndefined();

    fireEvent.click(invitation);
    expect(navigation.historyChange).toHaveBeenCalledWith(destination, true);
  });
});

it.each(["ko", "en"] as const)("keeps setup failures user-facing without changing the error-code mapping in %s", async (locale) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
    error: "요청 제한 설정이 완료되지 않았습니다.", code: "RATE_LIMIT_CONFIG_MISSING",
  }, { status: 503 })));
  const text = show(locale);
  fireEvent.click(screen.getByRole("button", { name: text.createMode }));
  fireEvent.change(screen.getByLabelText(text.titleLabel), { target: { value: "모임" } });
  fireEvent.click(screen.getByRole("button", { name: text.createInvite }));
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(text.errors.rateLimitConfig);
  expect(alert).not.toHaveTextContent(/요청 제한 설정|not configured|Content-Type|JSON/);
  expect(screen.getByLabelText(text.titleLabel)).toHaveValue("모임");
});
