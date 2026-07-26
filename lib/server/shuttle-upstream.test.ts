import { describe, expect, it } from "vitest";
import { validateShuttleEndpoint } from "./shuttle-upstream";

describe("validateShuttleEndpoint", () => {
  it("accepts an HTTPS endpoint matching the referer origin", () => {
    expect(
      validateShuttleEndpoint(
        "https://bus.syu.kr/api/location",
        "https://bus.syu.kr/",
      ).url.hostname,
    ).toBe("bus.syu.kr");
  });

  it("rejects insecure HTTP endpoints", () => {
    expect(() =>
      validateShuttleEndpoint(
        "http://bus.syu.kr/api/location",
        "http://bus.syu.kr/",
      ),
    ).toThrow("HTTPS");
  });

  it("rejects an endpoint outside the configured referer origin", () => {
    expect(() =>
      validateShuttleEndpoint(
        "https://internal.example/api",
        "https://bus.syu.kr/",
      ),
    ).toThrow("origin");
  });
});
