import { describe, expect, it } from "vitest";
import {
  createShuttleChallengeBody,
  validateShuttleEndpoint,
} from "./shuttle-upstream";

describe("validateShuttleEndpoint", () => {
  it("accepts matching HTTP upstream URLs", () => {
    expect(
      validateShuttleEndpoint(
        "http://example.com/bus/location.php",
        "http://example.com/bus/page.html",
        "http://example.com/bus/page.html",
      ).url.hostname,
    ).toBe("example.com");
  });

  it("rejects unsupported protocols", () => {
    expect(() =>
      validateShuttleEndpoint(
        "file:///tmp/location.json",
        "file:///tmp/page.html",
        "file:///tmp/page.html",
      ),
    ).toThrow("HTTP");
  });

  it("rejects URLs outside the configured origin", () => {
    expect(() =>
      validateShuttleEndpoint(
        "https://internal.example/api",
        "https://bus.syu.kr/",
        "https://bus.syu.kr/page",
      ),
    ).toThrow("origin");
  });
});

describe("createShuttleChallengeBody", () => {
  it("creates the form body without evaluating upstream code", () => {
    const body = createShuttleChallengeBody(
      `<script>window.BUS_CHALLENGE = {
        seed: "1234567890abcdef",
        ts: 1789696800,
        sig: "0123456789abcdef0123456789abcdef"
      };</script>`,
      "test-salt",
    );

    expect(Object.fromEntries(new URLSearchParams(body))).toEqual({
      _s: "1234567890abcdef",
      _t: "1789696800",
      _g: "0123456789abcdef0123456789abcdef",
      _a: "a0e3f4b193058158",
    });
  });

  it("rejects missing challenge fields", () => {
    expect(() => createShuttleChallengeBody("<html></html>", "test-salt"))
      .toThrow("challenge");
  });
});
