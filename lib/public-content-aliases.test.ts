import { describe, expect, it } from "vitest";
import { getPublicContentAlias } from "./public-content-aliases";

describe("public display aliases", () => {
  it("keeps Korean source values and unknown proper names unchanged", () => {
    expect(getPublicContentAlias("화랑대역(5번 출구) → 학교", "ko")).toBe("화랑대역(5번 출구) → 학교");
    expect(getPublicContentAlias("새로운 열람실", "en")).toBe("새로운 열람실");
    expect(getPublicContentAlias("삼육대학교", "en")).toBe("삼육대학교");
  });
  it("uses existing English station names and preserves exit numbers/directions", () => {
    expect(getPublicContentAlias("화랑대역(5번 출구) → 학교", "en")).toBe("Hwarangdae Station (Exit 5) → Campus");
    expect(getPublicContentAlias("학교 ↔ 석계역(4번 출구)", "en")).toBe("Campus ↔ Seokgye Station (Exit 4)");
    expect(getPublicContentAlias("별내", "en")).toBe("Byeollae");
  });
  it("describes known library labels without changing source indices", () => {
    expect(getPublicContentAlias("제1자료실A", "en")).toBe("Collection Room 1A");
    expect(getPublicContentAlias("열람실", "en")).toBe("Reading Room");
    expect(getPublicContentAlias("1층 집중실", "en")).toBe("1F Focus Room");
  });
});
