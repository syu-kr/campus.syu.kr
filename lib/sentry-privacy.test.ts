import { describe, expect, it } from "vitest";

import { isPrivateRoommateAuthEvent, scrubSentryBreadcrumb, scrubSentryEvent } from "./sentry-privacy";

describe("Sentry privacy scrubber", () => {
  it("removes request identity, headers, body, and URL queries", () => {
    const event = scrubSentryEvent({
      transaction: "/path?token=secret",
      user: { email: "student@syu.kr" },
      request: {
        url: "https://campus.syu.kr/path?token=secret",
        headers: { authorization: "Bearer secret" },
        cookies: { session: "secret" },
        data: "private body",
        query_string: "token=secret",
      },
    });

    expect(event.user).toBeUndefined();
    expect(event.transaction).toBe("/path");
    expect(event.request).toEqual({ url: "https://campus.syu.kr/path" });
  });

  it("removes queries from navigation breadcrumbs", () => {
    expect(
      scrubSentryBreadcrumb({ data: { from: "/a?id=1", to: "/b?token=x" } }),
    ).toMatchObject({ data: { from: "/a", to: "/b" } });
  });

  it("excludes sensitive login completion traces and strips span URL queries", () => {
    expect(isPrivateRoommateAuthEvent({ request: { url: "https://campus.syu.kr/en/campus/roommates/verify/finish?oobCode=secret" } })).toBe(true);
    expect(isPrivateRoommateAuthEvent({ transaction: "/campus/roommates/verify/finish" })).toBe(true);
    expect(isPrivateRoommateAuthEvent({ transaction: "/campus/roommates" })).toBe(false);
    const event = scrubSentryEvent({ spans: [{ span_id: "test", trace_id: "test", start_timestamp: 1, timestamp: 2, description: "GET /finish?oobCode=secret", data: { "http.url": "https://example.com/?oobCode=secret" } }] });
    expect(JSON.stringify(event)).not.toContain("secret");
  });
});
