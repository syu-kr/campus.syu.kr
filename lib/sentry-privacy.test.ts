import { describe, expect, it } from "vitest";

import { scrubSentryBreadcrumb, scrubSentryEvent } from "./sentry-privacy";

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
});
