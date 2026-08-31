import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

describe("GET /api/weather", () => {
  beforeEach(() => {
    vi.stubEnv("PUBLIC_DATA_SERVICE_KEY", "test-key");
    vi.stubEnv("KMA_NCST_URL", "https://example.com/ncst");
    vi.stubEnv("KMA_FCST_URL", "https://example.com/fcst");
  });

  it("returns current conditions when the optional forecast request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            response: {
              body: {
                items: {
                  item: [
                    { category: "T1H", obsrValue: "24.4" },
                    { category: "PTY", obsrValue: "0" },
                    { category: "WSD", obsrValue: "1.25" },
                  ],
                },
              },
            },
          }),
        })
        .mockRejectedValueOnce(new Error("forecast timeout")),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      temperature: 24,
      precipitation: 0,
      windSpeed: 1.3,
      sourceStatus: "fresh",
    });
  });
});
