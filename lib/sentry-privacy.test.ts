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

  it.each([
    ["/academic?token=synthetic-query-secret", "/academic"],
    ["/academic#synthetic-fragment-secret", "/academic"],
    ["/academic?token=synthetic-query-secret#synthetic-fragment-secret", "/academic"],
    ["https://campus.syu.kr/academic?token=synthetic-query-secret", "https://campus.syu.kr/academic"],
  ])("scrubs the Next.js request-error context path %s", (requestPath, expectedPath) => {
    const event = scrubSentryEvent({
      contexts: {
        nextjs: {
          request_path: requestPath,
          router_kind: "App Router",
          router_path: "/academic",
          route_type: "render",
        },
        runtime: { name: "node" },
      },
    });

    expect(event.contexts).toEqual({
      nextjs: {
        request_path: expectedPath,
        router_kind: "App Router",
        router_path: "/academic",
        route_type: "render",
      },
      runtime: { name: "node" },
    });
    expect(JSON.stringify(event)).not.toContain("synthetic-query-secret");
    expect(JSON.stringify(event)).not.toContain("synthetic-fragment-secret");
  });

  it("preserves absent or non-string Next.js request-error context paths", () => {
    expect(scrubSentryEvent({}).contexts).toBeUndefined();
    expect(scrubSentryEvent({ contexts: { runtime: { name: "node" } } }).contexts)
      .toEqual({ runtime: { name: "node" } });
    for (const requestPath of [undefined, null, 42]) {
      const contexts = { nextjs: { request_path: requestPath, route_type: "render" } };
      const event = scrubSentryEvent({ contexts });
      expect(event.contexts?.nextjs?.request_path).toBe(requestPath);
      expect(event.contexts?.nextjs?.route_type).toBe("render");
    }
  });

  it.each(["", "?query-secret", "#fragment-secret", "?query-secret#fragment-secret"])(
    "masks FCM registration tokens across event URLs with suffix %s",
    (suffix) => {
      const endpoint = "https://fcmregistrations.googleapis.com/v1/projects/test-project/registrations";
      const url = `${endpoint}/fake-fcm-token${suffix}`;
      const filtered = `${endpoint}/[Filtered]`;
      const event = scrubSentryEvent({
        transaction: url,
        request: { url, method: "PATCH" },
        breadcrumbs: [{
          category: "fetch",
          data: { url, from: url, to: url, method: "PATCH", "http.query": "query-secret", "http.fragment": "fragment-secret" },
        }],
        spans: [{
          span_id: "test", trace_id: "test", start_timestamp: 1, timestamp: 2,
          description: `PATCH ${url}`,
          data: { "http.url": url, target: url, location: url, "http.query": "query-secret", "http.fragment": "fragment-secret" },
        }],
      });

      expect(event.transaction).toBe(filtered);
      expect(event.request).toEqual({ url: filtered, method: "PATCH" });
      expect(event.breadcrumbs[0].data).toEqual({ url: filtered, from: filtered, to: filtered, method: "PATCH" });
      expect(event.spans[0].description).toBe(`PATCH ${filtered}`);
      expect(event.spans[0].data).toEqual({ "http.url": filtered, target: filtered, location: filtered });
      expect(JSON.stringify(event)).not.toMatch(/fake-fcm-token|query-secret|fragment-secret/);
    },
  );

  it("preserves registration collection and unrelated paths while removing navigation fragments", () => {
    const collection = "https://fcmregistrations.googleapis.com/v1/projects/test-project/registrations";
    const unrelated = "https://example.com/v1/projects/test-project/registrations/public-id";
    expect(scrubSentryBreadcrumb({ data: { url: collection, from: "/a#fragment-secret", to: unrelated } }).data)
      .toEqual({ url: collection, from: "/a", to: unrelated });
  });

  it("excludes sensitive login completion traces and strips span URL queries", () => {
    expect(isPrivateRoommateAuthEvent({ request: { url: "https://campus.syu.kr/en/campus/roommates/verify/finish?oobCode=secret" } })).toBe(true);
    expect(isPrivateRoommateAuthEvent({ transaction: "/campus/roommates/verify/finish" })).toBe(true);
    expect(isPrivateRoommateAuthEvent({ transaction: "/campus/roommates" })).toBe(false);
    const event = scrubSentryEvent({ spans: [{ span_id: "test", trace_id: "test", start_timestamp: 1, timestamp: 2, description: "GET /finish?oobCode=secret", data: { "http.url": "https://example.com/?oobCode=secret" } }] });
    expect(JSON.stringify(event)).not.toContain("secret");
  });
});
