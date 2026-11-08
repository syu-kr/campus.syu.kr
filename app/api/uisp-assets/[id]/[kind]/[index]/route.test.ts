// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, clearRateLimitBuckets } from "@/lib/rate-limit";
import { hasUispAnnouncement } from "@/lib/server/announcements";
import { readUispNotice } from "@/lib/server/uisp-notices";
import { GET } from "./route";

vi.mock("@/lib/server/announcements", () => ({ hasUispAnnouncement: vi.fn() }));

const origin = "http://source.example.invalid";
const board = `${origin}/bbs/board.php?bo_table=notice`;
const post = `${board}&wr_id=743`;
const attachment = `${origin}/bbs/download.php?bo_table=notice&wr_id=743&no=0`;
const image = "https://www.syu.ac.kr/wp-content/uploads/2026/11/poster.png";
const fetchUpstream = vi.fn<typeof fetch>();

function originNotice(fileName = "붙임 (공고).pdf") {
  const headers = new Headers({ "Content-Type": "text/html; charset=utf-8" });
  headers.append("Set-Cookie", "tracking=discard; Path=/");
  headers.append("Set-Cookie", "PHPSESSID=notice-123; Path=/; HttpOnly");
  return new Response(
    `<div id="bo_v_con"><p>공지 내용</p><img src="${image}"></div>
     <section id="bo_v_file"><a href="${attachment}">${fileName}</a></section>`,
    { headers },
  );
}

function requestAsset(kind = "attachment", index = "0", id = "uisp-743") {
  const request = new Request(`https://campus.syu.kr/api/uisp-assets/${id}/${kind}/${index}`, {
    headers: { Cookie: "campus-session=private", Authorization: "Bearer private", "X-Forwarded-For": "192.0.2.1" },
  });
  return GET(request, { params: Promise.resolve({ id, kind, index }) });
}

