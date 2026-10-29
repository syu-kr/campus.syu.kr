import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MANAGED_POPUP_BOOTSTRAP } from "./managed-popup-bootstrap";

type PopupDialog = HTMLDialogElement & { __campusPopupCleanup?: () => void };
const key = "campus-banner:public-popup:3";
let dialog: PopupDialog;
let script: HTMLScriptElement;
let readyState: DocumentReadyState;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-27T08:30:00.000Z")); // 17:30 in Korea.
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
  document.body.innerHTML = `<button id="previous">Previous focus</button>
    <dialog class="m3-managed-popup-overlay" data-managed-popup="${key}" data-starts-at="" data-ends-at="" role="dialog" aria-modal="true">
      <section><picture><source media="(max-width: 599px)" data-srcset="/mobile.webp"><img data-src="/desktop.webp" alt="Public notice"></picture>
      <a href="/service/notices/test" data-popup-action="close">Details</a>
      <button data-popup-action="today">Hide today</button><button data-popup-action="close">Close</button></section>
    </dialog><script nonce="test-nonce"></script>`;
  dialog = document.querySelector("dialog")!;
  script = document.querySelector("script")!;
  Object.defineProperties(dialog, {
    showModal: { configurable: true, value: vi.fn(() => dialog.setAttribute("open", "")) },
    close: { configurable: true, value: vi.fn(() => dialog.removeAttribute("open")) },
  });
  readyState = "loading";
  vi.spyOn(document, "readyState", "get").mockImplementation(() => readyState);
  vi.spyOn(document, "currentScript", "get").mockImplementation(() => script);
});
afterEach(() => {
  dialog.__campusPopupCleanup?.();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  document.body.innerHTML = "";
});
function boot() {
  new Function("document", "location", "localStorage", "sessionStorage", MANAGED_POPUP_BOOTSTRAP)(document, window.location, localStorage, sessionStorage);
}
function ready() {
  readyState = "complete";
  document.dispatchEvent(new Event("DOMContentLoaded"));
}
function click(selector: string) {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  dialog.querySelector(selector)!.dispatchEvent(event);
  return event;
}
async function mutations() { await Promise.resolve(); await Promise.resolve(); }

