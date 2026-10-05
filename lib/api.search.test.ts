import { afterEach, describe, expect, it, vi } from "vitest";
import { searchAll } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("searchAll", () => {
  it("keeps departments that share a phone number", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      if (input.includes("phone-numbers")) {
        return Response.json([
          { department: "학생상담센터", phone: "02-3399-3239" },
          { department: "SU인권센터", phone: "02-3399-3239" },
        ]);
      }
      return Response.json(input.includes("announcements") ? { items: [] } : []);
    }));

    const result = await searchAll("02-3399-3239");
    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => "department" in item && item.department)).toEqual([
      "학생상담센터",
      "SU인권센터",
    ]);
    expect(result.failedSources).toEqual([]);
  });

  it("returns available results and names a failed source", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      if (input.includes("announcements")) throw new Error("notice source failed");
      if (input.includes("phone-numbers")) {
        return Response.json([{ department: "학생상담센터", phone: "02-3399-3239" }]);
      }
      return Response.json([]);
    }));

    const result = await searchAll("3239");
    expect(result.items).toHaveLength(1);
    expect(result.failedSources).toEqual(["announcements"]);
  });

  it("finds either phone number without hyphens", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      if (input.includes("phone-numbers")) {
        return Response.json([{
          department: "교목처 교목팀",
          phone: "02-3399-3328 02-3399-3334",
          phoneNumbers: ["02-3399-3328", "02-3399-3334"],
        }]);
      }
      return Response.json(input.includes("announcements") ? { items: [] } : []);
    }));

    const result = await searchAll("0233993334");
    expect(result.items).toHaveLength(1);
    expect(result.failedSources).toEqual([]);
  });
});
