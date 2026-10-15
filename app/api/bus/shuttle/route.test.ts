// @vitest-environment node
import { EventEmitter } from "node:events";
import http from "node:http";
import https from "node:https";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const challengeHtml = `window.BUS_CHALLENGE = {
  seed: "1234567890abcdef", ts: 1789696800,
  sig: "0123456789abcdef0123456789abcdef"
};`;

function mockUpstream(
  transport: typeof http | typeof https,
  responses: { status: number; body: string }[],
) {
  const sent: {
    method: string;
    path: string;
    headers: Record<string, string | number | readonly string[] | undefined>;
    body: string;
  }[] = [];

  vi.spyOn(transport, "request").mockImplementation((
    (options: http.RequestOptions, callback: (response: http.IncomingMessage) => void) => {
      const request = new EventEmitter() as http.ClientRequest;
      const headers: http.OutgoingHttpHeaders = {
        ...Object.fromEntries(Object.entries(options.headers ?? {}).map(
          ([name, value]) => [name.toLowerCase(), value],
        )),
        "x-vercel-id": "icn1::test-request",
        "x-invocation-id": "test-invocation",
      };
      let body = "";

      request.removeHeader = (name) => { delete headers[name.toLowerCase()]; };
      request.setTimeout = () => request;
      request.write = ((chunk: string) => { body += chunk; return true; }) as typeof request.write;
      request.end = (() => {
        sent.push({
          method: options.method ?? "GET",
          path: options.path ?? "/",
          headers: { ...headers },
          body,
        });
        const next = responses.shift();
        if (!next) throw new Error("Unexpected upstream request");
        const response = new EventEmitter() as http.IncomingMessage;
        response.statusCode = next.status;
        callback(response);
        response.emit("data", Buffer.from(next.body));
        response.emit("end");
        return request;
      }) as typeof request.end;

      return request;
    }
  ) as typeof transport.request);

  return sent;
}

function configureEndpoint(origin: string) {
  vi.stubEnv("SHUTTLE_LOCATION_URL", `${origin}/location.php`);
  vi.stubEnv("SHUTTLE_PAGE_URL", `${origin}/page.html`);
  vi.stubEnv("SHUTTLE_REFERER", `${origin}/page.html`);
  vi.stubEnv("SHUTTLE_USER_AGENT", "test-shuttle-client");
  vi.stubEnv("SHUTTLE_CHALLENGE_SALT", "test-salt");
  vi.stubEnv("SHUTTLE_TRACE_HEADER_COMPAT_HOST", "upstream.example.com");
}

describe("GET /api/bus/shuttle", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["http", "https"])(
    "removes platform trace headers from the configured compatible %s upstream before sending",
    async (protocol) => {
      const origin = `${protocol}://upstream.example.com`;
      configureEndpoint(origin);
      const sent = mockUpstream(protocol === "https" ? https : http, [
        { status: 200, body: challengeHtml },
        { status: 200, body: JSON.stringify({ returnCode: "200", data: [] }) },
      ]);
      const { GET } = await import("./route");

      const response = await GET();

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ success: true, sourceStatus: "fresh", data: [] });
      expect(sent.map(({ method, path }) => ({ method, path }))).toEqual([
        { method: "GET", path: "/page.html" },
        { method: "POST", path: "/location.php" },
      ]);
      for (const { headers } of sent) {
        expect(headers).not.toHaveProperty("x-vercel-id");
        expect(headers).not.toHaveProperty("x-invocation-id");
        expect(headers).toMatchObject({ "user-agent": "test-shuttle-client", "cache-control": "no-cache" });
      }
      expect(sent[1].headers).toMatchObject({
        origin,
        referer: `${origin}/page.html`,
        "x-requested-with": "XMLHttpRequest",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "content-length": Buffer.byteLength(sent[1].body),
      });
      expect(new URLSearchParams(sent[1].body).get("_a")).toBe("a0e3f4b193058158");
    },
  );

  it("preserves platform trace headers for another configured host", async () => {
    configureEndpoint("https://bus.example.com");
    const sent = mockUpstream(https, [
      { status: 200, body: challengeHtml },
      { status: 200, body: JSON.stringify({ returnCode: "200", data: [] }) },
    ]);
    const { GET } = await import("./route");

    expect((await GET()).status).toBe(200);
    expect(sent).toHaveLength(2);
    for (const { headers } of sent) {
      expect(headers).toMatchObject({
        "x-vercel-id": "icn1::test-request",
        "x-invocation-id": "test-invocation",
      });
    }
  });

  it("preserves platform trace headers when compatibility is not configured", async () => {
    configureEndpoint("https://upstream.example.com");
    vi.stubEnv("SHUTTLE_TRACE_HEADER_COMPAT_HOST", undefined);
    const sent = mockUpstream(https, [
      { status: 200, body: challengeHtml },
      { status: 200, body: JSON.stringify({ returnCode: "200", data: [] }) },
    ]);
    const { GET } = await import("./route");

    expect((await GET()).status).toBe(200);
    expect(sent).toHaveLength(2);
    for (const { headers } of sent) {
      expect(headers).toMatchObject({
        "x-vercel-id": "icn1::test-request",
        "x-invocation-id": "test-invocation",
      });
    }
  });

  it.each(["GET", "POST"])("keeps a genuine upstream %s 403 as an error with cooldown", async (method) => {
    configureEndpoint("http://upstream.example.com");
    const responses = method === "GET"
      ? [{ status: 403, body: "Forbidden" }]
      : [{ status: 200, body: challengeHtml }, { status: 403, body: "Forbidden" }];
    const sent = mockUpstream(http, responses);
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ success: false, sourceStatus: "error" });
    expect(console.error).toHaveBeenCalledWith(
      "Failed to fetch shuttle bus locations:",
      expect.objectContaining({
        message: `Shuttle location API ${method} /${method === "GET" ? "page.html" : "location.php"} returned 403`,
        statusCode: 403,
      }),
    );
    expect((await GET()).status).toBe(502);
    expect(sent).toHaveLength(method === "GET" ? 1 : 2);
  });
});
