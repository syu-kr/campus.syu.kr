import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("library reading room route", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.LIBRARY_READING_ROOMS_URL = "https://example.com/rooms.xml";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.LIBRARY_READING_ROOMS_URL;
  });

  it("accepts the upstream XML body mislabeled as text/html", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          "<?xml version=\"1.0\"?><item>" +
            "<strRoomNm><![CDATA[제1열람실]]></strRoomNm>" +
            "<strTotalSeat><![CDATA[100]]></strTotalSeat>" +
            "<strUseSeat><![CDATA[40]]></strUseSeat>" +
            "<strRemainSeat><![CDATA[60]]></strRemainSeat></item>",
          { headers: { "content-type": "text/html; charset=UTF-8" } },
        ),
      ),
    );
    const { GET } = await import("./route");

    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).data).toHaveLength(1);
  });

  it("rejects seat counts that exceed the room total", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          "<item><strRoomNm><![CDATA[제1열람실]]></strRoomNm>" +
            "<strTotalSeat><![CDATA[100]]></strTotalSeat>" +
            "<strUseSeat><![CDATA[101]]></strUseSeat>" +
            "<strRemainSeat><![CDATA[0]]></strRemainSeat></item>",
          { headers: { "content-type": "application/xml" } },
        ),
      ),
    );
    const { GET } = await import("./route");

    const response = await GET();
    expect(response.status).toBe(502);
    expect((await response.json()).success).toBe(false);
  });
});
