import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "./fetch-json";
import { fetchWeather } from "./weather";

vi.mock("./fetch-json", () => ({ fetchJson: vi.fn() }));
beforeEach(() => vi.mocked(fetchJson).mockReset());

describe("weather response validation", () => {
  it.each([null, { error: "Unavailable" }, { temperature: 10 }])("rejects an invalid successful response so the query retains its last good data", async (response) => {
    vi.mocked(fetchJson).mockResolvedValue(response);
    await expect(fetchWeather()).rejects.toThrow("Invalid weather response");
  });
});