describe("early managed popup controller", () => {
  function shellReady() {
    const marker = document.createElement("span");
    marker.hidden = true;
    marker.setAttribute("data-managed-popup-shell-ready", "");
    document.body.append(marker);
  }

  it("opens once when the completed shell arrives before DOMContentLoaded", async () => {
    boot();
    document.body.append(document.createElement("article"));
    await mutations();
    expect(dialog.open).toBe(false);
    expect(dialog.querySelector("img")).not.toHaveAttribute("src");
    shellReady();
    await mutations();
    expect(document.readyState).toBe("loading");
    expect(dialog.open).toBe(true);
    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(dialog.querySelector("img")).toHaveAttribute("src", "/desktop.webp");
    expect(dialog.querySelector("source")).toHaveAttribute("srcset", "/mobile.webp");
    expect(document.activeElement).toBe(dialog.querySelector('button[data-popup-action="close"]'));
    ready();
    expect(dialog.showModal).toHaveBeenCalledOnce();
  });

  it.each(["close", "today"])("keeps an early shell %s dismissal closed when DOMContentLoaded arrives later", async action => {
    boot(); shellReady(); await mutations();
    expect(document.readyState).toBe("loading");
    expect(dialog.open).toBe(true);
    click('button[data-popup-action="' + action + '"]');
    expect(dialog.open).toBe(false);
    if (action === "close") expect(sessionStorage.getItem(key)).toBe("closed");
    else expect(localStorage.getItem(key)).toBe(String(Date.parse("2026-10-27T15:00:00.000Z")));
    ready(); await mutations();
    expect(dialog.open).toBe(false);
    expect(dialog.showModal).toHaveBeenCalledOnce();
  });

  it("recognizes an already parsed shell without waiting for document readiness", () => {
    shellReady();
    boot();
    expect(document.readyState).toBe("loading");
    expect(dialog.open).toBe(true);
    expect(dialog.showModal).toHaveBeenCalledOnce();
    ready();
    expect(dialog.showModal).toHaveBeenCalledOnce();
  });

  it("keeps an existing parser-late modal ahead of the shell-ready popup without loading media", async () => {
    boot();
    const other = document.createElement("section");
    other.setAttribute("role", "dialog");
    other.setAttribute("aria-modal", "true");
    other.innerHTML = '<button id="editing">Continue editing</button>';
    document.body.append(other);
    const input = document.getElementById("editing")!;
    input.focus();
    shellReady();
    await mutations();
    expect(dialog.open).toBe(false);
    expect(dialog.querySelector("img")).not.toHaveAttribute("src");
    expect(dialog.querySelector("source")).not.toHaveAttribute("srcset");
    expect(input).toHaveFocus();
    other.remove();
    await mutations();
    expect(dialog.open).toBe(true);
    expect(dialog.showModal).toHaveBeenCalledOnce();
  });

  it("yields after the shell opens when a later dialog needs focus, then resumes without dismissal", async () => {
    boot(); shellReady(); await mutations();
    expect(dialog.open).toBe(true);
    const other = document.createElement("section");
    other.setAttribute("role", "dialog");
    other.setAttribute("aria-modal", "true");
    other.innerHTML = '<button id="later-editing">Continue editing</button>';
    document.body.append(other);
    const input = document.getElementById("later-editing")!;
    input.focus();
    await mutations();
    expect(dialog.open).toBe(false);
    expect(input).toHaveFocus();
    expect(dialog.dataset.dismissedUntil).toBeUndefined();
    expect(sessionStorage.getItem(key)).toBeNull();
    other.remove(); await mutations();
    expect(dialog.open).toBe(true);
    expect(dialog.showModal).toHaveBeenCalledTimes(2);
    expect(dialog.querySelector('button[data-popup-action="close"]')).toHaveFocus();
  });

  it("does not activate the shell marker or readiness listeners after cleanup", async () => {
    boot();
    dialog.__campusPopupCleanup?.();
    shellReady(); await mutations(); ready();
    expect(dialog.open).toBe(false);
    expect(dialog.showModal).not.toHaveBeenCalled();
    expect(dialog.querySelector("img")).not.toHaveAttribute("src");
  });

  it("leaves a hydration handoff in charge when the shell marker arrives later", async () => {
    boot();
    dialog.dataset.hydrated = "true";
    await mutations();
    shellReady(); await mutations(); ready();
    expect(dialog.open).toBe(false);
    expect(dialog.showModal).not.toHaveBeenCalled();
    expect(dialog.querySelector("img")).not.toHaveAttribute("src");
  });

  it("waits for document readiness, then activates responsive media and focuses close before hydration", () => {
    boot();
    expect(dialog.open).toBe(false);
    expect(dialog.querySelector("img")).not.toHaveAttribute("src");
    ready();
    expect(dialog.open).toBe(true);
    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(dialog.querySelector("source")).toHaveAttribute("srcset", "/mobile.webp");
    expect(dialog.querySelector("img")).toHaveAttribute("src", "/desktop.webp");
    expect(document.activeElement).toBe(dialog.querySelector("button[data-popup-action=close]"));
  });

  it.each(["closed", "today"])("never requests media or opens a %s dismissal", mode => {
    if (mode === "closed") sessionStorage.setItem(key, "closed");
    else localStorage.setItem(key, String(Date.now() + 60000));
    boot(); ready();
    expect(dialog.open).toBe(false);
    expect(dialog.querySelector("img")).not.toHaveAttribute("src");
    expect(dialog.querySelector("source")).not.toHaveAttribute("srcset");
  });

  it("honors the start and exclusive end boundaries, without persisting an expiry dismissal", () => {
    dialog.dataset.startsAt = String(Date.now() + 1000);
    dialog.dataset.endsAt = String(Date.now() + 3000);
    const writes = vi.spyOn(Storage.prototype, "setItem");
    boot(); ready();
    expect(dialog.open).toBe(false);
    expect(dialog.querySelector("img")).not.toHaveAttribute("src");
    vi.advanceTimersByTime(1010);
    expect(dialog.open).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(dialog.open).toBe(false);
    expect(dialog.dataset.dismissedUntil).toBeUndefined();
    expect(writes).not.toHaveBeenCalled();
  });

  it("dismisses Escape and backdrop clicks in the session", () => {
    boot(); ready();
    const event = new Event("cancel", { cancelable: true });
    dialog.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(false);
    expect(dialog.dataset.dismissedUntil).toBe("closed");
    expect(sessionStorage.getItem(key)).toBe("closed");
  });

  it("keeps panel clicks open and dismisses only the overlay background", () => {
    boot(); ready();
    click("section");
    expect(dialog.open).toBe(true);
    dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(dialog.open).toBe(false);
    expect(sessionStorage.getItem(key)).toBe("closed");
  });

  it("stores hide-today at Korean midnight and reopens only after that boundary", () => {
    boot(); ready();
    click("[data-popup-action=today]");
    const midnight = Date.parse("2026-10-27T15:00:00.000Z");
    expect(localStorage.getItem(key)).toBe(String(midnight));
    expect(dialog.dataset.dismissedUntil).toBe(String(midnight));
    expect(sessionStorage.getItem(key)).toBeNull();
    expect(dialog.open).toBe(false);
    vi.advanceTimersByTime(midnight - Date.now() - 1);
    expect(dialog.open).toBe(false);
    vi.advanceTimersByTime(11);
    expect(dialog.open).toBe(true);
    expect(dialog.dataset.dismissedUntil).toBeUndefined();
  });

  it("preserves in-memory dismissal through storage failures and blocks a duplicate React click", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    const replay = vi.fn();
    document.body.addEventListener("click", replay, { once: true });
    boot(); ready();
    expect(() => click("button[data-popup-action=close]")).not.toThrow();
    expect(replay).not.toHaveBeenCalled();
    expect(dialog.dataset.dismissedUntil).toBe("closed");
    document.dispatchEvent(new Event("visibilitychange"));
    await mutations();
    expect(dialog.showModal).toHaveBeenCalledOnce();
    document.body.removeEventListener("click", replay);
  });

  it("preserves native link navigation while closing and stopping replay", () => {
    boot(); ready();
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    const anchor = dialog.querySelector("a")!;
    // A direct captured handler call tests the default without jsdom attempting navigation.
    const add = vi.spyOn(document, "addEventListener");
    dialog.__campusPopupCleanup?.();
    boot();
    const handler = add.mock.calls.find(([type]) => type === "click")![1] as EventListener;
    Object.defineProperty(event, "target", { value: anchor });
    handler(event);
    expect(event.defaultPrevented).toBe(false);
    expect(anchor.getAttribute("href")).toBe("/service/notices/test");
    expect(dialog.open).toBe(false);
    expect(sessionStorage.getItem(key)).toBe("closed");
  });

  it("defers media and opening while another visible modal is active, then retries after it closes", async () => {
    const other = document.createElement("section");
    other.setAttribute("role", "dialog"); other.setAttribute("aria-modal", "true");
    document.body.appendChild(other);
    boot(); ready();
    expect(dialog.open).toBe(false);
    expect(dialog.querySelector("img")).not.toHaveAttribute("src");
    other.remove(); await mutations();
    expect(dialog.open).toBe(true);
  });

  it("temporarily yields an already open popup to another modal without recording a dismissal", async () => {
    boot(); ready();
    const other = document.createElement("section");
    other.setAttribute("role", "dialog"); other.setAttribute("aria-modal", "true");
    document.body.appendChild(other);
    await mutations();
    expect(dialog.open).toBe(false);
    expect(sessionStorage.getItem(key)).toBeNull();
    expect(dialog.dataset.dismissedUntil).toBeUndefined();
    other.remove(); await mutations();
    expect(dialog.open).toBe(true);
  });

  it("ignores a hidden or closed native modal when deciding whether to open", () => {
    document.body.insertAdjacentHTML("beforeend", '<section role="dialog" aria-modal="true" hidden></section><dialog role="dialog" aria-modal="true"></dialog>');
    boot(); ready();
    expect(dialog.open).toBe(true);
  });

  it("hands off an open dialog without closing it or consuming later React interactions", async () => {
    dialog.dataset.endsAt = String(Date.now() + 1000);
    boot(); ready();
    dialog.dataset.hydrated = "true";
    await mutations();
    expect(dialog.open).toBe(true);
    click("button[data-popup-action=close]");
    expect(dialog.open).toBe(true);
    expect(sessionStorage.getItem(key)).toBeNull();
    vi.advanceTimersByTime(1010);
    expect(dialog.open).toBe(true);
  });

  it("cleanup cancels a deferred popup and leaves an already open one intact", async () => {
    dialog.dataset.startsAt = String(Date.now() + 1000);
    boot(); ready(); dialog.__campusPopupCleanup?.();
    vi.advanceTimersByTime(1010);
    expect(dialog.open).toBe(false);
    delete dialog.dataset.startsAt;
    boot();
    expect(dialog.open).toBe(true);
    dialog.__campusPopupCleanup?.();
    await mutations();
    expect(dialog.open).toBe(true);
    vi.advanceTimersByTime(1010);
    expect(dialog.open).toBe(true);
  });

  it.each(["/admin", "/en/campus/roommates", "/more/meet/private-token"])("does not open on private path %s", pathname => {
    window.history.replaceState(null, "", pathname);
    boot(); ready();
    expect(dialog.open).toBe(false);
    expect(dialog.querySelector("img")).not.toHaveAttribute("src");
  });

  it("wraps visible first/last controls while preserving ordinary native Tab", () => {
    const controls = Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
    for (const control of controls) vi.spyOn(control, "getClientRects").mockReturnValue([{} as DOMRect] as unknown as DOMRectList);
    boot(); ready();
    function tab(shiftKey = false) {
      const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true });
      document.dispatchEvent(event); return event;
    }
    // Initial focus is the last close button, as in the actual popup.
    expect(tab().defaultPrevented).toBe(true);
    expect(controls[0]).toHaveFocus();
    expect(tab(true).defaultPrevented).toBe(true);
    expect(controls[controls.length - 1]).toHaveFocus();
    controls[1].focus();
    expect(tab().defaultPrevented).toBe(false);
    expect(controls[1]).toHaveFocus();
    document.getElementById("previous")!.focus();
    expect(tab(true).defaultPrevented).toBe(true);
    expect(controls[controls.length - 1]).toHaveFocus();
    document.getElementById("previous")!.focus();
    expect(tab().defaultPrevented).toBe(true);
    expect(controls[0]).toHaveFocus();
  });

  it("excludes hidden/disabled controls and leaves cancelled, non-Tab and handoff keys alone", () => {
    const anchor = dialog.querySelector("a")!;
    const today = dialog.querySelector<HTMLButtonElement>('[data-popup-action=today]')!;
    const close = dialog.querySelector<HTMLButtonElement>('button[data-popup-action=close]')!;
    vi.spyOn(anchor, "getClientRects").mockReturnValue([{} as DOMRect] as unknown as DOMRectList);
    anchor.setAttribute("aria-hidden", "true");
    today.disabled = true;
    vi.spyOn(close, "getClientRects").mockReturnValue([{} as DOMRect] as unknown as DOMRectList);
    boot(); ready();
    const wrapped = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    document.dispatchEvent(wrapped);
    expect(wrapped.defaultPrevented).toBe(true);expect(close).toHaveFocus();
    const cancelled = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });cancelled.preventDefault();
    document.getElementById("previous")!.focus();document.dispatchEvent(cancelled);
    expect(document.getElementById("previous")).toHaveFocus();
    const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });document.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(false);expect(dialog.open).toBe(true);
    dialog.__campusPopupCleanup?.();
    close.focus();
    const handedOff = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });document.dispatchEvent(handedOff);
    expect(handedOff.defaultPrevented).toBe(false);
  });

  it("leaves malformed, unsupported and already hydrated markup untouched", () => {
    dialog.dataset.startsAt = "not-an-epoch";
    boot(); ready(); expect(dialog.open).toBe(false);
    dialog.dataset.startsAt = "";
    dialog.dataset.hydrated = "true";
    boot(); expect(dialog.open).toBe(false);
    delete dialog.dataset.hydrated;
    Object.defineProperty(dialog, "showModal", { value: undefined });
    boot(); expect(dialog.open).toBe(false);
    script.remove();
    boot(); expect(dialog.open).toBe(false);
  });
});

