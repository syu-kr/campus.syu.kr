import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SEARCH_RETURN_BOOTSTRAP } from "./search-return-bootstrap";

let capture: EventListener;
beforeEach(() => {
  sessionStorage.clear();
  document.body.innerHTML = '<main><a href="/academic/timetable#week"><span>시간표</span></a></main>';
  window.history.replaceState(null, "", "/?search=%EC%8B%9C%EA%B0%84%ED%91%9C&page=2");
  const add = vi.spyOn(document, "addEventListener");
  new Function("window", "document", SEARCH_RETURN_BOOTSTRAP)(window, document);
  capture = add.mock.calls.find(([type]) => type === "click")![1] as EventListener;
  add.mockRestore();
});
afterEach(() => {
  document.removeEventListener("click", capture, true);
  sessionStorage.clear(); document.body.innerHTML = ""; vi.restoreAllMocks();
});
function click(options: MouseEventInit = {}) {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, ...options });
  // Keep the native link from navigating after the early capture handler runs.
  document.querySelector("span")!.addEventListener("click", e => e.preventDefault(), { once: true });
  document.querySelector("span")!.dispatchEvent(event);
  return event;
}
it("captures an ordinary visible search link before any React component mounts", () => {
  click();
  expect(JSON.parse(sessionStorage.getItem("syu-campus-search-return")!)).toEqual({
    url: "/?search=%EC%8B%9C%EA%B0%84%ED%91%9C&page=2", scrollY: 0, result: "/academic/timetable#week",
  });
});
it("tracks the current locale and search after client navigation without registering again", () => {
  window.history.replaceState(null, "", "/en?search=table");
  document.querySelector("a")!.href = "/en/academic/timetable?day=mon";
  click();
  expect(JSON.parse(sessionStorage.getItem("syu-campus-search-return")!)).toMatchObject({ url: "/en?search=table", result: "/en/academic/timetable?day=mon" });
});
it("leaves modified, external, downloaded, new-tab and non-search navigation alone", () => {
  for (const options of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) click(options);
  const anchor = document.querySelector("a")!;
  anchor.href = "https://example.org/"; click();
  anchor.href = "/academic/timetable"; anchor.target = "_blank"; click(); anchor.target = "";
  anchor.setAttribute("download", ""); click(); anchor.removeAttribute("download");
  window.history.replaceState(null, "", "/?search= "); click();
  window.history.replaceState(null, "", "/campus/map?search=a"); click();
  expect(sessionStorage.getItem("syu-campus-search-return")).toBeNull();
});
it("does not prevent navigation when session storage is blocked", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
  expect(() => click()).not.toThrow();
  expect(sessionStorage.getItem("syu-campus-search-return")).toBeNull();
});

it("preserves keyboard-triggered native navigation and the English destination query and fragment", () => {
  window.history.replaceState(null, "", "/en/?search=bus&page=3");
  document.querySelector("a")!.href = "/en/campus/bus-info?route=station#times";
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, detail: 0 });
  Object.defineProperty(event, "target", { value: document.querySelector("span") });
  capture(event);
  expect(event.defaultPrevented).toBe(false);
  expect(JSON.parse(sessionStorage.getItem("syu-campus-search-return")!)).toEqual({
    url: "/en/?search=bus&page=3", scrollY: 0, result: "/en/campus/bus-info?route=station#times",
  });
});

it("ignores cancelled clicks, links outside main and same-path search updates", () => {
  const event = new MouseEvent("click", { cancelable: true });
  Object.defineProperty(event, "target", { value: document.querySelector("span") });
  event.preventDefault();
  capture(event);
  expect(sessionStorage.getItem("syu-campus-search-return")).toBeNull();
  document.body.innerHTML = '<aside><a href="/academic/timetable"><span>시간표</span></a></aside>';
  click();
  expect(sessionStorage.getItem("syu-campus-search-return")).toBeNull();
  document.body.innerHTML = '<main><a href="/?search=other&page=2"><span>검색 변경</span></a></main>';
  click();
  expect(sessionStorage.getItem("syu-campus-search-return")).toBeNull();
});
