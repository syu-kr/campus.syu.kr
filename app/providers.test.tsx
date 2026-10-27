import { act, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Providers } from "./providers";
import { renderToString } from "react-dom/server";
import { ServiceSearchLinks } from "./components/ServiceSearchLinks";
import { enablePushNotifications } from "@/lib/push-notifications";

vi.mock("./components/NotificationModal", () => ({ NotificationModal: () => null }));
vi.mock("@/lib/push-notifications", () => ({ FCM_TOKEN_KEY: "fcm_token", getNotificationPreference: () => null, enablePushNotifications: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it("does not reject the idle initialization when browser storage is denied", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("requestIdleCallback", undefined);
  vi.stubGlobal("Notification", { permission: "granted" });
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: {} });
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
  const view = render(<Providers><p>Campus content</p></Providers>);
  await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
  expect(view.getByText("Campus content")).toBeInTheDocument();
  expect(enablePushNotifications).not.toHaveBeenCalled();
});
it("renders enabled roommate search links from the server-provided flag", () => {
  expect(renderToString(<Providers roommatesEnabled><ServiceSearchLinks query="룸메이트" /></Providers>)).toContain('href="/campus/roommates"');
  expect(renderToString(<Providers roommatesEnabled={false}><ServiceSearchLinks query="룸메이트" /></Providers>)).not.toContain('href="/campus/roommates"');
});
