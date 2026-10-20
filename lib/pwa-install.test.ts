import { afterEach, describe, expect, it, vi } from "vitest";
import { initializePwaInstallPromptCapture, takePwaInstallPrompt } from "./pwa-install";

afterEach(() => {
  initializePwaInstallPromptCapture()();
  vi.restoreAllMocks();
});

function offerInstall() {
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: "dismissed" as const }),
  });
  window.dispatchEvent(event);
  return event;
}

describe("early app installation capture", () => {
  it("registers once and makes each early browser event available only once", () => {
    const addListener = vi.spyOn(window, "addEventListener");
    const dispose = initializePwaInstallPromptCapture();
    expect(initializePwaInstallPromptCapture()).toBe(dispose);
    expect(addListener.mock.calls.map(([name]) => name)).toEqual(["beforeinstallprompt", "appinstalled"]);

    const first = offerInstall();
    expect(first.defaultPrevented).toBe(true);
    expect(takePwaInstallPrompt()).toBe(first);
    expect(takePwaInstallPrompt()).toBeNull();
    const next = offerInstall();
    expect(takePwaInstallPrompt()).toBe(next);
    expect(takePwaInstallPrompt()).toBeNull();
  });

  it("clears the pending offer on installation and can accept a later fresh event", () => {
    initializePwaInstallPromptCapture();
    offerInstall();
    window.dispatchEvent(new Event("appinstalled"));
    expect(takePwaInstallPrompt()).toBeNull();
    const next = offerInstall();
    expect(takePwaInstallPrompt()).toBe(next);
  });

  it("clears and removes both app listeners once, including after reinitialization", () => {
    const removeListener = vi.spyOn(window, "removeEventListener");
    const dispose = initializePwaInstallPromptCapture();
    offerInstall();
    dispose();
    dispose();
    expect(removeListener.mock.calls.map(([name]) => name)).toEqual(["beforeinstallprompt", "appinstalled"]);
    expect(takePwaInstallPrompt()).toBeNull();
    expect(offerInstall().defaultPrevented).toBe(false);

    const nextDispose = initializePwaInstallPromptCapture();
    dispose();
    expect(offerInstall().defaultPrevented).toBe(true);
    nextDispose();
    expect(offerInstall().defaultPrevented).toBe(false);
  });
});
