// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { measureHomeTask, traceHomeData } from "./home-performance";

afterEach(() => vi.restoreAllMocks());

it("keeps fast successful requests quiet and preserves values", async () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  expect(await traceHomeData("home", () => measureHomeTask("announcements", async () => 12))).toBe(12);
  expect(log).not.toHaveBeenCalled();
});

it("rethrows Next dynamic-rendering control flow without reporting a server failure", async () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  const signal = Object.assign(new Error("dynamic route"), { digest: "DYNAMIC_SERVER_USAGE" });
  await expect(traceHomeData("home", async () => { throw signal; })).rejects.toBe(signal);
  expect(log).not.toHaveBeenCalled();
});

it("records slow steps without serializing parallel work or logging content", async () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  let clock = 0;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const read = vi.fn(async () => { await wait; return { secret: "must never appear" }; });
  const pending = traceHomeData("home", () => Promise.all([
    measureHomeTask("announcements", read), measureHomeTask("banners", read),
  ]));
  expect(read).toHaveBeenCalledTimes(2);
  clock = 1500; release(); await pending;
  const record = JSON.parse(log.mock.calls[0][1]);
  expect(record).toMatchObject({ scope: "home", ms: 1500, ok: true, steps: [{ step: "announcements", ms: 1500, ok: true }, { step: "banners", ms: 1500, ok: true }] });
  expect(JSON.stringify(record)).not.toContain("secret");
});

it("isolates concurrent requests and rethrows the original error without logging its message", async () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  const error = new Error("sensitive URL");
  await Promise.all([
    expect(traceHomeData("home", () => measureHomeTask("manifest", async () => { throw error; }))).rejects.toBe(error),
    traceHomeData("layout-banners", () => measureHomeTask("popup", async () => [])),
  ]);
  expect(log).toHaveBeenCalledTimes(1);
  const record = JSON.parse(log.mock.calls[0][1]);
  expect(record.steps).toEqual([{ step: "manifest", ms: expect.any(Number), ok: false }]);
  expect(JSON.stringify(record)).not.toContain(error.message);
});