beforeEach(() => {
  vi.stubEnv("UISP_NOTICE_BOARD_URL", board);
  fetchUpstream.mockReset();
  vi.stubGlobal("fetch", fetchUpstream);
  vi.mocked(hasUispAnnouncement).mockReset().mockResolvedValue(true);
  clearRateLimitBuckets();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("UISP public assets", () => {
  it.each([
    undefined,
    "ftp://source.example.invalid/bbs/board.php?bo_table=notice",
    "http://user@source.example.invalid/bbs/board.php?bo_table=notice",
    "http://source.example.invalid:80/bbs/board.php?bo_table=notice",
    "http://source.example.invalid/bbs/board.php?bo_table=notice&bo_table=notice",
    "http://source.example.invalid/bbs/board.php?bo_table=notice#fragment",
    "http://source.example.invalid/bbs/other.php?bo_table=notice",
  ])("does not fetch without a valid server-only board address", async (configured) => {
    vi.stubEnv("UISP_NOTICE_BOARD_URL", configured);
    expect((await requestAsset()).status).toBe(404);
    expect(await readUispNotice("uisp-743")).toBeNull();
    expect(fetchUpstream).not.toHaveBeenCalled();
  });

  it("does not return internal image URLs in the public notice projection", async () => {
    fetchUpstream.mockResolvedValueOnce(originNotice());
    expect(await readUispNotice("uisp-743")).toEqual({
      content: expect.arrayContaining([{ type: "image", src: "/api/uisp-assets/uisp-743/image/0", alt: "" }]),
      attachments: [{ index: "0", name: "붙임 (공고).pdf" }],
    });
  });

  it("delivers bytes as a sanitized download and forwards only the ephemeral origin session", async () => {
    fetchUpstream.mockResolvedValueOnce(originNotice()).mockResolvedValueOnce(new Response("%PDF-1.6", {
      headers: {
        "Content-Type": "file/unknown",
        "Content-Disposition": 'attachment; filename="untrusted.exe"',
        "Set-Cookie": "PHPSESSID=upstream-only",
      },
    }));

    const response = await requestAsset();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("%PDF-1.6");
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.get("content-disposition")).toBe(
      "attachment; filename=\"attachment.pdf\"; filename*=UTF-8''%EB%B6%99%EC%9E%84%20%28%EA%B3%B5%EA%B3%A0%29.pdf",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(fetchUpstream.mock.calls.map(([url]) => url)).toEqual([post, attachment]);
    const firstRequest = fetchUpstream.mock.calls[0]?.[1];
    const secondRequest = fetchUpstream.mock.calls[1]?.[1];
    expect(firstRequest?.redirect).toBe("error");
    expect(firstRequest?.cache).toBe("no-store");
    expect(secondRequest?.redirect).toBe("error");
    expect(new Headers(firstRequest?.headers).get("cookie")).toBeNull();
    expect(new Headers(secondRequest?.headers).get("cookie")).toBe("PHPSESSID=notice-123");
    expect(new Headers(secondRequest?.headers).get("authorization")).toBeNull();
  });

  it("checks published IDs, asset selectors and the per-IP limit before calling upstream", async () => {
    vi.mocked(hasUispAnnouncement).mockResolvedValueOnce(false);
    expect((await requestAsset("attachment", "0", "uisp-999")).status).toBe(404);
    expect((await requestAsset("attachment", "01")).status).toBe(404);
    expect((await requestAsset("url")).status).toBe(404);
    for (let count = 0; count < 60; count++) {
      checkRateLimit("uisp-asset:192.0.2.1", { limit: 60, windowMs: 60_000 });
    }
    const response = await requestAsset();
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(fetchUpstream).not.toHaveBeenCalled();
  });

  it("ignores unlisted and executable attachments", async () => {
    fetchUpstream.mockResolvedValueOnce(originNotice());
    expect((await requestAsset("attachment", "1")).status).toBe(404);
    fetchUpstream.mockResolvedValueOnce(originNotice("안내.svg"));
    expect((await requestAsset()).status).toBe(404);
    fetchUpstream.mockResolvedValueOnce(originNotice("안내.exe"));
    expect((await readUispNotice("uisp-743"))?.attachments).toEqual([]);
    expect(fetchUpstream.mock.calls.map(([url]) => url)).toEqual([post, post, post]);
  });

  it("rejects upstream HTML errors even when they claim to be a successful download", async () => {
    fetchUpstream.mockResolvedValueOnce(originNotice()).mockResolvedValueOnce(new Response("<html>session error</html>", {
      headers: { "Content-Type": "text/html", "Content-Disposition": "attachment" },
    }));
    const response = await requestAsset();
    expect(response.status).toBe(502);
    expect(await response.text()).toBe("");
  });

  it("refuses oversized responses and stops an undeclared-length stream at its byte limit", async () => {
    const headers = { "Content-Type": "file/unknown", "Content-Disposition": "attachment" };
    const tooLarge = 32 * 1024 * 1024 + 1;
    fetchUpstream.mockResolvedValueOnce(originNotice()).mockResolvedValueOnce(new Response("file", {
      headers: { ...headers, "Content-Length": String(tooLarge) },
    }));
    expect((await requestAsset()).status).toBe(413);

    const chunk = new Uint8Array(1024 * 1024);
    const cancelled = vi.fn();
    const body = new ReadableStream({ pull: (controller) => controller.enqueue(chunk), cancel: cancelled });
    fetchUpstream.mockResolvedValueOnce(originNotice()).mockResolvedValueOnce(new Response(body, { headers }));
    const response = await requestAsset();
    const reader = response.body!.getReader();
    for (let count = 0; count < 32; count++) {
      expect((await reader.read()).value?.byteLength).toBe(chunk.byteLength);
    }
    await expect(reader.read()).rejects.toThrow("size limit");
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it("returns verified raster bytes from a listed origin without a session cookie", async () => {
    const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    fetchUpstream.mockResolvedValueOnce(originNotice()).mockResolvedValueOnce(new Response(bytes, {
      headers: { "Content-Type": "image/png" },
    }));
    const response = await requestAsset("image");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    expect(fetchUpstream.mock.calls[1]?.[0]).toBe(image);
    expect(new Headers(fetchUpstream.mock.calls[1]?.[1]?.headers).get("cookie")).toBeNull();
  });

  it("rejects non-image bytes even when upstream labels them as an allowed image type", async () => {
    fetchUpstream.mockResolvedValueOnce(originNotice()).mockResolvedValueOnce(new Response("<svg onload=alert(1)>", {
      headers: { "Content-Type": "image/png" },
    }));
    expect((await requestAsset("image")).status).toBe(502);
  });
});
