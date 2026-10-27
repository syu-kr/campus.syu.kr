import { afterEach, expect, it, vi } from "vitest";
import { readSessionValue, removeSessionValue, writeSessionValue } from "./browser-storage";

afterEach(() => vi.unstubAllGlobals());
it("keeps session selections readable and removable", () => {
  expect(writeSessionValue("m3-test", "manna")).toBe(true);
  expect(readSessionValue("m3-test")).toBe("manna");
  expect(removeSessionValue("m3-test")).toBe(true);
  expect(readSessionValue("m3-test")).toBeNull();
});
it("does not break rendering when storage access is denied", () => {
  vi.stubGlobal("window", { get sessionStorage() { throw new DOMException("Denied", "SecurityError"); } });
  expect(readSessionValue("m3-test")).toBeNull();
  expect(writeSessionValue("m3-test", "value")).toBe(false);
  expect(removeSessionValue("m3-test")).toBe(false);
});
